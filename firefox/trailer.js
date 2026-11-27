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
    const list = tmdb?.trailers?.length ? tmdb.trailers : tmdb?.trailer ? [tmdb.trailer] : [];
    if (list.length) play(list);
    else window.open(ytSearch(), "_blank", "noopener");
  });

  // Reproductor encima de la página. Si YouTube dice que un vídeo no se puede
  // ver (bloqueado en tu país, retirado o sin permiso para verse fuera de
  // YouTube), se pasa solo al siguiente; si no queda ninguno, se ofrece buscarlo.
  const YT = "https://www.youtube-nocookie.com";
  function play(list) {
    let i = 0, frame = null;
    const bad = new Set();   // los que YouTube no deja ver
    const label = el("span", "");
    const nextBtn = el("button", "hcm-trailer-next", "Otro tráiler ›");
    nextBtn.type = "button";
    nextBtn.title = "Ver otro tráiler de esta película";
    const search = el("a", "", "Buscar en YouTube ↗");
    search.href = ytSearch(); search.target = "_blank"; search.rel = "noopener";
    const imdb = info.imdb ? el("a", "", "IMDb ↗") : null;
    if (imdb) { imdb.href = `https://www.imdb.com/title/${info.imdb}/videogallery/`; imdb.target = "_blank"; imdb.rel = "noopener"; }
    const x = el("button", "", "✕");
    x.type = "button"; x.title = "Cerrar (Esc)";
    const top = el("div", "hcm-trailer-top", label, list.length > 1 ? nextBtn : null, search, imdb, x);
    const box = el("div", "hcm-trailer-box");
    const dim = el("div", "hcm-trailer-dim", top, box);

    const onMsg = (e) => {
      if (e.origin !== YT || !frame || e.source !== frame.contentWindow) return;
      let m = null;
      try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (_) { return; }
      if (m?.event === "onError") { bad.add(list[i].key); go(i + 1); }
    };
    const close = () => { dim.remove(); removeEventListener("keydown", onKey, true); removeEventListener("message", onMsg); btn.focus(); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };

    // el siguiente que no haya fallado, dando la vuelta si hace falta
    function go(n) {
      const ok = list.map((_, k) => (n + k) % list.length).find((k) => !bad.has(list[k].key));
      if (ok == null) return nothing();
      i = ok;
      nextBtn.hidden = list.length - bad.size < 2;
      const t = list[i];
      frame?.remove();
      frame = document.createElement("iframe");
      frame.className = "hcm-trailer-frame";
      frame.src = `${YT}/embed/${encodeURIComponent(t.key)}?autoplay=1&rel=0&modestbranding=1&hl=es&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.allowFullscreen = true;
      frame.title = "Tráiler";
      // se pide al reproductor que avise de los errores
      frame.addEventListener("load", () => {
        const hello = () => frame?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "uispa", channel: "widget" }), YT);
        hello(); setTimeout(hello, 400);
      });
      box.replaceChildren(frame);
      const langTxt = t.lang === "es" ? "español" : "versión original";
      label.textContent = `▶ ${t.name || "Tráiler"} · ${langTxt}` + (list.length > 1 ? ` · ${i + 1} de ${list.length}` : "");
      label.title = `${t.name || "Tráiler"} · ${info.title}`;
    }
    // ninguno se puede ver aquí
    function nothing() {
      frame?.remove(); frame = null;
      label.textContent = "▶ Tráiler";
      nextBtn.hidden = true;
      const s2 = el("a", "hcm-trailer-btn", "Buscar el tráiler en YouTube ↗");
      s2.href = ytSearch(); s2.target = "_blank"; s2.rel = "noopener";
      box.replaceChildren(el("div", "hcm-trailer-none",
        el("b", "", "Ninguno de los tráileres se puede ver aquí"),
        el("span", "", "YouTube no los deja ver en tu país o fuera de su web."), s2));
    }

    nextBtn.addEventListener("click", () => go(i + 1));
    x.addEventListener("click", close);
    dim.addEventListener("click", (e) => { if (e.target === dim) close(); });
    html.append(dim);
    addEventListener("keydown", onKey, true);
    addEventListener("message", onMsg);
    go(0);
    x.focus();
  }

  // TMDB (si hay clave): imagen horizontal de fondo y el tráiler exacto
  api?.runtime?.sendMessage({ action: "tmdb-info", query: { imdb: info.imdb, title: info.originalTitle || info.title, year: info.year, type: info.type } })
    ?.then?.((r) => {
      if (!r?.configured || !r.found) return;
      tmdb = r;
      if (r.trailer?.key || r.trailers?.length) {
        btn.title = "Ver el tráiler aquí mismo";
        if ((r.trailers?.[0] || r.trailer).lang !== "es") btn.append(" ", el("small", "", "V.O."));
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
