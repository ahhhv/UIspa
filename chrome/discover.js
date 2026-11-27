// UIspa · «¿Qué veo esta noche?»: películas que te pueden gustar, una carta cada vez (tipo Tinder).
//   · Tus gustos salen de tu Plex o Jellyfin: géneros, directores y décadas de tus
//     películas (lo que has visto y lo que has puntuado alto cuenta más).
//   · Las cartas salen de todo el catálogo de películas de Hispashare, por géneros,
//     y nunca te propone lo que ya tienes.
//   · ← paso · ↑ favorito · → lo quiero (descargar ya eligiendo la calidad, guardar
//     «Para luego» o abrir la ficha). Los descartes se pueden recuperar en los ajustes.
// Se abre con «🎲 Descubrir» en la barra de arriba (dirección #que-veo).
(() => {
  "use strict";
  const html = document.documentElement;
  if (!html.classList.contains("hcm") || !document.getElementById("hcm-root")) return;
  const api = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const me = api?.runtime?.id || "uispa";
  if (html.dataset.uispaOwner && html.dataset.uispaOwner !== me) return;
  if (window.__uispaDiscover) return;
  window.__uispaDiscover = true;
  const U = globalThis.__uispa || {};
  if (!U.rowData || !U.listRows || !api?.storage) return;

  // ------------------------------------------------------------ utilidades
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k);
    return el;
  }
  const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\(.*?\)/g, " ").replace(/&/g, " y ").replace(/[^a-z0-9]+/g, " ").trim();
  const titleId = (href) => (String(href || "").match(/[?&]id=(\d+)/) || [])[1] || null;
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (_) { return u || ""; } };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const toast = (msg, err = false) => {
    let t = document.getElementById("hc-toast");
    if (!t) { t = h("div", { id: "hc-toast" }); html.append(t); }
    t.textContent = msg;
    t.className = err ? "hc-show hc-error" : "hc-show";
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.className = ""), 2400);
  };

  // Géneros con nombres distintos en Plex / Jellyfin (español o inglés) y en Hispashare
  const SYN = [
    ["thriller", /thriller|suspens|intriga/], ["scifi", /ciencia ficcion|science fiction|sci fi|scifi/], ["terror", /terror|horror/],
    ["comedia", /comedi|comedy/], ["accion", /accion|action/], ["aventura", /aventura|adventure/], ["animacion", /animaci|animation|anime/],
    ["crimen", /crimen|crime|policia|cine negro|noir|gangster/], ["misterio", /misterio|mystery/], ["fantasia", /fantas|fantasy/],
    ["romance", /romanc|romanti/], ["belico", /belic|guerra|\bwar\b/], ["western", /western|oeste/], ["historia", /histori|history/],
    ["musica", /music/], ["familia", /familia|family|infantil|kids/], ["documental", /document/], ["biografia", /biogra|biopic/],
    ["deporte", /deport|sport/], ["drama", /drama/]
  ];
  const canon = (g) => { const n = norm(g); for (const [k, re] of SYN) if (re.test(n)) return k; return n; };

  // ------------------------------------------------------------ almacenamiento
  // discoverLater: [{ id, href, title, year, poster, rating, added }] · discoverNope: { id: { title, year, poster, t } }
  // discoverPrefs: { genre, minRating, always: "" | "now" | "later" | "open" }
  let later = [], nope = {}, prefs = { genre: "", minRating: 0, always: "" }, qpref = null;
  async function loadStore() {
    const r = await api.storage.local.get(["discoverLater", "discoverNope", "discoverPrefs", "qualityPref"]);
    later = Array.isArray(r.discoverLater) ? r.discoverLater : [];
    nope = r.discoverNope && typeof r.discoverNope === "object" ? r.discoverNope : {};
    prefs = { ...prefs, ...(r.discoverPrefs || {}) };
    qpref = r.qualityPref || null;
  }
  const saveLater = () => api.storage.local.set({ discoverLater: later }).catch(() => {});
  const saveNope = () => api.storage.local.set({ discoverNope: nope }).catch(() => {});
  const savePrefs = () => api.storage.local.set({ discoverPrefs: prefs }).catch(() => {});
  api.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch.discoverLater) later = ch.discoverLater.newValue || [];
    if (ch.discoverNope) nope = ch.discoverNope.newValue || {};
    if (ch.discoverPrefs) prefs = { ...prefs, ...(ch.discoverPrefs.newValue || {}) };
    if (ch.qualityPref) qpref = ch.qualityPref.newValue || null;
    if (open) paintHead();
  });

  // Favoritos (mismo formato que favorites.js)
  async function favArea() {
    const { favArea: where } = await api.storage.local.get("favArea");
    return where !== "local" && api.storage.sync ? api.storage.sync : api.storage.local;
  }
  async function addFav(d) {
    const id = titleId(d.href);
    if (!id) return;
    const u = new URL(d.href, location.href);
    const f = { id, url: u.pathname + u.search, title: d.title, poster: d.poster ? abs(d.poster) : "", year: d.year || "", type: "movie",
      tag: d.tag || null, genres: d.genres || [], rating: d.rating || null, seen: "", sig: "", updated: 0, seenUpdated: 0, checked: 0, news: null, added: Date.now() };
    await (await favArea()).set({ ["fav:" + id]: f }).catch(() => {});
  }
  const removeFav = async (d) => { const id = titleId(d.href); if (id) await (await favArea()).remove("fav:" + id).catch(() => {}); };

  // ------------------------------------------------------------ tus gustos
  let taste = null;      // { configured, genres: {canon: {w,n,seen,share,label}}, directors, decades, owned:Set }
  async function loadTaste() {
    let r = null;
    try { r = await api.runtime.sendMessage({ action: "media-taste" }); } catch (_) {}
    const t = { configured: !!r?.configured, servers: r?.servers || [], movies: r?.movies || 0, genres: {}, directors: {}, decades: {}, owned: new Set() };
    const totalW = Object.values(r?.genres || {}).reduce((a, x) => a + x.w, 0) || 1;
    for (const [name, x] of Object.entries(r?.genres || {})) {
      const c = canon(name);
      const g = t.genres[c] || (t.genres[c] = { w: 0, n: 0, seen: 0, label: name });
      g.w += x.w; g.n += x.n; g.seen += x.seen;
    }
    for (const g of Object.values(t.genres)) g.share = g.w / totalW;
    for (const [name, x] of Object.entries(r?.directors || {})) t.directors[norm(name)] = { ...x, name };
    const totalD = Object.values(r?.decades || {}).reduce((a, x) => a + x.w, 0) || 1;
    for (const [dec, x] of Object.entries(r?.decades || {})) t.decades[dec] = { ...x, share: x.w / totalD };
    for (const [ti, or, y] of r?.owned || []) for (const yy of [y - 1, y, y + 1]) { if (ti) t.owned.add(ti + "|" + yy); if (or) t.owned.add(or + "|" + yy); }
    taste = t;
  }
  const owned = (d) => taste?.owned.has(norm(d.title) + "|" + (Number(d.year) || 0));

  // Puntuación y el «porque…» de cada carta
  function judge(d) {
    const T = taste || { genres: {}, directors: {}, decades: {} };
    const why = [];
    let score = 0, best = null;
    for (const c of new Set((d.allGenres?.length ? d.allGenres : d.genres || []).map(canon))) {
      const g = T.genres[c];
      if (!g) continue;
      score += g.share * 2;
      if (!best || g.share > best.share) best = g;
    }
    const dirs = String(d.director || "").split(/\s*,\s*|\s+y\s+/).map((x) => x.trim()).filter(Boolean);
    const dir = dirs.map((x) => T.directors[norm(x)]).find(Boolean);
    if (dir) {
      score += 0.6 + Math.min(dir.n, 5) * 0.05;
      why.push(dir.seen ? `has visto ${plural(dir.seen, "película", "películas")} de ${dir.name}` : `tienes ${plural(dir.n, "película", "películas")} de ${dir.name}`);
    }
    if (best && best.share >= 0.04) {
      const g = best.label.toLowerCase();
      why.push(best.seen >= 2 ? `has visto ${best.seen} películas de ${g}` : `tienes ${best.n} películas de ${g}`);
    }
    const dec = d.year ? T.decades[String(Math.floor(Number(d.year) / 10) * 10)] : null;
    if (dec) {
      score += dec.share * 0.6;
      if (dec.share >= 0.25 && why.length < 2) why.push(`te van las de los ${String(Math.floor(Number(d.year) / 10) * 10).slice(2)}`);
    }
    const r = Number(d.rating);
    if (r) score += (r - 6) * 0.15;
    score += Math.random() * 0.15; // un poco de variedad
    return { score, why: why.slice(0, 2) };
  }

  // ------------------------------------------------------------ catálogo
  // Listados de Hispashare por género (los del menú «Películas»); si no se
  // encuentran, las novedades (solo películas).
  function siteGenres() {
    const block = $$(".EXPAND > div[id^='EXP_']").find((d) => /pel[ií]cula/i.test(txt($("span", d))));
    return block ? $$("a", block).map((a) => ({ name: txt(a), href: a.getAttribute("href") })).filter((x) => x.name && x.href) : [];
  }
  let sources = [];                 // { name, canon, next, pages, done }
  function buildSources() {
    const g = siteGenres();
    sources = g.length
      ? g.map((x) => ({ name: x.name, canon: canon(x.name), next: abs(x.href), pages: 0, done: false }))
      : [{ name: "Novedades", canon: "", next: abs("/"), pages: 0, done: false }];
  }
  function pickSource() {
    let list = sources.filter((s) => !s.done);
    if (prefs.genre) list = list.filter((s) => s.name === prefs.genre);
    if (!list.length) return null;
    const weight = (s) => {
      const g = taste?.genres[s.canon];
      return (g ? g.share : taste?.configured ? 0.005 : 0.05) / (s.pages + 1);
    };
    return list.sort((a, b) => weight(b) - weight(a))[0];
  }
  const MAX_PAGES = 30;
  async function loadFrom(src) {
    try {
      const res = await fetch(src.next, { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const rows = U.listRows(doc);
      const out = [];
      for (const tr of rows) { try { out.push(U.rowData(tr)); } catch (_) {} }
      const pag = $(".PAGINATION", doc);
      src.pages++;
      src.next = rows.length && pag ? U.nextPageUrl(pag, src.next) : null;
      if (!src.next || src.pages >= MAX_PAGES) src.done = true;
      return out;
    } catch (e) {
      src.done = true;
      console.warn("[UIspa] Qué veo esta noche:", e.message);
      return [];
    }
  }

  let queue = [], seen = new Set(), filling = null;
  const isLater = (d) => later.some((x) => x.href === d.href || x.id === titleId(d.href));
  function acceptable(d) {
    const id = titleId(d.href);
    if (!id || seen.has(id) || nope[id] || isLater(d) || d.type !== "movie" || owned(d)) return false;
    if (prefs.minRating && !(Number(d.rating) >= prefs.minRating)) return false;
    return true;
  }
  function fill() {
    if (filling) return filling;
    filling = (async () => {
      let tries = 0;
      while (queue.length < 8 && tries++ < 12) {
        const src = pickSource();
        if (!src) break;
        for (const d of await loadFrom(src)) {
          if (!acceptable(d)) continue;
          seen.add(titleId(d.href));
          queue.push({ ...d, poster: d.poster ? abs(d.poster) : "", ...judge(d) });
        }
        queue.sort((a, b) => b.score - a.score);
        if (open && !current) next();
      }
    })().finally(() => { filling = null; if (open) paint(); });
    return filling;
  }

  // ------------------------------------------------------------ pantalla
  let open = false, view, stage, laterBtn, undoBtn, notice, current = null, modal = null;
  const undoList = [];   // { kind: "no" | "fav" | "later" | "yes", d }

  function build() {
    const genreSel = h("select", { class: "hcm-disc-genre", "aria-label": "Género", onchange: (e) => { prefs.genre = e.target.value; savePrefs(); restart(); } },
      h("option", { value: "" }, "Cualquier género"),
      siteGenres().map((g) => h("option", { value: g.name }, g.name)));
    genreSel.value = prefs.genre || "";
    const rates = [[0, "Cualquier nota"], [6, "6+"], [6.5, "6,5+"], [7, "7+"], [7.5, "7,5+"]];
    const rateBox = h("div", { class: "hcm-disc-rates", role: "radiogroup", "aria-label": "Nota mínima" },
      rates.map(([v, l]) => h("button", { type: "button", class: "hcm-disc-chip", "data-v": String(v),
        onclick: () => { prefs.minRating = v; savePrefs(); restart(); } }, l)));
    laterBtn = h("button", { type: "button", class: "hcm-disc-later", onclick: () => showLater() });
    undoBtn = h("button", { type: "button", class: "hcm-disc-undo", title: "Deshacer la última (Retroceso)", onclick: () => undo() }, "↶ Deshacer");
    notice = h("p", { class: "hcm-disc-notice", hidden: true });
    stage = h("div", { class: "hcm-disc-stage" });
    const btn = (cls, icon, label, key, fn) => h("button", { type: "button", class: "hcm-disc-act " + cls, onclick: fn },
      h("i", {}, icon), h("span", {}, label), h("kbd", {}, key));
    view = h("section", { class: "hcm-disc", "aria-label": "¿Qué veo esta noche?" },
      h("div", { class: "hcm-disc-head" },
        h("h1", {}, "🎲 ¿Qué veo esta noche?"), genreSel, rateBox,
        h("div", { class: "hcm-disc-spacer" }), undoBtn, laterBtn,
        h("button", { type: "button", class: "hcm-disc-close", title: "Cerrar (Esc)", onclick: () => close() }, "✕")),
      notice, stage,
      h("div", { class: "hcm-disc-acts" },
        btn("hcm-disc-no", "✕", "Paso", "←", () => decide("no")),
        btn("hcm-disc-fav", "★", "Favorito", "↑", () => decide("fav")),
        btn("hcm-disc-yes", "♥", "Lo quiero", "→", () => decide("yes"))));
    document.getElementById("hcm-root").append(view);
  }
  function paintHead() {
    if (!view) return;
    laterBtn.textContent = "";
    laterBtn.append("📋 Para luego ", h("b", {}, String(later.length)));
    undoBtn.disabled = !undoList.length;
    $$(".hcm-disc-chip", view).forEach((b) => b.classList.toggle("hcm-on", Number(b.dataset.v) === Number(prefs.minRating || 0)));
  }

  function card(d) {
    const q = d.quality || "";
    const pref = q && qpref && U.qualityOf && U.matchesPref?.(U.qualityOf(q), qpref);
    const el = h("article", { class: "hcm-disc-card" },
      h("div", { class: "hcm-disc-poster" }, d.poster ? h("img", { src: d.poster, alt: "", draggable: "false" }) : h("span", {}, d.title)),
      h("div", { class: "hcm-disc-body" },
        h("div", { class: "hcm-disc-eyebrow" }, ["Película", d.year].filter(Boolean).join(" · ")),
        h("h2", {}, d.title),
        h("div", { class: "hcm-disc-meta" },
          d.rating ? h("span", { class: "hcm-disc-rate" }, "★ " + String(d.rating).replace(".", ",")) : null,
          (d.genres || []).length ? h("span", {}, d.genres.join(" · ")) : null,
          d.director ? h("span", { class: "hcm-disc-dir" }, "Dir. " + d.director) : null),
        d.why?.length ? h("div", { class: "hcm-disc-why" }, "Te la propongo porque ", d.why.map((w, i) => [i ? " y " : "", h("b", {}, w)]), ".") : null,
        d.synopsis ? h("p", { class: "hcm-disc-syn" }, d.synopsis) : null,
        q ? h("span", { class: "hcm-disc-q" + (pref ? " hcm-on" : "") }, (pref ? "★ Tu calidad: " : "Calidad: ") + q) : null),
      h("div", { class: "hcm-disc-stamp" }));
    swipe(el);
    return el;
  }
  function paint() {
    if (!view) return;
    paintHead();
    notice.hidden = !!taste?.configured;
    if (!taste?.configured) notice.textContent = "Conecta Plex o Jellyfin en los ajustes de UIspa para que te proponga según lo que ves. Mientras, te enseño las películas por nota.";
    if (current && stage.querySelector(".hcm-disc-card:not(.hcm-out)")?.__d === current) return;
    stage.querySelectorAll(".hcm-disc-card:not(.hcm-out), .hcm-disc-empty, .hcm-disc-back").forEach((x) => x.remove());
    if (!current) {
      const busy = !!filling || !taste;
      stage.append(h("div", { class: "hcm-disc-empty" }, busy
        ? [h("div", { class: "hcm-disc-spin" }), taste ? "Buscando películas para ti…" : "Leyendo tu biblioteca…"]
        : ["No quedan más películas con estos filtros.", h("small", {}, "Prueba otro género u otra nota mínima.")]));
      return;
    }
    stage.append(h("div", { class: "hcm-disc-back hcm-b2" }), h("div", { class: "hcm-disc-back hcm-b1" }));
    const c = card(current);
    c.__d = current;
    stage.append(c);
  }
  function next() {
    current = queue.shift() || null;
    paint();
    if (queue.length < 4) fill();
  }
  function restart() {
    queue = []; current = null; seen = new Set(); buildSources(); paint(); fill();
  }

  // Arrastrar la carta (ratón o dedo)
  function swipe(el) {
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
    const stamp = $(".hcm-disc-stamp", el);
    const which = () => dx > 70 ? "yes" : dx < -70 ? "no" : dy < -70 ? "fav" : null;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || modal) return;
      dragging = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      el.setPointerCapture(e.pointerId);
      el.classList.add("hcm-drag");
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      const w = which();
      stamp.className = "hcm-disc-stamp" + (w ? " hcm-" + w : "");
      stamp.textContent = { yes: "LO QUIERO", no: "PASO", fav: "FAVORITO" }[w] || "";
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("hcm-drag");
      const w = Math.abs(dx) > 130 || dy < -130 ? which() : null;
      if (w) decide(w);
      else { el.style.transform = ""; stamp.className = "hcm-disc-stamp"; stamp.textContent = ""; }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
  function flyOut(kind) {
    const el = stage.querySelector(".hcm-disc-card:not(.hcm-out)");
    if (!el) return;
    el.classList.add("hcm-out");
    const stamp = $(".hcm-disc-stamp", el);
    stamp.className = "hcm-disc-stamp hcm-" + kind;
    stamp.textContent = { yes: "LO QUIERO", no: "PASO", fav: "FAVORITO" }[kind];
    el.style.transform = kind === "yes" ? "translate(140%, 40px) rotate(24deg)" : kind === "no" ? "translate(-140%, 40px) rotate(-24deg)" : "translate(0, -130%) rotate(-4deg)";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 420);
  }

  // ------------------------------------------------------------ decisiones
  async function decide(kind) {
    const d = current;
    if (!d || modal) return;
    flyOut(kind);
    const id = titleId(d.href);
    if (kind === "no") {
      nope[id] = { title: d.title, year: d.year || "", poster: d.poster || "", href: d.href, t: Date.now() };
      saveNope();
      undoList.push({ kind, d });
      next();
    } else if (kind === "fav") {
      await addFav(d);
      toast("★ Añadida a favoritos");
      undoList.push({ kind, d });
      next();
    } else {
      undoList.push({ kind: "yes", d });
      next();
      const how = prefs.always || await ask(d);
      if (!how) { undoList.pop(); if (current) queue.unshift(current); current = d; paint(); return; } // cancelado: vuelve
      if (how === "later") addLater(d);
      else if (how === "open") window.open(abs(d.href), "_blank", "noopener");
      else chooser(d);
    }
    paintHead();
  }
  function addLater(d) {
    if (isLater(d)) return;
    later.unshift({ id: titleId(d.href), href: d.href, title: d.title, year: d.year || "", poster: d.poster || "", rating: d.rating || null, quality: d.quality || "", added: Date.now() });
    saveLater();
    undoList[undoList.length - 1] = { kind: "later", d };
    toast("📋 Guardada para luego");
    paintHead();
  }
  async function undo() {
    const last = undoList.pop();
    if (!last || modal) { if (last) undoList.push(last); return; }
    const id = titleId(last.d.href);
    if (last.kind === "no") { delete nope[id]; saveNope(); }
    else if (last.kind === "fav") await removeFav(last.d);
    else if (last.kind === "later") { later = later.filter((x) => x.id !== id); saveLater(); }
    if (current) queue.unshift(current);
    current = last.d;
    stage.querySelectorAll(".hcm-disc-card").forEach((x) => x.remove());
    paint();
  }

  // ------------------------------------------------------------ ventanas
  function openModal(content, onClose) {
    closeModal();
    const box = h("div", { class: "hcm-disc-modal", role: "dialog" }, content);
    const wrap = h("div", { class: "hcm-disc-dim", onclick: (e) => { if (e.target === wrap) closeModal(null); } }, box);
    modal = { wrap, onClose };
    html.append(wrap);
    return box;
  }
  function closeModal(value) {
    if (!modal) return;
    const m = modal;
    modal = null;
    m.wrap.remove();
    m.onClose?.(value);
  }

  // «Lo quiero»: ¿qué hacemos?
  function ask(d) {
    return new Promise((resolve) => {
      const always = h("input", { type: "checkbox" });
      const opt = (how, icon, title, sub, key) => h("button", { type: "button", class: "hcm-disc-opt", "data-how": how,
        onclick: () => { if (always.checked) { prefs.always = how; savePrefs(); } closeModal(how); } },
        h("i", {}, icon), h("span", {}, h("b", {}, title), h("small", {}, sub)), h("kbd", {}, key));
      const s = globalThis.__uispaSend?.status?.() || {};
      const where = s.nas ? "Eliges la calidad y la carpeta del NAS" : s.remote ? "Eliges la calidad y va a la descarga remota" : "Eliges la calidad y la copias o la abres en eMule";
      const box = openModal([
        h("h3", {}, `♥ «${d.title}»`), h("p", {}, "¿Qué hacemos con ella?"),
        opt("now", "📥", "Descargar ahora", where, "1"),
        opt("later", "📋", "Guardar en «Para luego»", "La descargas cuando quieras desde la lista", "2"),
        opt("open", "🔎", "Abrir la ficha", "En una pestaña nueva", "3"),
        h("label", { class: "hcm-disc-always" }, always, " Hacer siempre lo mismo y no volver a preguntar ", h("small", {}, "(se cambia en los ajustes)"))
      ], resolve);
      box.dataset.kind = "ask";
      $(".hcm-disc-opt", box).focus();
    });
  }

  // Ficha de la película: versiones con su calidad, tamaño y enlaces
  const GiB = 1024 ** 3;
  const sizeBytes = (t) => {
    const m = (t || "").replace(/\s+/g, " ").match(/([\d.,]+)\s*([KMGT])B/i);
    return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) * 1024 ** { K: 1, M: 2, G: 3, T: 4 }[m[2].toUpperCase()] : 0;
  };
  const fmtSize = (b) => !b ? "" : b >= GiB ? (b / GiB).toFixed(1).replace(".", ",") + " GB" : Math.round(b / 1024 ** 2) + " MB";
  async function fetchLinks(id, mask) {
    const res = await fetch(`${location.origin}/ajax/download.php?id=${id}&code=${mask}&nocache=${Math.random()}`, { credentials: "include" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const ta = doc.querySelector("#ELINKSLIST, textarea");
    return ((ta ? ta.value : doc.body.textContent || "").match(/(ed2k:\/\/\|file\|[^\n\r]+?\|\/)|(magnet:\?[^\s"'<>]+)/g) || []).map((s) => s.trim());
  }
  async function titleData(d) {
    const res = await fetch(abs(d.href), { credentials: "include" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const r2 = doc.querySelector("td.R2");
    const origP = r2 && $$("p.INFO", r2).find((p) => /T[íi]tulo original/i.test(txt($("strong", p))));
    const info = {
      title: d.title, year: Number(d.year) || null, type: "movie",
      originalTitle: origP ? txt(origP).replace(/^.*?:\s*/, "").replace(/\s*\([^)]*\)\s*$/, "") : "",
      imdb: (($("a[href*='imdb.com/title/']", doc)?.href || "").match(/tt\d+/) || [])[0] || null
    };
    const versions = [];
    for (const td of $$("table.T1 > tbody > tr > td, table.T1 > tr > td", doc)) {
      const h2 = $(":scope > h2", td);
      if (!h2) continue;
      const a = $$("a[href*='Download(']", td).map((x) => (x.getAttribute("href") || "").match(/Download\(\s*(\d+)\s*,\s*'([01]+)'/)).find(Boolean);
      if (!a) continue;
      const facts = U.versionFacts ? U.versionFacts(td) : {};
      const name = txt(h2);
      const q = U.qualityOf ? U.qualityOf([name, facts["Calidad"], facts["Formato"]].join(" ")) : null;
      const bytes = $$("td.SIZE", td).reduce((n, c) => n + sizeBytes(txt(c)), 0);
      versions.push({ gid: a[1], mask: "1".repeat(a[2].length), name, bytes, pref: !!(q && qpref && U.matchesPref?.(q, qpref)),
        meta: [fmtSize(bytes), facts["Ripper"] ? "por " + facts["Ripper"] : null, (facts["eLink puesto"] || "").replace(/\s*\(.*\)\s*$/, "") || null].filter(Boolean).join(" · ") });
    }
    // primero las de tu calidad
    versions.sort((x, y) => y.pref - x.pref);
    return { info, versions };
  }

  // Elegir calidad y mandarla
  async function chooser(d) {
    const s = globalThis.__uispaSend?.status?.() || {};
    const list = h("div", { class: "hcm-disc-vers" }, h("div", { class: "hcm-disc-loading" }, h("div", { class: "hcm-disc-spin" }), "Leyendo las versiones…"));
    const acts = h("div", { class: "hcm-disc-send" });
    const box = openModal([h("h3", {}, `📥 «${d.title}»`), h("p", {}, "Elige la calidad:"), list, acts,
      h("a", { class: "hcm-disc-link", href: abs(d.href), target: "_blank", rel: "noopener" }, "Abrir la ficha ↗")]);
    box.dataset.kind = "chooser";
    let data;
    try { data = await titleData(d); } catch (e) { list.textContent = "No se pudo leer la ficha: " + e.message; return; }
    if (!data.versions.length) { list.textContent = "Esta ficha no tiene descargas."; return; }
    // los enlaces se piden ya, para que Copiar y eMule funcionen al momento
    const links = new Map(data.versions.map((v) => [v.gid, fetchLinks(v.gid, v.mask).catch(() => [])]));
    const got = new Map();
    links.forEach((p, k) => p.then((l) => got.set(k, l)));
    let sel = data.versions[0];
    list.textContent = "";
    data.versions.forEach((v, i) => {
      const r = h("input", { type: "radio", name: "hcm-disc-ver", checked: i === 0, onchange: () => (sel = v) });
      list.append(h("label", { class: "hcm-disc-ver" + (v.pref ? " hcm-pref" : "") }, r,
        h("span", {}, h("b", {}, (v.pref ? "★ " : "") + v.name), h("small", {}, v.meta)),
        v.pref ? h("em", {}, "Tu calidad") : null));
    });
    const done = () => {
      const id = titleId(d.href);
      if (later.some((x) => x.id === id)) { later = later.filter((x) => x.id !== id); saveLater(); }
      closeModal();
      paintHead();
    };
    const linksOf = async () => got.get(sel.gid) || await links.get(sel.gid);
    const send = (cls, label, fn) => h("button", { type: "button", class: "hcm-disc-sendbtn " + cls, onclick: async (e) => {
      const b = e.currentTarget;
      if (b.disabled) return;
      b.disabled = true;
      try {
        const l = await linksOf();
        if (!l.length) { toast("No se han encontrado enlaces", true); return; }
        if (await fn(l, b)) done();
      } finally { b.disabled = false; }
    } }, label);
    const S = globalThis.__uispaSend;
    if (s.nas) acts.append(send("hcm-g", "📥 Al NAS", (l, b) => S.nas(l, data.info, b)));
    if (s.remote) acts.append(send("hcm-p", "🐳 Descarga remota", (l) => S.remote(l)));
    if (s.emule) acts.append(send("hcm-r", "▶ eMule", (l) => { S.emule(l); return true; }));
    acts.append(send("hcm-y", "📋 Copiar", (l) => S.copy(l, "")));
  }

  // Lista «Para luego»
  function showLater() {
    const ul = h("ul", { class: "hcm-disc-list" });
    const render = () => {
      ul.textContent = "";
      if (!later.length) { ul.append(h("li", { class: "hcm-disc-none" }, "Todavía no has guardado ninguna. Dale a ♥ «Lo quiero» y elige «Para luego».")); return; }
      for (const x of later) {
        ul.append(h("li", {},
          x.poster ? h("img", { src: x.poster, alt: "" }) : h("span", { class: "hcm-disc-noimg" }),
          h("span", { class: "hcm-disc-li" }, h("b", {}, x.title), h("small", {}, [x.year, x.rating ? "★ " + String(x.rating).replace(".", ",") : null, x.quality].filter(Boolean).join(" · "))),
          h("button", { type: "button", class: "hcm-disc-sendbtn hcm-g", onclick: () => { closeModal(); chooser(x); } }, "📥 Descargar"),
          h("a", { class: "hcm-disc-sendbtn", href: abs(x.href), target: "_blank", rel: "noopener" }, "Ficha ↗"),
          h("button", { type: "button", class: "hcm-disc-sendbtn", title: "Quitar de la lista", onclick: () => { later = later.filter((y) => y.id !== x.id); saveLater(); render(); paintHead(); } }, "✕")));
      }
    };
    render();
    openModal([h("h3", {}, "📋 Para luego"), h("p", {}, "Películas que te guardaste desde «¿Qué veo esta noche?»."), ul]).classList.add("hcm-wide");
  }

  // ------------------------------------------------------------ abrir / cerrar
  async function show() {
    if (open) return;
    open = true;
    html.classList.add("hcm-disc-open");
    scrollTo(0, 0);
    if (!view) build();
    view.hidden = false;
    document.title = "¿Qué veo esta noche? · HispaShare";
    paint();
    await loadStore();
    paintHead();
    if (!taste) { await loadTaste(); paint(); }
    if (!sources.length) buildSources();
    if (!current) { if (queue.length) next(); else fill(); }
  }
  function close() {
    if (!open) return;
    open = false;
    closeModal(null);
    html.classList.remove("hcm-disc-open");
    if (view) view.hidden = true;
    if (location.hash === "#que-veo") window.history.replaceState(null, "", location.pathname + location.search);
    document.title = document.title.replace(/^¿Qué veo esta noche\? · /, "");
  }
  const sync = () => (location.hash === "#que-veo" ? show() : close());
  addEventListener("hashchange", sync);
  sync();

  addEventListener("keydown", (e) => {
    if (!open || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "checkbox" && t.type !== "radio") return;
    if (document.querySelector(".hc-nas-pop")) return;   // el recuadro del NAS tiene sus teclas
    if (modal) {
      if (e.key === "Escape") { e.preventDefault(); closeModal(null); return; }
      const box = modal.wrap.querySelector(".hcm-disc-modal");
      if (box?.dataset.kind === "ask" && /^[123]$/.test(e.key)) { e.preventDefault(); $$(".hcm-disc-opt", box)[Number(e.key) - 1]?.click(); }
      return;
    }
    const k = { ArrowLeft: "no", ArrowRight: "yes", ArrowUp: "fav" }[e.key];
    if (k) { e.preventDefault(); decide(k); }
    else if (e.key === "Backspace" || e.key === "z") { e.preventDefault(); undo(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
})();
