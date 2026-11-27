// UIspa · tráiler en la ficha.
//   · Botón «▶ Ver tráiler» en la cabecera de la ficha.
//   · Con tu clave de TMDB (ajustes → «🎲 Qué veo esta noche»): la cabecera usa una
//     imagen horizontal de fondo y el tráiler se ve encima de la página, en español
//     si lo hay y si no en versión original.
//   · Sin clave: el botón abre la búsqueda del tráiler en YouTube.
(() => {
  "use strict";
  const html = document.documentElement;
  if (!html.classList.contains("hcm") || !/[?&]view=title\b/.test(location.search)) return;
  const api = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const me = api?.runtime?.id || "uispa";
  if (html.dataset.uispaOwner && html.dataset.uispaOwner !== me) return;
  if (window.__uispaTrailer) return;
  window.__uispaTrailer = true;

  const hero = document.querySelector(".hcm-hero");
  const infoBox = hero?.querySelector(".hcm-hero-info");
  const info = globalThis.__uispaTitleInfo?.();
  if (!hero || !infoBox || !info?.title) return;

  const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter((k) => k != null)); return e; };
  const ytSearch = () => "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${info.title}${info.year ? " " + info.year : ""} tráiler español`);

  let tmdb = null;
  const btn = el("button", "hcm-trailer-btn", "▶ Ver tráiler");
  btn.type = "button";
  btn.title = "Buscar el tráiler en YouTube";
  // justo debajo de las puntuaciones
  const after = infoBox.querySelector(".hcm-scores") || infoBox.querySelector(".hcm-title");
  if (after) after.after(btn); else infoBox.append(btn);

  btn.addEventListener("click", () => {
    if (tmdb?.trailer?.key) play(tmdb.trailer);
    else window.open(ytSearch(), "_blank", "noopener");
  });

  function play(t) {
    const close = () => { dim.remove(); removeEventListener("keydown", onKey, true); btn.focus(); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    const frame = document.createElement("iframe");
    frame.className = "hcm-trailer-frame";
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.key)}?autoplay=1&rel=0&modestbranding=1&hl=es`;
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.title = "Tráiler";
    const yt = el("a", "", "Abrir en YouTube ↗");
    yt.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(t.key);
    yt.target = "_blank"; yt.rel = "noopener";
    const x = el("button", "", "✕");
    x.type = "button"; x.title = "Cerrar (Esc)";
    x.addEventListener("click", close);
    const top = el("div", "hcm-trailer-top", el("span", "", `▶ ${t.name || "Tráiler"} · ${info.title}${t.lang === "es" ? " (español)" : " (versión original)"}`), yt, x);
    const dim = el("div", "hcm-trailer-dim", top, frame);
    dim.addEventListener("click", (e) => { if (e.target === dim) close(); });
    html.append(dim);
    addEventListener("keydown", onKey, true);
    x.focus();
  }

  // TMDB (si hay clave): imagen horizontal de fondo y el tráiler exacto
  api?.runtime?.sendMessage({ action: "tmdb-info", query: { imdb: info.imdb, title: info.originalTitle || info.title, year: info.year, type: info.type } })
    ?.then?.((r) => {
      if (!r?.configured || !r.found) return;
      tmdb = r;
      if (r.trailer?.key) {
        btn.title = "Ver el tráiler aquí mismo";
        if (r.trailer.lang !== "es") btn.append(" ", el("small", "", "V.O."));
      }
      if (r.backdrop) {
        const img = new Image();
        img.onload = () => {
          hero.classList.add("hcm-hero-wide");
          const bg = hero.querySelector(".hcm-hero-bg");
          if (bg) bg.style.backgroundImage = `url("${r.backdrop}")`;
          const c = el("a", "hcm-hero-credit", "Imagen: TMDB");
          c.href = r.url; c.target = "_blank"; c.rel = "noopener";
          hero.append(c);
        };
        img.src = r.backdrop;
      }
    }, () => {});
})();
