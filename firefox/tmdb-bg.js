// UIspa · TMDB (segundo plano), opcional: con tu clave de TMDB la ficha lleva una
// imagen horizontal de fondo y el tráiler se ve sin salir de la página.
// La clave puede ser la «clave de la API» (v3) o el «token de lectura» (v4).
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const BASE = "https://api.themoviedb.org/3";
  const mem = new Map();           // caché de la sesión: imdb/título → respuesta
  const TTL = 6 * 3600e3;

  async function call(key, path, params = {}) {
    const u = new URL(BASE + path);
    const bearer = /^eyJ/.test(key);
    if (!bearer) u.searchParams.set("api_key", key);
    for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, v);
    let res;
    try {
      res = await fetch(u, { headers: { Accept: "application/json", ...(bearer ? { Authorization: "Bearer " + key } : {}) } });
    } catch (_) {
      throw new Error(await (globalThis.__uispaNoReach?.(BASE, "No se puede conectar con TMDB") ?? "No se puede conectar con TMDB"));
    }
    if (res.status === 401) throw new Error("TMDB no acepta esa clave");
    if (!res.ok) throw new Error("TMDB respondió " + res.status);
    return res.json();
  }

  // El tráiler: en español si lo hay; si no, en inglés. Oficial y de YouTube primero.
  function pickVideo(list) {
    const yt = (list || []).filter((v) => v.site === "YouTube" && v.key);
    const rank = (v) => (v.type === "Trailer" ? 4 : v.type === "Teaser" ? 2 : 0) + (v.official ? 1 : 0);
    return yt.sort((a, b) => rank(b) - rank(a))[0] || null;
  }

  async function info(q) {
    const { tmdbKey } = await api.storage.local.get("tmdbKey");
    const key = String(tmdbKey || "").trim();
    if (!key) return { configured: false };
    const id = q.imdb || `${q.type}:${q.title}:${q.year}`;
    const hit = mem.get(id);
    if (hit && Date.now() - hit.at < TTL) return hit.data;

    let kind = q.type === "show" ? "tv" : "movie", item = null;
    if (q.imdb) {
      const r = await call(key, `/find/${q.imdb}`, { external_source: "imdb_id" });
      const mv = r.movie_results?.[0], tv = r.tv_results?.[0];
      if (kind === "tv" && tv) item = tv;
      else if (mv) { item = mv; kind = "movie"; }
      else if (tv) { item = tv; kind = "tv"; }
    }
    if (!item && q.title) {
      const r = await call(key, `/search/${kind}`, {
        query: q.title, language: "es-ES",
        ...(q.year ? (kind === "tv" ? { first_air_date_year: q.year } : { year: q.year }) : {})
      });
      item = r.results?.[0] || null;
    }
    let data = { configured: true, found: false };
    if (item) {
      let video = null, lang = "es";
      for (const l of ["es-ES", "en-US"]) {
        const v = await call(key, `/${kind}/${item.id}/videos`, { language: l }).catch(() => null);
        video = pickVideo(v?.results);
        if (video) { lang = l.slice(0, 2); break; }
      }
      data = {
        configured: true, found: true,
        backdrop: item.backdrop_path ? "https://image.tmdb.org/t/p/w1280" + item.backdrop_path : null,
        trailer: video ? { key: video.key, name: video.name, lang } : null,
        url: `https://www.themoviedb.org/${kind}/${item.id}`
      };
    }
    mem.set(id, { at: Date.now(), data });
    return data;
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "tmdb-info") {
      info(msg.query || {}).then(sendResponse, (e) => sendResponse({ configured: true, error: e.message }));
      return true;
    }
    if (msg?.action === "tmdb-test") {
      call(String(msg.key || "").trim(), "/configuration").then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "tmdb-reset") { mem.clear(); sendResponse({ ok: true }); }
  });
})();
