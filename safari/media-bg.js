// UIspa · capa común para servidores multimedia (Plex y/o Jellyfin).
// Busca el título en todos los servidores configurados y responde a la página con un
// formato único. Las peticiones salen del segundo plano de la extensión, así
// que tus credenciales nunca llegan a la web.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const servers = globalThis.__uispaServers || {};
  const KEYS = ["server", "plexUrl", "plexToken", "jfUrl", "jfKey"];

  // Servidores configurados: todos los que tengan dirección y credencial.
  async function activeAll() {
    const s = await api.storage.local.get(KEYS);
    return Object.entries(servers)
      .filter(([, srv]) => srv.configured(s))
      .map(([id, srv]) => ({ id, srv, cfg: srv.config(s) }));
  }

  const norm = (s) => (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ").trim();

  // Puntuación de coincidencia: IMDb exacto > título+año > solo título
  function score(item, q) {
    if (q.imdb && item.imdb === q.imdb) return 3;
    const names = [q.title, q.originalTitle].map(norm).filter(Boolean);
    const mine = [item.title, item.originalTitle].map(norm).filter(Boolean);
    if (!names.some((n) => mine.includes(n))) return 0;
    if (q.year && item.year) return Math.abs(item.year - q.year) <= 1 ? 2 : 0;
    return 1;
  }

  async function findItem(srv, cfg, q, type) {
    let best = null, bestScore = 0;
    for (const item of await srv.catalog(cfg, type)) {
      const sc = score(item, q);
      if (sc > bestScore) { best = item; bestScore = sc; if (sc === 3) break; }
    }
    return { best, bestScore };
  }

  // Busca el título en un servidor concreto
  async function lookupOne({ id, srv, cfg }, q) {
    const type = q.type === "movie" ? "movie" : "show";
    const { best, bestScore } = await findItem(srv, cfg, q, type);
    const base = { id, server: srv.name };
    if (!best) return { ...base, found: false };
    const out = { ...base, found: true, title: best.title, year: best.year, by: bestScore === 3 ? "imdb" : "title" };
    if (type === "show") out.episodes = await srv.episodes(cfg, best);
    else Object.assign(out, await srv.movieFiles(cfg, best));
    return out;
  }

  // Consulta todos los servidores configurados a la vez
  async function lookup(q) {
    const list = await activeAll();
    if (!list.length) return { configured: false, results: [] };
    const results = await Promise.all(list.map((a) =>
      lookupOne(a, q).catch((e) => ({ id: a.id, server: a.srv.name, error: e.message }))));
    return { configured: true, results };
  }

  // Carpetas del título en los servidores (rutas tal como las ve el servidor):
  // la de la serie si ya está en la biblioteca y las de las bibliotecas.
  async function folders(q) {
    const type = q?.type === "movie" ? "movie" : "show";
    const out = { own: null, libraries: [], server: null };
    for (const { srv, cfg } of await activeAll()) {
      if (!srv.folders) continue;
      try {
        const { best } = await findItem(srv, cfg, q, type);
        const f = await srv.folders(cfg, best, type);
        if (!out.own && f.own) { out.own = f.own; out.server = srv.name; }
        for (const l of f.libraries) if (!out.libraries.some((x) => x.path === l.path)) out.libraries.push(l);
        out.server = out.server || srv.name;
      } catch (_) {}
    }
    return out;
  }

  // Gustos para Descubrir: géneros, directores y décadas de tus películas (lo que
  // has visto y lo que has puntuado alto pesa más) y la lista de las que ya tienes.
  async function taste() {
    const list = await activeAll();
    const out = { configured: list.length > 0, servers: [], movies: 0, watched: 0, genres: {}, directors: {}, decades: {}, owned: [] };
    const add = (map, k, w, seen) => {
      if (!k) return;
      const x = map[k] || (map[k] = { w: 0, n: 0, seen: 0 });
      x.w += w; x.n++; if (seen) x.seen++;
    };
    for (const { srv, cfg } of list) {
      let items = [];
      try { items = await srv.catalog(cfg, "movie"); } catch (_) { continue; }
      out.servers.push(srv.name);
      for (const m of items) {
        out.movies++;
        if (m.watched) out.watched++;
        out.owned.push([norm(m.title), norm(m.originalTitle), m.year || 0, m.imdb || ""]);
        // visto = 3, en la biblioteca = 1; tu nota la ajusta (≥8 suma, ≤4 casi no cuenta)
        let w = m.watched ? 3 : 1;
        if (m.rating >= 8) w += 2; else if (m.rating && m.rating <= 4) w = 0.2;
        for (const g of m.genres || []) add(out.genres, g, w, m.watched);
        for (const d of (m.directors || []).slice(0, 2)) add(out.directors, d, w, m.watched);
        if (m.year) add(out.decades, String(Math.floor(m.year / 10) * 10), w, m.watched);
      }
    }
    // solo los directores con más de una película (la lista podría ser enorme)
    for (const [k, v] of Object.entries(out.directors)) if (v.n < 2) delete out.directors[k];
    return out;
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "media-taste") {
      taste().then(sendResponse, (e) => sendResponse({ configured: true, error: e.message, genres: {}, directors: {}, decades: {}, owned: [] }));
      return true;
    }
    if (msg?.action === "media-lookup") {
      lookup(msg.query).then(sendResponse, (e) => sendResponse({ configured: true, results: [], error: e.message }));
      return true;
    }
    if (msg?.action === "media-test") {
      const srv = servers[msg.server];
      if (!srv) { sendResponse({ ok: false, error: "Servidor desconocido" }); return; }
      const cfg = msg.server === "plex" ? srv.config({ plexUrl: msg.url, plexToken: msg.token }) : srv.config({ jfUrl: msg.url, jfKey: msg.token });
      srv.test(cfg).then((r) => sendResponse({ ok: true, ...r }), (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "media-reset") {
      Object.values(servers).forEach((s) => s.reset());
      sendResponse({ ok: true });
    }
  });

  globalThis.__uispaMedia = { lookup, activeAll, servers, folders };
})();
