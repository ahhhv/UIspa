// UIspa · favoritos.
// ☆ en la ficha y en las tarjetas para marcar películas y series; una fila
// «Tus favoritos» al principio de la portada. Se guardan con la cuenta del
// navegador (storage.sync) para tenerlos en todos tus ordenadores.
// Una vez al día, desde la portada, se mira si tus favoritos tienen versiones
// o capítulos nuevos desde la última vez que abriste su ficha.
(() => {
  if (document.documentElement.dataset.uispaFav) return;
  document.documentElement.dataset.uispaFav = "1";
  const api = typeof browser !== "undefined" ? browser : chrome;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const html = document.documentElement;
  const redesign = () => html.classList.contains("hcm") && !!$("#hcm-root");

  // ------------------------------------------------------------ almacenamiento
  // Una clave por favorito ("fav:123"): storage.sync limita el tamaño de cada clave.
  // Dónde se guardan lo eliges en los ajustes: en tu cuenta del navegador
  // (sincronizado, por defecto) o solo en este navegador.
  let area = api.storage.local, areaName = "local";
  const PREFIX = "fav:";
  let favs = {};                                    // id → favorito
  async function pickArea() {
    const { favArea } = await api.storage.local.get("favArea");
    const sync = favArea !== "local" && api.storage.sync;
    area = sync ? api.storage.sync : api.storage.local;
    areaName = sync ? "sync" : "local";
  }
  async function load() {
    await pickArea();
    let all;
    try { all = await area.get(null); }
    catch (_) { area = api.storage.local; areaName = "local"; all = await area.get(null); }
    favs = {};
    for (const [k, v] of Object.entries(all || {})) if (k.startsWith(PREFIX) && v?.id) favs[v.id] = v;
  }
  const save = (list) => area.set(Object.fromEntries(list.map((f) => [PREFIX + f.id, f])));
  const remove = (id) => area.remove(PREFIX + id);

  const titleId = (href) => (String(href || "").match(/[?&]id=(\d+)/) || [])[1] || null;
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (_) { return u || ""; } };
  const isFav = (id) => !!favs[id];

  // Huella de las descargas de una ficha: id de cada versión y número de archivos
  function signature(doc) {
    const m = new Map();
    for (const a of $$("a[href^='javascript:Download(']", doc)) {
      const mm = a.getAttribute("href").match(/Download\((\d+),\s*'([01]+)'\)/);
      if (mm) m.set(mm[1], mm[2].length);
    }
    return [...m].map(([id, n]) => `${id}:${n}`).sort().join(",");
  }
  // Qué ha cambiado entre dos huellas: «nueva versión», «+2 capítulos»…
  function diff(oldSig, newSig) {
    const parse = (s) => new Map((s || "").split(",").filter(Boolean).map((x) => x.split(":")).map(([id, n]) => [id, Number(n)]));
    const a = parse(oldSig), b = parse(newSig);
    let versions = 0, files = 0;
    for (const [id, n] of b) {
      if (!a.has(id)) versions++;
      else if (n > a.get(id)) files += n - a.get(id);
    }
    if (!versions && !files) return null;
    return [versions ? (versions === 1 ? "nueva versión" : `${versions} versiones nuevas`) : null,
      files ? `+${files} ${files === 1 ? "archivo" : "archivos"}` : null].filter(Boolean).join(" · ");
  }

  // ------------------------------------------------------------ estrella
  function starButton(cls, id, getData) {
    const b = h("button", cls);
    b.type = "button";
    const paint = () => {
      const on = isFav(id);
      b.classList.toggle("hcm-fav-on", on);
      b.title = on ? "Quitar de favoritos" : "Añadir a favoritos";
      b.setAttribute("aria-pressed", String(on));
      if (cls.includes("hcm-fav-btn")) {
        b.textContent = "";
        b.append(h("span", "hcm-fav-ico", on ? "★" : "☆"), h("span", "hcm-fav-txt", on ? "En favoritos" : "Añadir a favoritos"));
      } else {
        b.textContent = on ? "★" : "☆";
      }
    };
    const pop = () => { b.classList.remove("hcm-fav-pop"); void b.offsetWidth; b.classList.add("hcm-fav-pop"); };
    b.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isFav(id)) {
        delete favs[id];
        await remove(id);
        toast("Quitado de favoritos");
      } else {
        const f = { ...getData(), id, added: Date.now() };
        favs[id] = f;
        await save([f]);
        toast("★ Añadido a favoritos");
        pop();
      }
      refreshAll();
    });
    b.__paint = paint;
    paint();
    return b;
  }
  function toast(msg) {
    let t = document.getElementById("hc-toast");
    if (!t) { t = h("div"); t.id = "hc-toast"; html.appendChild(t); }
    t.textContent = msg;
    t.className = "hc-show";
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.className = ""), 1800);
  }
  const refreshAll = () => {
    $$(".hcm-fav-toggle, .hcm-fav-btn").forEach((b) => b.__paint?.());
    renderRow();
  };

  // ------------------------------------------------------------ ficha
  function onTitlePage() {
    const id = new URLSearchParams(location.search).get("view") === "title" ? titleId(location.href) : null;
    if (!id) return;
    const title = txt($(".hcm-title")) || txt($("td.R2 h1"));
    if (!title) return;
    const poster = $(".hcm-hero-cover img")?.getAttribute("src") || $("td.L2 img, td.L1 img")?.getAttribute("src") || "";
    const eyebrow = txt($(".hcm-eyebrow"));
    const year = (eyebrow.match(/\b(19|20)\d{2}\b/) || txt($("td.R2 h1 small")).match(/\b(19|20)\d{2}\b/) || [])[0] || "";
    const type = /serie/i.test(eyebrow) ? "series" : /docu/i.test(eyebrow) ? "doc" : /m[uú]sica/i.test(eyebrow) ? "music" : "movie";
    const sig = signature(document);
    const data = () => ({ url: location.pathname + location.search, title, poster: abs(poster), year, type, seen: sig, sig, checked: Date.now(), news: null });
    const btn = starButton("hcm-fav-btn", id, data);
    const slot = $(".hcm-scores") || $("td.R2 h1");
    if (slot?.matches(".hcm-scores")) slot.append(btn); else slot?.after(btn);
    // Al abrir la ficha de un favorito, lo nuevo pasa a «visto»
    if (isFav(id)) {
      const f = { ...favs[id], title, poster: abs(poster) || favs[id].poster, year: year || favs[id].year, seen: sig, sig, checked: Date.now(), news: null };
      favs[id] = f;
      save([f]);
    }
  }

  // ------------------------------------------------------------ tarjetas
  function decorateCards(root = document) {
    for (const card of $$("a.hcm-card", root)) {
      if (card.querySelector(".hcm-fav-toggle")) continue;
      const id = titleId(card.getAttribute("href"));
      if (!id) continue;
      const data = () => ({
        url: new URL(card.href).pathname + new URL(card.href).search,
        title: txt(card.querySelector(".card-title")) || card.title,
        poster: abs(card.querySelector("img")?.getAttribute("src")),
        year: (txt(card.querySelector(".card-meta")).match(/\b(19|20)\d{2}\b/) || [])[0] || "",
        type: card.dataset.type || "movie",
        seen: "", sig: "", checked: 0, news: null
      });
      (card.querySelector(".poster-wrapper") || card).append(starButton("hcm-fav-toggle", id, data));
    }
  }

  // ------------------------------------------------------------ fila de favoritos (portada)
  const isHome = () => {
    const p = new URLSearchParams(location.search);
    return [...p.keys()].every((k) => k === "page") && (p.get("page") || "1") === "1" && /^\/(index\.php)?$/.test(location.pathname);
  };
  let row;
  function renderRow() {
    if (!redesign() || !isHome()) return;
    const grid = $(".hcm-grid");
    if (!grid) return;
    const list = Object.values(favs).sort((a, b) => (!!b.news - !!a.news) || (b.added || 0) - (a.added || 0));
    if (!row) {
      row = h("section", "hcm-favs");
      const toolbar = $(".hcm-toolbar");
      (toolbar || grid).before(row);
    }
    row.hidden = !list.length;
    const keep = row.querySelector(".hcm-favs-row")?.scrollLeft || 0;
    row.textContent = "";
    if (!list.length) return;
    const news = list.filter((f) => f.news).length;
    const head = h("div", "hcm-favs-head");
    const titles = h("div", "hcm-favs-titles");
    titles.append(h("h2", "hcm-favs-title", "Tus favoritos"),
      h("span", "hcm-favs-sub", `${list.length} ${list.length === 1 ? "título" : "títulos"}${news ? "" : " · sin novedades"}`));
    head.append(h("span", "hcm-favs-star", "★"), titles);
    if (news) head.append(h("span", "hcm-favs-news", `✨ ${news} con novedades`));
    const nav = h("div", "hcm-favs-nav");
    const prev = h("button", "hcm-favs-arrow", "‹"), next = h("button", "hcm-favs-arrow", "›");
    prev.type = next.type = "button";
    prev.title = "Anteriores"; next.title = "Siguientes";
    nav.append(prev, next);
    head.append(nav);
    const strip = h("div", "hcm-favs-row");
    for (const f of list) {
      const a = h("a", "hcm-fav-item" + (f.news ? " hcm-fav-new" : ""));
      a.href = f.url;
      a.dataset.type = f.type || "movie";
      a.title = f.title + (f.year ? ` (${f.year})` : "") + (f.news ? ` · ${f.news}` : "");
      const pic = h("div", "hcm-fav-pic");
      if (f.poster) { const img = h("img"); img.src = f.poster; img.alt = ""; img.loading = "lazy"; pic.append(img); }
      if (f.news) pic.append(h("span", "hcm-fav-badge", "nuevo"));
      pic.append(starButton("hcm-fav-toggle", f.id, () => f));
      const cap = h("div", "hcm-fav-cap");
      cap.append(h("span", "hcm-fav-name", f.title));
      cap.append(h("span", "hcm-fav-what", f.news || [{ movie: "Película", series: "Serie", doc: "Documental", music: "Música" }[f.type], f.year].filter(Boolean).join(" · ")));
      pic.append(cap);
      a.append(pic);
      strip.append(a);
    }
    row.append(head, strip);
    strip.scrollLeft = keep;
    const step = () => Math.max(200, strip.clientWidth * 0.8);
    prev.addEventListener("click", () => strip.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => strip.scrollBy({ left: step(), behavior: "smooth" }));
    const arrows = () => {
      const over = strip.scrollWidth > strip.clientWidth + 4;
      nav.hidden = !over;
      prev.disabled = strip.scrollLeft < 4;
      next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
      strip.classList.toggle("hcm-at-end", !over || next.disabled);
    };
    strip.addEventListener("scroll", arrows, { passive: true });
    row.__arrows = arrows;
    if (!row.__resize) { row.__resize = true; addEventListener("resize", () => row.__arrows?.(), { passive: true }); }
    requestAnimationFrame(arrows);
  }

  // ------------------------------------------------------------ novedades (una vez al día)
  const DAY = 20 * 3600 * 1000;
  async function checkNews() {
    if (!isHome()) return;
    const { favCheckOff } = await api.storage.local.get("favCheckOff");
    if (favCheckOff) return;
    const due = Object.values(favs).filter((f) => Date.now() - (f.checked || 0) > DAY).slice(0, 30);
    if (!due.length) return;
    const changed = [];
    for (const f of due) {
      try {
        const res = await fetch(f.url, { credentials: "include" });
        if (!res.ok) continue;
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const sig = signature(doc);
        if (!sig) { changed.push({ ...f, checked: Date.now() }); continue; }   // sin descargas (o sin sesión)
        // primer chequeo de un favorito marcado desde la portada: se toma como punto de partida
        const seen = f.seen || sig;
        const news = diff(seen, sig) || f.news || null;
        changed.push({ ...f, seen, sig, news, checked: Date.now() });
      } catch (_) { /* sin conexión: se reintenta otro día */ }
      await new Promise((r) => setTimeout(r, 1200));     // sin agobiar a la web
    }
    if (!changed.length) return;
    for (const f of changed) if (favs[f.id]) favs[f.id] = f;
    await save(changed.filter((f) => favs[f.id]));
    renderRow();
  }

  // ------------------------------------------------------------ arranque
  async function start() {
    await load();
    onTitlePage();
    if (redesign()) {
      decorateCards();
      renderRow();
      // tarjetas que llegan con el scroll infinito
      const grid = $(".hcm-grid");
      if (grid) new MutationObserver(() => decorateCards(grid)).observe(grid, { childList: true });
    }
    checkNews();
  }
  // cambios desde otra pestaña, otro ordenador o los ajustes
  api.storage.onChanged.addListener(async (changes, where) => {
    if (where === "local" && changes.favArea) { await load(); refreshAll(); return; }
    if (where !== areaName || !Object.keys(changes).some((k) => k.startsWith(PREFIX))) return;
    for (const [k, c] of Object.entries(changes)) {
      if (!k.startsWith(PREFIX)) continue;
      const id = k.slice(PREFIX.length);
      if (c.newValue) favs[id] = c.newValue; else delete favs[id];
    }
    refreshAll();
  });
  start();
})();
