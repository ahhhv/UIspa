// UIspa · calendario de capítulos.
// Busca una serie por su código de IMDb y devuelve sus capítulos con la fecha
// de emisión. Sin clave usa TVmaze (público, sin registro); si has puesto una
// clave de TMDb en los ajustes, usa TMDb, que da los títulos en castellano.
// Las peticiones salen del segundo plano: la clave nunca llega a la web.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const TTL = 6 * 3600 * 1000;           // caché: 6 horas
  const cache = new Map();                // clave → { at, data }

  async function getJson(url, headers = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: ctrl.signal });
      if (r.status === 404) return null;
      if (r.status === 401) throw new Error("La clave de TMDb no es válida");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("El servicio de fechas no responde");
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  // ------------------------------------------------------------ TVmaze
  async function tvmaze(imdb) {
    const show = await getJson("https://api.tvmaze.com/lookup/shows?imdb=" + encodeURIComponent(imdb));
    if (!show?.id) return { found: false, source: "tvmaze" };
    const eps = (await getJson(`https://api.tvmaze.com/shows/${show.id}/episodes`)) || [];
    return {
      found: true,
      source: "tvmaze",
      ended: show.status === "Ended",
      episodes: eps.filter((e) => e.season && e.number).map((e) => ({ s: e.season, e: e.number, date: e.airdate || "", name: e.name || "" }))
    };
  }

  // ------------------------------------------------------------ TMDb
  // Acepta la clave v3 (32 caracteres) o el token de lectura v4 (eyJ…)
  function tmdbAuth(key) {
    key = key.trim();
    return key.startsWith("eyJ") ? { headers: { Authorization: "Bearer " + key }, q: "" } : { headers: {}, q: "api_key=" + encodeURIComponent(key) };
  }
  const tmdbUrl = (path, auth, params = "") =>
    `https://api.themoviedb.org/3${path}?${[auth.q, "language=es-ES", params].filter(Boolean).join("&")}`;

  async function tmdb(imdb, key, fromSeason) {
    const auth = tmdbAuth(key);
    const find = await getJson(tmdbUrl(`/find/${encodeURIComponent(imdb)}`, auth, "external_source=imdb_id"), auth.headers);
    const id = find?.tv_results?.[0]?.id;
    if (!id) return { found: false, source: "tmdb" };
    const show = await getJson(tmdbUrl(`/tv/${id}`, auth), auth.headers);
    // Solo hacen falta las temporadas desde la última que hay en la página
    const seasons = (show?.seasons || []).map((s) => s.season_number).filter((n) => n > 0 && n >= (fromSeason || 1));
    const episodes = [];
    for (const n of seasons.slice(0, 4)) {
      const season = await getJson(tmdbUrl(`/tv/${id}/season/${n}`, auth), auth.headers);
      for (const e of season?.episodes || []) {
        episodes.push({ s: e.season_number, e: e.episode_number, date: e.air_date || "", name: e.name || "" });
      }
    }
    return { found: true, source: "tmdb", ended: show?.status === "Ended" || show?.status === "Canceled", episodes };
  }

  async function lookup(q) {
    const imdb = String(q?.imdb || "").match(/tt\d+/)?.[0];
    if (!imdb) return { found: false };
    const { calOff, tmdbKey } = await api.storage.local.get(["calOff", "tmdbKey"]);
    if (calOff) return { off: true };
    const key = `${tmdbKey ? "tmdb" : "tvmaze"}:${imdb}:${q.fromSeason || 1}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.data;
    let data;
    if (tmdbKey) {
      try { data = await tmdb(imdb, tmdbKey, q.fromSeason); }
      catch (e) {
        // si TMDb falla, se intenta con TVmaze y se avisa
        data = { ...(await tvmaze(imdb)), warning: "TMDb: " + e.message };
      }
    } else {
      data = await tvmaze(imdb);
    }
    cache.set(key, { at: Date.now(), data });
    return data;
  }

  // Comprueba una clave de TMDb (botón «Probar» de los ajustes)
  async function testKey(key) {
    if (!key?.trim()) return { ok: false, error: "Escribe la clave" };
    try {
      const auth = tmdbAuth(key);
      await getJson(tmdbUrl("/configuration", auth).replace("&language=es-ES", "").replace("?language=es-ES", "?"), auth.headers);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "cal-lookup") {
      lookup(msg.query).then(sendResponse, (e) => sendResponse({ found: false, error: e.message }));
      return true;
    }
    if (msg?.action === "cal-test") {
      testKey(msg.key).then(sendResponse);
      return true;
    }
    if (msg?.action === "cal-reset") { cache.clear(); sendResponse({ ok: true }); }
    return false;
  });

  // si cambia la clave o se desactiva, se olvida la caché
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.tmdbKey || changes.calOff)) cache.clear();
  });

  globalThis.__uispaCalendar = { lookup, testKey, tvmaze, tmdb, cache };
})();
