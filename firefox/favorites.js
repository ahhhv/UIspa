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

  // ------------------------------------------------------------ fechas de actualización
  // Ficha: cada versión pone «eLink puesto: 3 meses y 24 días (16/07/2026)».
  // La más reciente es la última vez que se publicó algo en ese título.
  function lastUpdate(doc) {
    let max = 0;
    const text = (doc.body || doc).textContent || "";
    for (const m of text.matchAll(/eLink puesto:[^()]*\((\d{1,2})\/(\d{1,2})\/(\d{4})\)/g)) {
      const t = new Date(+m[3], +m[2] - 1, +m[1], 12).getTime();
      if (t > max) max = t;
    }
    return max;
  }
  // Listados: «Última publicación: hoy / ayer / 5 días / 2 semanas / 3 meses y 4 días…»
  // Se pasa a una fecha aproximada (a mediodía, para no bailar por la hora).
  function fromRelative(raw) {
    const s = String(raw || "").toLowerCase();
    if (!s) return 0;
    const day = 864e5, noon = new Date(); noon.setHours(12, 0, 0, 0);
    if (/^hoy/.test(s)) return noon.getTime();
    if (/^ayer/.test(s)) return noon.getTime() - day;
    const exact = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (exact) return new Date(+exact[3], +exact[2] - 1, +exact[1], 12).getTime();
    let days = 0, any = false;
    for (const [, n, u] of s.matchAll(/(\d+)\s*(a[ñn]o|mes|semana|d[ií]a|hora|minuto)/g)) {
      any = true;
      days += +n * ({ "a": 365, "m": 30, "s": 7, "d": 1 }[u[0]] || 0);
    }
    return any ? noon.getTime() - days * day : 0;
  }
  function whenText(t) {
    if (!t) return "";
    const day = 864e5, today = new Date(); today.setHours(12, 0, 0, 0);
    const d = Math.round((today - t) / day);
    if (d <= 0) return "hoy";
    if (d === 1) return "ayer";
    if (d < 7) return `hace ${d} días`;
    const date = new Date(t);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
  }

  // Datos para pintar la tarjeta (nota, géneros, temporadas) leídos del HTML
  // original de una ficha: el que se descarga al revisar novedades o el de la
  // página abierta (la vista moderna lo deja oculto, no lo borra).
  const splitTitle = (t) => globalThis.__uispa?.splitTitle?.(t) || { title: t, tag: null };
  function metaFromDoc(doc) {
    const r2 = doc.querySelector("td.R2");
    const h1 = r2?.querySelector("h1");
    if (!h1) return {};
    const small = txt(h1.querySelector("small"));
    const { title, tag } = splitTitle(txt(h1).replace(small, "").trim());
    const stars = doc.querySelector("#STARS_CONTAINER .SEP");
    const rating = (txt(stars).match(/(\d+(?:[.,]\d+)?)\s*$/) || [])[1]?.replace(",", ".") || null;
    const genreP = [...r2.querySelectorAll("p.INFO")].find((p) => /^G[ée]nero/i.test(txt(p.querySelector("strong"))));
    const genres = genreP ? [...genreP.querySelectorAll("a")].map(txt).filter(Boolean).slice(0, 2) : [];
    const out = { title, tag, genres };
    const year = (small.match(/\b(19|20)\d{2}\b/) || [])[0];
    if (year) out.year = year;
    if (rating) out.rating = rating;
    return out;
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
    const updated = lastUpdate(document);
    const meta = { ...splitTitle(title), ...metaFromDoc(document) };
    const data = () => ({ url: location.pathname + location.search, title, poster: abs(poster), year, type, ...meta, seen: sig, sig, updated, seenUpdated: updated, checked: Date.now(), news: null });
    const btn = starButton("hcm-fav-btn", id, data);
    const slot = $(".hcm-scores") || $("td.R2 h1");
    if (slot?.matches(".hcm-scores")) slot.append(btn); else slot?.after(btn);
    // Al abrir la ficha de un favorito, lo nuevo pasa a «visto»
    if (isFav(id)) {
      const f = { ...favs[id], title, poster: abs(poster) || favs[id].poster, year: year || favs[id].year, ...meta, seen: sig, sig,
        updated: updated || favs[id].updated || 0, seenUpdated: updated || favs[id].updated || 0, checked: Date.now(), news: null };
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
        ...(card.__uispa ? { title: card.__uispa.title, tag: card.__uispa.tag, genres: card.__uispa.genres, rating: card.__uispa.rating } : {}),
        seen: "", sig: "", updated: fromRelative(card.dataset.last), seenUpdated: 0, checked: 0, news: null
      });
      (card.querySelector(".poster-wrapper") || card).append(starButton("hcm-fav-toggle", id, data));
    }
    noteListDates(root);
  }

  // Los listados (portada, búsquedas) dicen cuándo se publicó algo por última
  // vez en cada título. Si un favorito sale con una fecha más reciente que la
  // que conocemos, se apunta y se revisa su ficha en cuanto se pueda.
  function noteListDates(root = document) {
    const changed = [];
    for (const card of $$("a.hcm-card[data-last]", root)) {
      const id = titleId(card.getAttribute("href"));
      const f = id && favs[id];
      if (!f) continue;
      const t = fromRelative(card.dataset.last);
      // margen de un día: «hoy»/«ayer» son aproximados
      if (t && t > (f.updated || 0) + 864e5 / 2) changed.push({ ...f, updated: t, checked: 0 });
    }
    if (!changed.length) return;
    for (const f of changed) favs[f.id] = f;
    save(changed);
    renderRow();
    checkNews();
  }

  // ------------------------------------------------------------ fila de favoritos (portada)
  // Portada = sin parámetros, o solo «page=1». Se lee el texto de la dirección:
  // en Firefox, los iteradores de URLSearchParams no se pueden recorrer desde
  // una extensión («p.keys() is not iterable»).
  const isHome = () => {
    const parts = location.search.replace(/^\?/, "").split("&").filter(Boolean);
    return /^\/(index\.php)?$/.test(location.pathname) && parts.every((x) => x === "page=1");
  };
  let row;
  function renderRow() {
    if (!redesign() || !isHome()) return;
    const grid = $(".hcm-grid");
    if (!grid) return;
    // los más recientemente actualizados primero (los que no tienen fecha, al final)
    const list = Object.values(favs).sort((a, b) => (b.updated || 0) - (a.updated || 0) || (!!b.news - !!a.news) || (b.added || 0) - (a.added || 0));
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
    const build = globalThis.__uispa?.buildCard;
    for (const f of list) strip.append(build ? favCard(f, build) : favItem(f));
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

  // Tarjeta del favorito: la misma de la rejilla (sigue el tamaño de carátula y
  // de texto de los ajustes), con la novedad y la fecha de la última publicación.
  function favCard(f, build) {
    const recent = f.updated && Date.now() - f.updated < 2 * 864e5;
    const when = f.updated ? "↻ " + whenText(f.updated) : "";
    const extra = (f.news || when) ? h("div", "card-fav-when" + (recent ? " hcm-fav-recent" : ""),
      [f.news ? "✨ " + f.news : null, when].filter(Boolean).join(" · ")) : null;
    const { title, tag } = f.tag !== undefined ? { title: f.title, tag: f.tag } : splitTitle(f.title);
    const a = build({ href: f.url, title, year: f.year, type: f.type, tag, genres: f.genres || [], rating: f.rating,
      poster: f.poster, badge: f.news ? "nuevo" : null, extra });
    a.classList.add("hcm-fav-card");
    if (f.news) a.classList.add("hcm-fav-new");
    a.title += (f.news ? ` · ${f.news}` : "") + (f.updated ? ` · actualizado ${whenText(f.updated)}` : "");
    a.querySelector(".poster-wrapper").append(starButton("hcm-fav-toggle", f.id, () => f));
    return a;
  }
  // Por si la vista moderna aún no ha cargado sus tarjetas
  function favItem(f) {
    const a = h("a", "hcm-fav-item" + (f.news ? " hcm-fav-new" : ""));
    a.href = f.url;
    a.dataset.type = f.type || "movie";
    const pic = h("div", "hcm-fav-pic");
    if (f.poster) { const img = h("img"); img.src = f.poster; img.alt = ""; img.loading = "lazy"; pic.append(img); }
    if (f.news) pic.append(h("span", "hcm-fav-badge", "nuevo"));
    pic.append(starButton("hcm-fav-toggle", f.id, () => f));
    const cap = h("div", "hcm-fav-cap");
    cap.append(h("span", "hcm-fav-name", f.title));
    cap.append(h("span", "hcm-fav-what", f.news || [{ movie: "Película", series: "Serie", doc: "Documental", music: "Música" }[f.type], f.year].filter(Boolean).join(" · ")));
    if (f.updated) cap.append(h("span", "hcm-fav-when", "↻ " + whenText(f.updated)));
    pic.append(cap);
    a.append(pic);
    return a;
  }

  // ------------------------------------------------------------ novedades (una vez al día)
  const DAY = 20 * 3600 * 1000;
  let checking = false;
  async function checkNews() {
    if (!isHome() || checking) return;
    checking = true;
    try { await runCheck(); } finally { checking = false; }
  }
  async function runCheck() {
    const { favCheckOff } = await api.storage.local.get("favCheckOff");
    if (favCheckOff) return;
    // favoritos de antes de guardar la fecha (sin «updated»): se revisan ya, una vez
    const due = Object.values(favs).filter((f) => f.updated === undefined || Date.now() - (f.checked || 0) > DAY).slice(0, 30);
    if (!due.length) return;
    const changed = [];
    for (const f of due) {
      try {
        const res = await fetch(f.url, { credentials: "include" });
        if (!res.ok) continue;
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const sig = signature(doc);
        if (!sig) { changed.push({ ...f, updated: f.updated || 0, checked: Date.now() }); continue; }   // sin descargas (o sin sesión)
        const updated = lastUpdate(doc) || f.updated || 0;
        const meta = metaFromDoc(doc);
        // primer chequeo de un favorito marcado desde la portada: se toma como punto de partida
        const seen = f.seen || sig;
        // la primera vez que se conoce la fecha, es el punto de partida
        const seenUpdated = f.seenUpdated || updated;
        // si ha cambiado la huella, se dice qué; si solo ha cambiado la fecha
        // (enlaces sustituidos, misma cantidad), «actualizado»
        const news = diff(seen, sig) || (seenUpdated && updated > seenUpdated + 864e5 / 2 ? "actualizado" : null) || f.news || null;
        changed.push({ ...f, ...meta, seen, sig, updated, seenUpdated, news, checked: Date.now() });
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
      if (grid) new MutationObserver(() => decorateCards(grid)).observe(grid, { childList: true, subtree: true });   // también dentro de las filas del diseño «Streaming»
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
