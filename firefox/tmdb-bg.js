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

  // Todos los tráileres de YouTube, ordenados: español de España, español,
  // inglés, el resto; dentro de cada uno, tráiler > teaser > otros, oficial primero.
  // Se devuelven varios porque algunos vídeos están bloqueados en España o no se
  // dejan ver fuera de YouTube: si uno falla, la ficha prueba el siguiente.
  function rankVideos(list) {
    const seen = new Set();
    const yt = (list || []).filter((v) => v.site === "YouTube" && v.key && !seen.has(v.key) && seen.add(v.key));
    const langScore = (v) => v.iso_639_1 === "es" ? (v.iso_3166_1 === "ES" ? 30 : 20) : v.iso_639_1 === "en" ? 10 : 0;
    const typeScore = (v) => (v.type === "Trailer" ? 4 : v.type === "Teaser" ? 2 : 0) + (v.official ? 1 : 0);
    return yt.sort((a, b) => (langScore(b) + typeScore(b)) - (langScore(a) + typeScore(a)))
      .slice(0, 8).map((v) => ({ key: v.key, name: v.name, lang: v.iso_639_1 === "es" ? "es" : v.iso_639_1 || "" }));
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
      const [es, all] = await Promise.all([
        call(key, `/${kind}/${item.id}/videos`, { language: "es-ES" }).catch(() => null),
        call(key, `/${kind}/${item.id}/videos`, { include_video_language: "es,en,null" }).catch(() => null)
      ]);
      const trailers = rankVideos([...(es?.results || []), ...(all?.results || [])]);
      data = {
        configured: true, found: true,
        backdrop: item.backdrop_path ? "https://image.tmdb.org/t/p/w1280" + item.backdrop_path : null,
        trailer: trailers[0] || null,
        trailers,
        url: `https://www.themoviedb.org/${kind}/${item.id}`
      };
    }
    mem.set(id, { at: Date.now(), data });
    return data;
  }

  // Películas recomendadas por TMDB para una película (para «se parece a…» de
  // ¿Qué veo esta noche?): se cruzan después con tu biblioteca.
  const simMem = new Map();
  async function similar(q) {
    const { tmdbKey } = await api.storage.local.get("tmdbKey");
    const key = String(tmdbKey || "").trim();
    if (!key) return { configured: false, list: [] };
    const id = q.imdb || `${q.title}:${q.year}`;
    const hit = simMem.get(id);
    if (hit && Date.now() - hit.at < TTL) return hit.data;
    let tid = null;
    if (q.imdb) tid = (await call(key, `/find/${q.imdb}`, { external_source: "imdb_id" }).catch(() => null))?.movie_results?.[0]?.id || null;
    if (!tid && q.title) {
      const r = await call(key, "/search/movie", { query: q.title, language: "es-ES", ...(q.year ? { year: q.year } : {}) });
      const res = r.results || [];
      tid = (res.find((x) => q.year && String(x.release_date || "").startsWith(String(q.year))) || res[0])?.id || null;
    }
    let list = [];
    if (tid) {
      const [a, b] = await Promise.all([
        call(key, `/movie/${tid}/recommendations`, { language: "es-ES" }).catch(() => null),
        call(key, `/movie/${tid}/similar`, { language: "es-ES" }).catch(() => null)
      ]);
      const seen = new Set();
      for (const r of [...(a?.results || []), ...(b?.results || [])]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        list.push({ t: r.title || "", o: r.original_title || "", y: Number(String(r.release_date || "").slice(0, 4)) || 0 });
      }
    }
    const data = { configured: true, found: !!tid, list };
    simMem.set(id, { at: Date.now(), data });
    return data;
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "tmdb-similar") {
      similar(msg.query || {}).then(sendResponse, (e) => sendResponse({ configured: true, error: e.message, list: [] }));
      return true;
    }
    if (msg?.action === "tmdb-info") {
      info(msg.query || {}).then(sendResponse, (e) => sendResponse({ configured: true, error: e.message }));
      return true;
    }
    if (msg?.action === "tmdb-test") {
      call(String(msg.key || "").trim(), "/configuration").then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "tmdb-reset") { mem.clear(); simMem.clear(); sendResponse({ ok: true }); }
  });
})();
