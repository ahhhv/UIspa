// UIspa TV: Hispashare como una tele antigua, a pantalla completa.
//   · Canales: 1 Lo que te falta · 2 Novedades · 3 Películas · 4 Series · 5 Documentales · 6 Favoritos
//   · ◀▶ (o CH+/CH−) cambian de canal; ▲▼ hacen zapping entre títulos; 1-6 van a un canal
//   · OK abre la ficha a pantalla completa: versiones, capítulos (en tu Plex / te faltan)
//     y botones de colores: NAS (verde), eMule (rojo), Copiar (amarillo), Favorito (azul)
//   · Se enciende con la tecla T, desde el menú ◐ o poniendo el navegador en pantalla completa
//   · Teclado, mando de la tele (HDMI-CEC) o mando de consola. Sonido desactivado (tecla S)
(() => {
  "use strict";
  const html = document.documentElement;
  if (!html.classList.contains("hcm") || !document.getElementById("hcm-root")) return; // necesita el rediseño
  const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const me = ext?.runtime?.id || "uispa";
  if (html.dataset.uispaOwner && html.dataset.uispaOwner !== me) return;
  if (window.__uispaTv) return;
  window.__uispaTv = true;
  const U = globalThis.__uispa || {};
  if (!U.rowData || !U.listRows) return;

  // ------------------------------------------------------------ utilidades
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  function h(tag, cls, ...kids) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k);
    return el;
  }
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} },
  };
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (_) { return u || ""; } };
  const titleId = (href) => (String(href || "").match(/[?&]id=(\d+)/) || [])[1] || null;
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const isTitlePage = () => /[?&]view=title\b/.test(location.search);

  // ------------------------------------------------------------ estado (dura lo que la pestaña)
  const KEY = "uispa-tv";            // { on: "on" | "auto", ch, pos: {ch: índice}, view: "zap" | "ficha", ficha: url }
  const NOFS = "uispa-tv-nofs";      // lo apagaste a mano estando en pantalla completa
  const FEED = "uispa-tv-feed";      // títulos de las novedades ya leídos
  const MISS = "uispa-tv-miss";      // resultado de «Lo que te falta»
  let st = ss.get(KEY) || null;
  const save = () => ss.set(KEY, st);

  const CHANNELS = [
    { n: 1, id: "miss", name: "LO QUE TE FALTA" },
    { n: 2, id: "new", name: "NOVEDADES" },
    { n: 3, id: "movie", name: "PELÍCULAS" },
    { n: 4, id: "series", name: "SERIES" },
    { n: 5, id: "doc", name: "DOCUMENTALES" },
    { n: 6, id: "fav", name: "FAVORITOS" },
  ];
  const chan = (n) => CHANNELS.find((c) => c.n === n) || CHANNELS[1];

  // ------------------------------------------------------------ sonido (apagado salvo que lo actives)
  let soundOn = ls.get("uispa-tv-sound") === "1";
  let actx = null;
  function audio() {
    if (!soundOn) return null;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
    if (actx.state === "suspended") actx.resume().catch(() => {});
    return actx;
  }
  function hiss(ms = 380, vol = 0.09) {
    const a = audio();
    if (!a) return;
    const len = Math.floor(a.sampleRate * ms / 1000);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 0.6;
    const g = a.createGain(); g.gain.value = vol;
    src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
  }
  function thunk(up = true) {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(up ? 70 : 140, t);
    o.frequency.exponentialRampToValueAtTime(up ? 140 : 40, t + 0.25);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.32);
    if (up) {   // el pitido agudo de los tubos al encenderse
      const w = a.createOscillator(), wg = a.createGain();
      w.frequency.value = 15200; wg.gain.setValueAtTime(0.015, t); wg.gain.exponentialRampToValueAtTime(0.0005, t + 1.2);
      w.connect(wg).connect(a.destination); w.start(t); w.stop(t + 1.2);
    }
    hiss(up ? 250 : 180, 0.05);
  }
  const blip = () => { const a = audio(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = "square"; o.frequency.value = 880; g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.07); };

  // ------------------------------------------------------------ datos: novedades
  // Una sola lista (las novedades de la portada, página a página); Películas,
  // Series y Documentales son esa misma lista filtrada por tipo.
  const FEED_TTL = 20 * 60e3, MAX_PAGES = 25;
  let feed = ss.get(FEED);
  if (!feed || Date.now() - feed.t > FEED_TTL) feed = { t: Date.now(), rows: [], next: "/", pages: 0 };
  let feedBusy = null;
  const keepRow = (d) => ({ href: d.href, title: d.title, year: d.year, type: d.type, tag: d.tag, genres: d.genres, rating: d.rating,
    poster: d.poster ? abs(d.poster) : "", badge: d.badge, last: d.last, synopsis: d.synopsis, quality: d.quality });
  function loadPage() {
    if (feedBusy) return feedBusy;
    if (!feed.next || feed.pages >= MAX_PAGES) return Promise.resolve(false);
    feedBusy = (async () => {
      try {
        const res = await fetch(feed.next, { credentials: "include" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const rows = U.listRows(doc);
        const seen = new Set(feed.rows.map((r) => r.href));
        for (const tr of rows) {
          try {
            const d = keepRow(U.rowData(tr));
            if (!seen.has(d.href)) { seen.add(d.href); feed.rows.push(d); }
          } catch (_) {}
        }
        const pag = $(".PAGINATION", doc);
        feed.next = rows.length && pag ? U.nextPageUrl(pag, feed.next) : null;
        feed.pages++;
        ss.set(FEED, feed);
        return true;
      } catch (e) {
        console.warn("[UIspa TV] novedades:", e.message);
        return false;
      } finally { feedBusy = null; }
    })();
    return feedBusy;
  }

  // ------------------------------------------------------------ datos: favoritos
  let favs = {};
  let favArea = ext?.storage?.local;
  async function loadFavs() {
    if (!ext?.storage) return;
    try {
      const { favArea: where } = await ext.storage.local.get("favArea");
      favArea = where !== "local" && ext.storage.sync ? ext.storage.sync : ext.storage.local;
      const all = await favArea.get(null);
      favs = {};
      for (const [k, v] of Object.entries(all || {})) if (k.startsWith("fav:") && v?.id) favs[v.id] = v;
    } catch (_) {}
  }
  const isFav = (href) => !!favs[titleId(href)];
  async function toggleFav(d) {
    const id = titleId(d.href);
    if (!id || !favArea) return;
    if (favs[id]) {
      delete favs[id];
      await favArea.remove("fav:" + id).catch(() => {});
      return false;
    }
    const u = new URL(d.href, location.href);
    const f = { id, url: u.pathname + u.search, title: d.title, poster: d.poster ? abs(d.poster) : "", year: d.year || "", type: d.type || "movie",
      tag: d.tag || null, genres: d.genres || [], rating: d.rating || null, seen: "", sig: "", updated: 0, seenUpdated: 0, checked: 0, news: null, added: Date.now() };
    favs[id] = f;
    await favArea.set({ ["fav:" + id]: f }).catch(() => {});
    return true;
  }
  ext?.storage?.onChanged?.addListener((ch) => {
    if (Object.keys(ch).some((k) => k.startsWith("fav:") || k === "favArea")) loadFavs().then(() => { if (cur()?.id === "fav") render(); });
    if (ch.qualityPref) { qpref = ch.qualityPref.newValue; render(); }
  });
  let qpref = null;
  ext?.storage?.local.get("qualityPref").then((r) => { qpref = r?.qualityPref || null; }, () => {});
  const prefOk = (q) => !!(q && qpref && U.qualityOf && U.matchesPref?.(U.qualityOf(q), qpref));

  // ------------------------------------------------------------ datos: lo que te falta
  // Series de las novedades que tienes en Plex / Jellyfin y que tienen capítulos
  // publicados después del último que tienes.
  const MISS_TTL = 30 * 60e3, MISS_PAGES = 4;
  let miss = ss.get(MISS);
  if (!miss || Date.now() - miss.t > MISS_TTL) miss = { t: Date.now(), done: {}, list: [] };
  let mediaOn = null;     // ¿hay Plex o Jellyfin configurado?
  let missRun = null, missProgress = { n: 0, of: 0 };
  async function mediaConfigured() {
    if (mediaOn != null) return mediaOn;
    try {
      const s = await ext.storage.local.get(["plexUrl", "plexToken", "jfUrl", "jfKey"]);
      mediaOn = !!((s.plexUrl && s.plexToken) || (s.jfUrl && s.jfKey));
    } catch (_) { mediaOn = false; }
    return mediaOn;
  }
  const parseEp = (name) => {
    const m = name.match(/\b(\d{1,2})x(\d{1,3})\b/i) || name.match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
    return m ? { s: Number(m[1]), e: Number(m[2]) } : null;
  };
  const pad = (n) => String(n).padStart(2, "0");
  // [2x06, 2x07, 2x08, 2x10] → «2x06–2x08, 2x10»
  function ranges(eps) {
    const out = [];
    for (const ep of eps) {
      const last = out[out.length - 1];
      if (last && last.s === ep.s && last.to === ep.e - 1) last.to = ep.e;
      else out.push({ s: ep.s, from: ep.e, to: ep.e });
    }
    const label = out.map((r) => `${r.s}x${pad(r.from)}` + (r.to > r.from ? `–${r.s}x${pad(r.to)}` : ""));
    return label.length > 3 ? label.slice(0, 3).join(", ") + "…" : label.join(", ");
  }
  async function checkSeries(d) {
    let res;
    try { res = await ext.runtime.sendMessage({ action: "media-lookup", query: { title: d.title, year: Number(d.year) || null, type: "show" } }); }
    catch (_) { return null; }
    const found = (res?.results || []).filter((r) => r.found && r.episodes);
    if (!found.length) return null;
    const have = new Set();
    let top = 0;
    for (const r of found) for (const x of r.episodes) { have.add(`${x.s}x${x.e}`); top = Math.max(top, x.s * 1000 + x.e); }
    if (!top) return null;
    const page = await fetch(d.href, { credentials: "include" }).then((r) => r.ok ? r.text() : "", () => "");
    if (!page) return null;
    const doc = new DOMParser().parseFromString(page, "text/html");
    const eps = new Map();
    for (const a of $$("a[href*='Download(']", doc)) {
      const ep = parseEp(txt(a));
      if (ep && ep.s * 1000 + ep.e > top && !have.has(`${ep.s}x${ep.e}`)) eps.set(`${ep.s}x${ep.e}`, ep);
    }
    if (!eps.size) return null;
    const list = [...eps.values()].sort((a, b) => a.s - b.s || a.e - b.e);
    return { n: list.length, label: ranges(list), server: found[0].server };
  }
  function scanMissing() {
    if (missRun) return missRun;
    missRun = (async () => {
      if (!(await mediaConfigured())) return;
      while (feed.pages < MISS_PAGES && feed.next) { if (!(await loadPage())) break; }
      const series = feed.rows.filter((r) => r.type === "series").slice(0, 80);
      missProgress = { n: 0, of: series.length };
      let i = 0;
      const worker = async () => {
        while (i < series.length) {
          const d = series[i++];
          if (!(d.href in miss.done)) {
            const r = await checkSeries(d).catch(() => null);
            miss.done[d.href] = r ? 1 : 0;
            if (r) miss.list.push({ ...d, miss: r });
            ss.set(MISS, miss);
          }
          missProgress.n++;
          if (cur()?.id === "miss") render(true);
        }
      };
      await Promise.all([worker(), worker()]);
      missProgress.done = true;
      if (cur()?.id === "miss") render(true);
    })();
    return missRun;
  }

  // Lista de cada canal
  function listOf(c) {
    switch (c.id) {
      case "miss": return miss.list;
      case "new": return feed.rows;
      case "fav": {
        const byHref = new Map(feed.rows.map((r) => [titleId(r.href), r]));
        return Object.values(favs)
          .sort((a, b) => (!!b.news - !!a.news) || (b.updated || 0) - (a.updated || 0) || (b.added || 0) - (a.added || 0))
          .map((f) => ({ ...(byHref.get(f.id) || {}), href: f.url, title: f.title, year: f.year, type: f.type, tag: f.tag,
            genres: f.genres, rating: f.rating, poster: f.poster || byHref.get(f.id)?.poster, news: f.news }));
      }
      default: return feed.rows.filter((r) => r.type === c.id);
    }
  }
  // Se piden más páginas cuando te acercas al final del canal
  async function ensure(c, idx) {
    if (c.id === "miss" || c.id === "fav") return;
    let guard = 0;
    while (listOf(c).length < idx + 6 && feed.next && feed.pages < MAX_PAGES && guard++ < 8) {
      if (!(await loadPage())) break;
      render(true);
    }
  }

  // ------------------------------------------------------------ pantalla
  let root, stage, scr, content, osd, hint, noise, staticNum, msgBox;
  function build() {
    root = h("div", "");
    root.id = "uispa-tv";
    noise = document.createElement("canvas");
    noise.className = "utv-noise";
    noise.width = 320; noise.height = 180;
    staticNum = h("div", "utv-static-num");
    content = h("div", "utv-content");
    osd = h("div", "utv-osd");
    hint = h("div", "utv-hint");
    msgBox = h("div", "utv-msg");
    scr = h("div", "utv-screen", content, osd, hint, msgBox, noise, staticNum,
      h("div", "utv-rgb"), h("div", "utv-scan"), h("div", "utv-flicker"), h("div", "utv-vig"), h("div", "utv-glare"));
    stage = h("div", "utv-stage", h("div", "utv-bezel"), scr, h("div", "utv-led"), h("div", "utv-brand", "U I S P A · T V"));
    root.append(stage);
    html.append(root);
    fit();
  }
  function fit() {
    if (!stage) return;
    stage.style.setProperty("--utv-s", String(Math.min(innerWidth / 1280, innerHeight / 720)));
  }
  addEventListener("resize", fit);

  let noiseTimer = 0;
  function staticBurst(ms = 380, label = null) {
    if (!root) return Promise.resolve();
    const x = noise.getContext("2d");
    const img = x.createImageData(noise.width, noise.height);
    staticNum.textContent = "";
    if (label) staticNum.append(pad(label.n), h("small", "", label.name));
    root.classList.add("utv-static");
    hiss(ms);
    const end = performance.now() + ms;
    const r = root;
    cancelAnimationFrame(noiseTimer);
    return new Promise((ok) => {
      const frame = (t) => {
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        x.putImageData(img, 0, 0);
        if (t < end) noiseTimer = requestAnimationFrame(frame);
        else { r.classList.remove("utv-static"); ok(); }
      };
      noiseTimer = requestAnimationFrame(frame);
    });
  }
  let msgT;
  function say(text) {
    if (!msgBox) return;
    msgBox.textContent = text;
    msgBox.classList.add("utv-show");
    clearTimeout(msgT);
    msgT = setTimeout(() => msgBox.classList.remove("utv-show"), 1800);
  }
  const keyHint = (pairs) => {
    hint.textContent = "";
    pairs.forEach(([k, t], i) => { if (i) hint.append(" · "); hint.append(h("b", "", k), " " + t); });
  };

  // ------------------------------------------------------------ zapping
  const cur = () => st && chan(st.ch);
  const posOf = (c) => Math.max(0, st.pos?.[c.n] || 0);
  const TYPE_TXT = { movie: "Película", series: "Serie", doc: "Documental", music: "Música" };

  function zapView() {
    const c = cur();
    const list = listOf(c);
    let i = Math.min(posOf(c), Math.max(0, list.length - 1));
    osd.textContent = "";
    osd.append(pad(c.n).replace(/^/, "CH "), h("small", "", c.name));
    keyHint([["▲▼", "título"], ["◀▶", "canal"], ["OK", "ficha"], ["1-6", "ir a canal"], ["F", "favorito"], ["S", soundOn ? "sonido sí" : "sonido no"], ["ATRÁS", "apagar"]]);

    // canal vacío: carta de ajuste o «sintonizando»
    if (!list.length) {
      if (c.id === "miss" && mediaOn === false) return noSignal("Conecta Plex o Jellyfin en los ajustes de UIspa para ver aquí los capítulos que te faltan de tus series.");
      if (c.id === "fav") return noSignal("Aún no tienes favoritos. Pulsa F en cualquier título para añadirlo.");
      const busy = c.id === "miss" ? !missProgress.done : !!feed.next && feed.pages < MAX_PAGES;
      if (!busy) return noSignal(c.id === "miss" ? "Estás al día: no te falta ningún capítulo de las series que salen en las novedades." : "No hay títulos en este canal.");
      const p = c.id === "miss" && missProgress.of ? missProgress.n / missProgress.of : 0;
      return h("div", "utv-tuning", "SINTONIZANDO…",
        h("div", "utv-bar", Object.assign(h("i", ""), { style: `width:${Math.round(p * 100)}%` })),
        h("small", "", c.id === "miss" ? (missProgress.of ? `Comparando con tu servidor: ${missProgress.n} de ${missProgress.of} series` : "Leyendo las novedades…") : "Leyendo las novedades…"));
    }
    const d = list[i];
    const bg = h("div", "utv-bg");
    if (d.poster) bg.style.backgroundImage = `url("${d.poster}")`;
    const poster = h("div", "utv-poster");
    if (d.poster) {
      const img = h("img", "");
      img.alt = ""; img.src = d.poster;
      img.onerror = () => img.replaceWith(h("div", "utv-nopic", d.title));
      poster.append(img);
    } else poster.append(h("div", "utv-nopic", d.title));

    const more = c.id === "miss" ? (missProgress.done ? "" : " +") : feed.next && c.id !== "fav" ? "+" : "";
    const status = d.badge ? (d.badge === "hoy" ? "NUEVO HOY" : d.badge === "ayer" ? "NUEVO AYER" : "") : d.last ? d.last.toUpperCase() : "";
    const tag = h("div", "utv-tag", `▲ ${i + 1} / ${list.length}${more} ▼` + (status ? " · " + status : ""));
    const h1 = h("h1", "utv-h1" + (d.title.length > 26 ? " utv-long" : ""), d.title);
    const meta = h("div", "utv-meta",
      h("span", "utv-pill", [TYPE_TXT[d.type] || "Película", d.tag].filter(Boolean).join(" · ").toUpperCase()),
      d.year ? h("span", "", d.year) : null,
      d.rating ? h("span", "utv-r", "★ " + d.rating) : null,
      (d.genres || []).slice(0, 3).map((g) => h("span", "utv-pill", g)));
    const badges = h("div", "utv-badges");
    if (d.miss) badges.append(h("span", "utv-badge utv-miss", `Te faltan ${d.miss.label}`));
    if (d.news) badges.append(h("span", "utv-badge utv-news", "✨ " + d.news));
    if (d.quality) badges.append(h("span", "utv-badge" + (prefOk(d.quality) ? " utv-pref" : ""), (prefOk(d.quality) ? "★ Tu calidad: " : "") + d.quality));
    if (isFav(d.href) && c.id !== "fav") badges.append(h("span", "utv-badge utv-favb", "★ En favoritos"));
    const info = h("div", "utv-info", tag, h1, meta, d.synopsis ? h("p", "utv-syn", d.synopsis) : null, badges.childElementCount ? badges : null);
    // puntos de posición (5 a la vista)
    const dots = h("div", "utv-dots");
    const n = Math.min(5, list.length), first = Math.max(0, Math.min(i - 2, list.length - n));
    for (let k = first; k < first + n; k++) dots.append(h("i", k === i ? "utv-on" : ""));
    return h("div", "utv-zap", bg, poster, info, dots);
  }
  function noSignal(text) {
    const bars = h("div", "utv-bars");
    for (const c of ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"]) bars.append(Object.assign(h("i", ""), { style: `background:${c}` }));
    return h("div", "utv-nosig-wrap", bars, h("div", "utv-nosig", h("b", "", "SIN SEÑAL"), text));
  }

  // ------------------------------------------------------------ ficha (página del título)
  const A = () => globalThis.__uispaActions;
  let fz = { zone: "vers", tab: undefined, v: 0, e: 0, a: 0, scroll: {} };
  function fichaModel() {
    const info = globalThis.__uispaTitleInfo?.() || {};
    const r2 = $("td.R2");
    const genreP = r2 && $$("p.INFO", r2).find((p) => /G[ée]nero/i.test(txt($("strong", p))));
    const genres = genreP ? $$("a", genreP).map(txt).filter(Boolean).slice(0, 3) : [];
    const typeTxt = (txt(genreP).match(/:\s*([^>]+?)\s*>/) || [])[1] || (info.type === "show" ? "Series" : "Películas");
    const rating = (txt($("#STARS_CONTAINER .SEP")).match(/(\d+(?:[.,]\d+)?)\s*$/) || [])[1]?.replace(",", ".");
    const poster = $("td.L2 > img")?.src || $(".hcm-hero-cover img")?.src || "";
    const groups = new Map((A()?.groups() || []).map((g) => [g.id, g]));
    const versions = [];
    for (const td of $$("table.T1 > tbody > tr > td, table.T1 > tr > td")) {
      const h2 = $(":scope > h2", td);
      if (!h2) continue;
      const a = $("a[href*='Download(']", td);
      const gid = ((a?.getAttribute("href") || "").match(/Download\(\s*(\d+)/) || [])[1];
      const g = gid && groups.get(gid);
      if (!g) continue;
      const facts = U.versionFacts ? U.versionFacts(td) : {};
      const files = [...g.rows].sort((x, y) => x.i - y.i).map((r) => {
        const name = txt(r.link) || txt($$("a[href*='Download(']", r.tr).find((x) => txt(x)));
        const box = document.getElementById(`elink_${g.id}_${r.i}`);
        const badges = $$(".hc-plex", r.tr).map(txt).filter(Boolean);
        return { i: r.i, name, ep: parseEp(name), size: txt($("td.SIZE", r.tr)), box,
          have: r.tr?.dataset.uispaHave || "", missing: r.tr?.dataset.uispaMissing === "1", badge: badges[0] || "" };
      });
      const seasons = [...new Set(files.map((f) => f.ep?.s).filter((x) => x != null))];
      if (!seasons.length) { const m = txt($(".INFOMSG", td)).match(/Temporada\s+(\d+)/i); if (m) seasons.push(Number(m[1])); }
      const date = (facts["eLink puesto"] || "").replace(/\s*\(.*\)\s*$/, "");
      versions.push({ gid: g.id, title: txt(h2).replace(/\s*★ Tu calidad\s*$/, ""), pref: td.classList.contains("hcm-pref"), files, seasons,
        meta: [files.length === 1 ? "1 archivo" : `${files.length} archivos`, facts["Ripper"] ? "por " + facts["Ripper"] : null, date || null].filter(Boolean).join(" · ") });
    }
    const allSeasons = [...new Set(versions.flatMap((v) => v.seasons))].sort((a, b) => a - b);
    const plex = $$(".hc-plex-hero").map(txt).filter(Boolean);
    return { title: info.title || txt($(".hcm-title")) || document.title, year: info.year, type: typeTxt, genres, rating, poster, versions, seasons: allSeasons, plex,
      isShow: info.type === "show" };
  }
  let model = null;
  const visVersions = () => !model ? [] : model.versions.filter((v) => fz.tab == null || !v.seasons.length || v.seasons.includes(fz.tab));
  const curVersion = () => visVersions()[Math.min(fz.v, visVersions().length - 1)] || null;
  const visFiles = (v) => !v ? [] : v.files.filter((f) => fz.tab == null || !f.ep || f.ep.s === fz.tab);
  const tabs = () => model && model.seasons.length >= 2 ? [...model.seasons, null] : [];

  function kindFor(v) {
    if (!v) return { kind: "all", n: 0, label: "" };
    const checked = v.files.filter((f) => f.box?.checked).length;
    if (checked) return { kind: "sel", n: checked, label: `marcados (${checked})` };
    const m = v.files.filter((f) => f.missing).length;
    if (m && m < v.files.length) return { kind: "missing", n: m, label: `los que faltan (${m})` };
    return { kind: "all", n: v.files.length, label: v.files.length > 1 ? `todos (${v.files.length})` : "" };
  }
  function actions() {
    const s = A()?.status?.() || {};
    const v = curVersion(), k = kindFor(v);
    const fav = $(".hcm-fav-btn");
    const favOn = fav?.getAttribute("aria-pressed") === "true";
    const lbl = (t) => k.label ? `${t} · ${k.label}` : t;
    return [
      s.nas && { id: "nas", cls: "utv-g", text: "● " + lbl("NAS"), key: "N" },
      s.emule && { id: "emule", cls: "utv-red", text: "● " + lbl("eMule"), key: "E" },
      s.remote && { id: "remote", cls: "utv-p", text: lbl("Remoto"), key: "R" },
      { id: "copy", cls: "utv-y", text: "● " + lbl("Copiar"), key: "C" },
      fav && { id: "fav", cls: "utv-b", text: favOn ? "● Quitar favorito" : "● Favorito", key: "F" },
    ].filter(Boolean);
  }
  function runAction(id) {
    if (id === "fav") { $(".hcm-fav-btn")?.click(); setTimeout(() => render(), 80); return; }
    const v = curVersion();
    if (!v) return;
    const k = kindFor(v);
    blip();
    A()?.run(id, v.gid, k.kind);
  }

  function fichaView() {
    model = fichaModel();
    const t = tabs();
    if (fz.tab === undefined || (fz.tab != null && !model.seasons.includes(fz.tab))) fz.tab = t.length ? model.seasons[model.seasons.length - 1] : null;
    if (!t.length) fz.tab = null;
    const vers = visVersions();
    if (fz.v >= vers.length) fz.v = Math.max(0, vers.length - 1);
    const v = curVersion();
    const files = visFiles(v);
    if (fz.e >= files.length) fz.e = Math.max(0, files.length - 1);
    const acts = actions();
    if (fz.a >= acts.length) fz.a = acts.length - 1;
    if (fz.zone === "eps" && !files.length) fz.zone = "vers";
    if (fz.zone === "tabs" && !t.length) fz.zone = "vers";
    if (v) A()?.prefetch?.(v.gid);   // los enlaces listos antes de pulsar (Firefox / eMule en Chrome)

    osd.textContent = "";
    const c = cur();
    osd.style.fontSize = "28px";
    osd.append("CH " + pad(c.n), h("small", "", c.name + " · FICHA"));
    const letters = acts.map((x) => x.key).join(" ");
    keyHint([["▲▼◀▶", "moverse"], ["OK", model.isShow ? "marcar" : "elegir"], ["colores · " + letters, acts.map((x) => ({ nas: "NAS", emule: "eMule", remote: "remoto", copy: "copiar", fav: "favorito" }[x.id])).join(", ")], ["ATRÁS", "volver al canal"]]);

    const bg = h("div", "utv-bg");
    if (model.poster) bg.style.backgroundImage = `url("${model.poster}")`;
    const mini = h("div", "utv-mini");
    if (model.poster) { const im = h("img", ""); im.src = model.poster; im.alt = ""; mini.append(im); }
    const typeOne = { "Películas": "Película", "Series": "Serie", "Documentales": "Documental", "Música": "Música" }[model.type] || model.type;
    const metaBits = [typeOne, model.year, model.rating ? "★ " + model.rating : null, ...model.genres].filter(Boolean);
    const sub = h("p", "", metaBits.join(" · "));
    if (model.plex.length) sub.append(" · ", h("span", "utv-have", model.plex.join(" · ")));
    const head = h("div", "utv-head", mini, h("div", "", h("h2", "", model.title), sub));

    const tabsEl = t.length ? h("div", "utv-tabs", t.map((s, k) => {
      const anyMissing = s != null && model.versions.some((x) => x.files.some((f) => f.missing && f.ep?.s === s));
      return h("span", "utv-tab" + (s === fz.tab ? " utv-sel" : "") + (anyMissing ? " utv-dot" : "") + (fz.zone === "tabs" && s === fz.tab ? " utv-focus" : ""),
        s == null ? "Todas" : `Temp. ${s}`);
    })) : null;

    const versEl = h("div", "utv-vers", vers.length ? vers.map((x, k) => h("div", "utv-ver" + (x.pref ? " utv-pref" : "") + (k === fz.v ? " utv-sel" : "") + (fz.zone === "vers" && k === fz.v ? " utv-focus" : ""),
      h("b", "", (x.pref ? "★ " : "") + x.title), h("small", "", x.meta))) : h("div", "utv-empty", "Este título no tiene descargas."));

    const epsEl = h("div", "utv-eps", files.map((f, k) => {
      const yes = f.have && !f.missing;
      const st = f.missing ? h("span", "utv-st utv-no", "Falta") : yes ? h("span", "utv-st utv-yes", f.badge || "✓ Lo tienes") : h("span", "utv-st", f.size);
      return h("div", "utv-ep" + (fz.zone === "eps" && k === fz.e ? " utv-focus" : ""),
        h("span", "", f.box ? h("span", "utv-chk" + (f.box.checked ? " utv-x" : "")) : null, f.name || "Archivo " + (f.i + 1)), st);
    }));

    const actsEl = h("div", "utv-acts", acts.map((x, k) => h("span", "utv-btn " + x.cls + (fz.zone === "acts" && k === fz.a ? " utv-focus" : ""), x.text)));
    const view = h("div", "utv-ficha", bg, head, tabsEl, versEl, epsEl, actsEl);
    // mantener el desplazamiento de las listas y que se vea lo enfocado
    requestAnimationFrame(() => {
      for (const [cls, k] of [["utv-vers", "v"], ["utv-eps", "e"]]) {
        const box = $("." + cls, view);
        if (!box) continue;
        box.scrollTop = fz.scroll[k] || 0;
        const f = $(".utv-focus, .utv-sel", box);
        if (f) {
          if (f.offsetTop < box.scrollTop) box.scrollTop = f.offsetTop - 6;
          else if (f.offsetTop + f.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = f.offsetTop + f.offsetHeight - box.clientHeight + 6;
        }
        fz.scroll[k] = box.scrollTop;
      }
    });
    return view;
  }

  // ------------------------------------------------------------ pintar
  const inFicha = () => st?.view === "ficha" && isTitlePage();
  let lastKey = "";
  function render(soft = false) {
    if (!st || !root) return;
    const view = inFicha() ? fichaView() : zapView();
    if (!inFicha()) osd.style.fontSize = "";
    const key = inFicha() ? "f" : `${st.ch}:${posOf(cur())}:${listOf(cur())[posOf(cur())]?.href || ""}`;
    const roll = !soft && key !== lastKey && !inFicha();
    lastKey = key;
    content.replaceChildren(view);
    if (roll) { view.classList.add("utv-roll"); }
  }

  // ------------------------------------------------------------ encender / apagar
  function enable(how = "on") {
    if (root) return;
    const fresh = !st;
    st = { ch: 2, pos: {}, view: "zap", ...(st || {}), on: (st?.on === "on" ? "on" : how) };
    if (!isTitlePage()) st.view = "zap";
    save();
    html.classList.add("uispa-tv-on");
    build();
    loadFavs().then(() => render(true));
    mediaConfigured().then(() => { scanMissing(); render(true); });
    render();
    if (fresh) {
      // encendido: la línea blanca que se abre, el «clonc» y la nieve
      root.classList.add("utv-on");
      setTimeout(() => root?.classList.remove("utv-on"), 600);
      thunk(true);
      setTimeout(() => root && staticBurst(300, inFicha() ? null : cur()), 380);
    } else {
      staticBurst(260);   // vienes de otra página (la ficha o vuelta al canal)
    }
    if (!inFicha()) ensure(cur(), posOf(cur()));
    pads();
  }
  function disable() {
    if (!root) { st = null; save(); html.classList.remove("uispa-tv-on"); return; }
    thunk(false);
    root.classList.add("utv-off");
    const r = root;
    root = null;
    st = null;
    save();
    setTimeout(() => { r.remove(); html.classList.remove("uispa-tv-on"); }, 450);
  }
  function toggle() {
    if (root) { if (isFull()) ss.set(NOFS, 1); disable(); }
    else enable("on");
  }
  document.addEventListener("uispa-tv-toggle", toggle);

  // Pantalla completa (F11 o la del navegador): se enciende sola, y se apaga al salir
  const isFull = () => !!document.fullscreenElement || (innerWidth >= screen.width - 2 && innerHeight >= screen.height - 2);
  let fsTimer = null;
  addEventListener("resize", () => {
    clearTimeout(fsTimer);
    fsTimer = setTimeout(() => {
      if (isFull()) { if (!root && !ss.get(NOFS)) enable("auto"); }
      else { ss.set(NOFS, null); if (root && st?.on === "auto") disable(); }
    }, 300);
  });

  // ------------------------------------------------------------ manejo
  async function setChannel(n) {
    const c = chan(n);
    st.ch = c.n; st.view = "zap"; save();
    blip();
    await staticBurst(360, c);
    render();
    ensure(c, posOf(c));
    if (c.id === "miss") scanMissing();
  }
  function step(d) {
    const c = cur(), list = listOf(c);
    if (!list.length) return;
    const i = Math.max(0, Math.min(list.length - 1, posOf(c) + d));
    if (i === posOf(c)) { say(d > 0 ? (feed.next && c.id !== "fav" && c.id !== "miss" ? "Cargando más…" : "Fin del canal") : "Principio del canal"); return; }
    st.pos = { ...st.pos, [c.n]: i }; save();
    hiss(70, 0.04);
    render();
    ensure(c, i);
  }
  function openTitle() {
    const d = listOf(cur())[posOf(cur())];
    if (!d) return;
    st.view = "ficha"; st.ficha = d.href; save();
    fz = { zone: "vers", tab: undefined, v: 0, e: 0, a: 0, scroll: {} };
    if (isTitlePage() && titleId(location.href) === titleId(d.href)) { staticBurst(250).then(() => render()); return; }
    staticBurst(2000);
    location.href = d.href;
  }
  async function favCurrent() {
    const d = listOf(cur())[posOf(cur())];
    if (!d) return;
    const on = await toggleFav(d);
    say(on ? "★ Añadido a favoritos" : "Quitado de favoritos");
    render(true);
  }
  function backToZap() {
    st.view = "zap"; save();
    staticBurst(250).then(() => render());
  }

  function fichaKey(k) {
    const t = tabs(), vers = visVersions(), files = visFiles(curVersion()), acts = actions();
    const z = fz.zone;
    const move = (zone) => { fz.zone = zone; };
    if (k === "up") {
      if (z === "vers") { if (fz.v > 0) fz.v--; else if (t.length) move("tabs"); }
      else if (z === "eps") { if (fz.e > 0) fz.e--; else if (t.length) move("tabs"); }
      else if (z === "acts") move(files.length && fz.lastList === "eps" ? "eps" : "vers");
    } else if (k === "down") {
      if (z === "tabs") move("vers");
      else if (z === "vers") { if (fz.v < vers.length - 1) fz.v++; else if (acts.length) { fz.lastList = "vers"; move("acts"); } }
      else if (z === "eps") { if (fz.e < files.length - 1) fz.e++; else if (acts.length) { fz.lastList = "eps"; move("acts"); } }
    } else if (k === "left" || k === "right") {
      const d = k === "left" ? -1 : 1;
      if (z === "tabs") { const i = t.indexOf(fz.tab); fz.tab = t[Math.max(0, Math.min(t.length - 1, i + d))]; fz.v = 0; fz.e = 0; fz.scroll = {}; }
      else if (z === "acts") fz.a = Math.max(0, Math.min(acts.length - 1, fz.a + d));
      else if (z === "vers" && d > 0 && files.length) move("eps");
      else if (z === "eps" && d < 0) move("vers");
    } else if (k === "ok") {
      if (z === "tabs") move("vers");
      else if (z === "vers") { if (files.length) { move("eps"); fz.e = 0; fz.scroll.e = 0; } }
      else if (z === "eps") {
        const f = files[fz.e];
        if (f?.box) f.box.click();
        else if (acts.length) { fz.lastList = "eps"; move("acts"); }
      } else if (z === "acts") runAction(acts[fz.a]?.id);
    }
    if (z === "vers" && fz.zone === "vers" && (k === "up" || k === "down")) { fz.e = 0; fz.scroll.e = 0; }
    render(true);
  }

  // Teclas → órdenes
  const COLOR = { ColorF0Red: "emule", ColorF1Green: "nas", ColorF2Yellow: "copy", ColorF3Blue: "fav" };
  function command(cmd) {
    if (!root) return;
    if (inFicha()) {
      if (cmd === "back") return backToZap();
      if (["up", "down", "left", "right", "ok"].includes(cmd)) return fichaKey(cmd);
      if (cmd.startsWith("act:")) { const id = cmd.slice(4); if (actions().some((a) => a.id === id)) runAction(id); else say("No disponible"); return; }
      if (cmd === "sound") return toggleSound();
      if (/^ch\d$/.test(cmd) || cmd === "chup" || cmd === "chdown") { st.view = "zap"; save(); }
      else return;
    }
    switch (cmd) {
      case "up": return step(-1);
      case "down": return step(1);
      case "left": case "chdown": return setChannel(cur().n === 1 ? CHANNELS.length : cur().n - 1);
      case "right": case "chup": return setChannel(cur().n === CHANNELS.length ? 1 : cur().n + 1);
      case "ok": return openTitle();
      case "back": return toggle();
      case "act:fav": return favCurrent();
      case "sound": return toggleSound();
      default:
        if (/^ch\d$/.test(cmd)) { const n = Number(cmd.slice(2)); if (CHANNELS.some((c) => c.n === n)) setChannel(n); }
    }
  }
  function toggleSound() {
    soundOn = !soundOn;
    ls.set("uispa-tv-sound", soundOn ? "1" : null);
    say(soundOn ? "🔊 Sonido activado" : "🔇 Sonido desactivado");
    if (soundOn) thunk(true);
    render(true);
  }

  const popOpen = () => !!document.querySelector(".hc-nas-pop");
  // Dentro del recuadro del NAS: las flechas van de un control al siguiente
  function popKey(e) {
    const pop = document.querySelector(".hc-nas-pop");
    const items = $$("button, input, a[href], select", pop).filter((x) => !x.disabled && x.offsetParent !== null);
    if (!items.length) return false;
    const a = document.activeElement;
    const typing = a?.tagName === "INPUT" && a.type === "text";
    const i = items.indexOf(a);
    let d = 0;
    if (e.key === "ArrowDown") d = 1;
    else if (e.key === "ArrowUp") d = -1;
    else if (!typing && e.key === "ArrowRight") d = 1;
    else if (!typing && e.key === "ArrowLeft") d = -1;
    else if (e.key === "Backspace" && !typing) { e.preventDefault(); pop.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true; }
    else if (e.key === "Enter" && a?.type === "checkbox") { e.preventDefault(); a.click(); return true; }
    if (!d) return true;   // el resto, al recuadro
    e.preventDefault();
    items[(i < 0 ? 0 : i + d + items.length) % items.length].focus();
    return true;
  }

  addEventListener("keydown", (e) => {
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (!root) {
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "t" || e.key === "T")) { e.preventDefault(); toggle(); }
      return;
    }
    if (popOpen()) { popKey(e); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      Enter: "ok", " ": "ok", Select: "ok",
      Escape: "back", Backspace: "back", BrowserBack: "back", GoBack: "back",
      PageUp: "chup", PageDown: "chdown", ChannelUp: "chup", ChannelDown: "chdown",
      t: "back", T: "back", s: "sound", S: "sound", m: "sound", M: "sound",
      f: "act:fav", F: "act:fav", n: "act:nas", N: "act:nas", e: "act:emule", E: "act:emule",
      c: "act:copy", C: "act:copy", r: "act:remote", R: "act:remote",
    };
    let cmd = map[e.key] || (COLOR[e.key] ? "act:" + COLOR[e.key] : null);
    if (!cmd && /^[0-9]$/.test(e.key)) cmd = "ch" + e.key;
    if (!cmd) return;
    e.preventDefault();
    e.stopPropagation();
    if ((cmd === "back") && (e.key === "t" || e.key === "T")) { toggle(); return; }
    command(cmd);
  }, true);
  // la rueda del ratón también hace zapping
  let wheelT = 0;
  addEventListener("wheel", (e) => {
    if (!root || popOpen()) return;
    e.preventDefault();
    const now = Date.now();
    if (now - wheelT < 250) return;
    wheelT = now;
    command(e.deltaY > 0 ? "down" : "up");
  }, { passive: false, capture: true });

  // ------------------------------------------------------------ mando de consola
  // Cruceta = flechas · A = OK · B = atrás · X = NAS · Y = favorito · LB/RB = canal · Select = sonido
  let padLoop = 0;
  const held = new Map();
  function pads() {
    if (padLoop || !navigator.getGamepads) return;
    const BTN = { 12: "up", 13: "down", 14: "left", 15: "right", 0: "ok", 1: "back", 2: "act:nas", 3: "act:fav", 4: "chdown", 5: "chup", 8: "sound" };
    const tick = () => {
      padLoop = 0;
      if (!root) return;
      const now = performance.now();
      for (const gp of navigator.getGamepads()) {
        if (!gp) continue;
        for (const [b, cmd] of Object.entries(BTN)) {
          const k = gp.index + ":" + b;
          const pressed = gp.buttons[b]?.pressed;
          const prev = held.get(k);
          if (pressed && (!prev || (/^(up|down|left|right)$/.test(cmd) && now - prev > 320))) { held.set(k, prev ? now - 200 : now); command(cmd); }
          else if (!pressed) held.delete(k);
        }
        // stick izquierdo como cruceta
        const [x = 0, y = 0] = gp.axes;
        const dir = Math.abs(y) > 0.6 ? (y > 0 ? "down" : "up") : Math.abs(x) > 0.6 ? (x > 0 ? "right" : "left") : null;
        const k = gp.index + ":axis";
        if (dir) { const prev = held.get(k); if (!prev || now - prev > 320) { held.set(k, now); command(dir); } }
        else held.delete(k);
      }
      padLoop = requestAnimationFrame(tick);
    };
    padLoop = requestAnimationFrame(tick);
  }
  addEventListener("gamepadconnected", () => { if (root) pads(); });

  // ------------------------------------------------------------ arranque
  // En la ficha, las marcas de Plex / Jellyfin y los botones del NAS llegan después
  document.addEventListener("uispa-media", () => inFicha() && render(true));
  if (isTitlePage()) setTimeout(() => inFicha() && render(true), 1200);
  if (st?.on) {
    if (st.view === "ficha" && st.ficha && titleId(st.ficha) !== titleId(location.href)) st.view = "zap";
    enable(st.on);
  } else if (isFull() && !ss.get(NOFS)) {
    enable("auto");
  }
})();
