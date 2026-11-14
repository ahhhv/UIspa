// UIspa · conector de «Descarga remota» (segundo plano): aMule en Docker, en un NAS
// o en otro ordenador. Dos formas de hablar con él:
//  · amuleapi (aMule 3.1 o posterior), en el puerto de su interfaz web (4711 en Docker):
//      POST /api/v1/auth/login?include_token=true  { password }  → { token, role, expires_at }
//      POST /api/v1/downloads  { links: [...], category_index }   → { results: [{ id, ok, error }] }
//  · aMuTorrent (interfaz web para aMule y clientes de torrent), puerto 4000:
//      cabecera X-API-Key (solo si tiene usuarios activados)
//      POST /api/v1/downloads/ed2k  { links: [...], categoryName } → { results: [{ link, success }] }
//  · Rucio (cliente P2P con puente a la red Kad de eMule), puerto 3003, sin
//    contraseña propia (opcionalmente detrás de un proxy con usuario y contraseña):
//      POST /api/v1/downloads/ed2k  { link, category_id }  → 202, un enlace por llamada
// La contraseña o clave se guarda solo en este navegador y únicamente se envía a tu aMule.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const KEYS = ["amType", "amUrl", "amUser", "amPass", "amCat"];
  const TYPES = ["amuleapi", "amutorrent", "rucio"];
  const NAMES = { amuleapi: "aMule", amutorrent: "aMuTorrent", rucio: "Rucio" };
  const typeOf = (t) => TYPES.includes(t) ? t : "amuleapi";
  const mem = { token: null, exp: 0, key: "" };

  const ERRORS = {
    invalid_credentials: "Contraseña incorrecta",
    rate_limited: "aMule ha bloqueado esta IP unos minutos por demasiados intentos fallidos",
    login_disabled: "aMule no tiene contraseña para la interfaz web (en Docker, WEBUI_PWD)",
    ec_unavailable: "La API de aMule no consigue conectar con aMule: comprueba que está en marcha",
    forbidden: "aMule ha rechazado la petición",
    unauthorized: "La sesión con aMule ha caducado"
  };

  const cleanUrl = (u) => String(u || "").trim().replace(/\/+$/, "");

  async function config() {
    const s = await api.storage.local.get(KEYS);
    const type = typeOf(s.amType);
    if (!s.amUrl || (type === "amuleapi" && !s.amPass)) return null;
    return { type, url: cleanUrl(s.amUrl), user: s.amUser || "", pass: s.amPass || "", cat: s.amCat ?? (type === "amuleapi" ? 0 : "") };
  }

  async function call(cfg, path, { method = "GET", body, token } = {}) {
    const headers = { Accept: "application/json" };
    if (cfg.type === "amutorrent" && cfg.pass) headers["X-API-Key"] = cfg.pass;
    if (cfg.type === "rucio" && (cfg.user || cfg.pass)) {
      headers.Authorization = "Basic " + btoa(unescape(encodeURIComponent(`${cfg.user}:${cfg.pass}`)));
    }
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = "Bearer " + token;
    let res;
    try {
      res = await fetch(cfg.url + path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: "omit", cache: "no-store" });
    } catch (_) {
      throw new Error(await globalThis.__uispaNoReach(cfg.url, `No se pudo conectar con ${cfg.url}. Comprueba la dirección y que aMule esté en marcha.`));
    }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { status: res.status, data };
  }
  const why = (r, fallback) => ERRORS[r.data?.error?.code] || r.data?.error?.message
    || (typeof r.data?.error === "string" ? r.data.error : "") || r.data?.message || `${fallback} (HTTP ${r.status})`;

  // ---- aMuTorrent
  const AMT_401 = "aMuTorrent pide identificarse: pon la clave de API de tu usuario (Ajustes → Gestión de usuarios)";
  async function amtCategories(cfg) {
    const r = await call(cfg, "/api/v1/categories");
    if (Array.isArray(r.data?.categories) && !r.data?.type) {
      throw new Error("Esa dirección parece la de Rucio, no la de aMuTorrent: elige arriba «Rucio».");
    }
    if (r.data?.error?.code || (await isAmuleApi(cfg))) {
      throw new Error("Esa dirección es la de aMule (su interfaz web nueva), no la de aMuTorrent: elige arriba «aMule 3.1 o posterior».");
    }
    if (r.status === 401) throw new Error(cfg.pass ? "Clave de API incorrecta" : AMT_401);
    if (r.status === 404 || (r.status === 200 && !Array.isArray(r.data?.data))) {
      throw new Error("En esa dirección no hay un aMuTorrent (o es una versión muy antigua). Comprueba el puerto: por defecto es el 4000.");
    }
    if (r.status !== 200) throw new Error(why(r, "No se pudo conectar con aMuTorrent"));
    return r.data.data.map((c) => ({ index: c.name, name: c.name === "Default" ? "Por defecto" : (c.title || c.name) }));
  }
  async function amtAdd(cfg, links, cat) {
    const body = { links };
    const name = typeof cat === "string" && cat ? cat : (typeof cfg.cat === "string" ? cfg.cat : "");
    if (name && name !== "Default") body.categoryName = name;
    const r = await call(cfg, "/api/v1/downloads/ed2k", { method: "POST", body });
    if (r.status === 401) throw new Error(cfg.pass ? "Clave de API incorrecta" : AMT_401);
    if (r.status === 403) throw new Error("Tu usuario de aMuTorrent no tiene permiso para añadir descargas");
    if (r.status !== 200 || r.data?.type === "error" || r.data?.success === false) throw new Error(why(r, "aMuTorrent no ha aceptado los enlaces"));
    const results = Array.isArray(r.data?.results) ? r.data.results : [];
    const failed = results.filter((x) => !x.success);
    return { ok: true, count: results.length - failed.length, failed: failed.length, error: "" };
  }

  async function login(cfg, fresh = false) {
    const key = cfg.url + "\n" + cfg.pass;
    if (!fresh && mem.key === key && mem.token && Date.now() / 1000 < mem.exp - 60) return mem.token;
    const r = await call(cfg, "/api/v1/auth/login?include_token=true", { method: "POST", body: { password: cfg.pass } });
    if (r.status === 404 || (r.status === 200 && !r.data)) {
      throw new Error("En esa dirección no hay una API de aMule. Hace falta aMule 3.1 o posterior con su interfaz web nueva (amuleapi); en Docker, la imagen ngosang/amule actualizada.");
    }
    if (r.status !== 200 || !r.data?.token) throw new Error(why(r, "No se pudo iniciar sesión en aMule"));
    if (r.data.role && r.data.role !== "admin") {
      throw new Error("Esa es la contraseña de invitado, que solo permite ver. Usa la de administrador (en Docker, WEBUI_PWD).");
    }
    Object.assign(mem, { token: r.data.token, exp: Number(r.data.expires_at) || 0, key });
    return mem.token;
  }

  // ---- Rucio
  const RUCIO_401 = "Rucio está detrás de un proxy que pide usuario y contraseña: ponlos en los ajustes";
  async function rucioCheck(cfg) {
    const r = await call(cfg, "/api/v1/status");
    if (r.data?.error?.code || (await isAmuleApi(cfg))) {
      throw new Error("Esa dirección es la de aMule (su interfaz web nueva), no la de Rucio: elige arriba «aMule 3.1 o posterior».");
    }
    if (r.data?.success === false || r.data?.type) {
      throw new Error("Esa dirección parece la de aMuTorrent, no la de Rucio: elige arriba «aMuTorrent».");
    }
    if (r.status === 401) throw new Error(cfg.user || cfg.pass ? "Usuario o contraseña del proxy incorrectos" : RUCIO_401);
    if (r.status !== 200 || !r.data?.peer_id) {
      throw new Error("En esa dirección no responde Rucio. Comprueba la dirección y el puerto (por defecto el 3003) y que su API escuche en la red (RUCIOD_API_LISTEN=0.0.0.0:3003).");
    }
    return r.data.version || "";
  }
  async function rucioCategories(cfg) {
    const r = await call(cfg, "/api/v1/categories");
    const list = Array.isArray(r.data?.categories) ? r.data.categories : [];
    return [{ index: "", name: "Por defecto" }, ...list.map((c) => ({ index: c.id, name: c.name }))];
  }
  async function rucioAdd(cfg, links, cat) {
    const id = cat !== undefined && cat !== "" ? cat : cfg.cat;
    const category_id = id === "" || id == null ? null : Number(id);
    let count = 0, failed = 0, error = "";
    for (const link of links) {
      // Rucio no entiende las barras codificadas (%7C): se manda el enlace tal cual
      const r = await call(cfg, "/api/v1/downloads/ed2k", { method: "POST", body: { link: link.replace(/%7C/gi, "|"), category_id } });
      if (r.status === 401) throw new Error(cfg.user || cfg.pass ? "Usuario o contraseña del proxy incorrectos" : RUCIO_401);
      if (r.status === 200 || r.status === 201 || r.status === 202) count++;
      else { failed++; error = error || why(r, "Rucio no ha aceptado el enlace"); }
    }
    if (!count && failed) throw new Error(error);
    return { ok: true, count, failed, error };
  }

  async function add(links, cat) {
    const cfg = await config();
    if (!cfg) throw new Error("La descarga remota no está configurada en los ajustes de UIspa");
    const res = cfg.type === "amutorrent" ? await amtAdd(cfg, links, cat)
      : cfg.type === "rucio" ? await rucioAdd(cfg, links, cat)
      : await amuleAdd(cfg, links, cat);
    return { ...res, target: NAMES[cfg.type] };
  }

  async function amuleAdd(cfg, links, cat) {
    const body = { links, category_index: Number.isInteger(cat) ? cat : (Number(cfg.cat) || 0) };
    let r = await call(cfg, "/api/v1/downloads", { method: "POST", token: await login(cfg), body });
    if (r.status === 401) r = await call(cfg, "/api/v1/downloads", { method: "POST", token: await login(cfg, true), body });
    if (r.status !== 202 && r.status !== 207 && r.status !== 200) throw new Error(why(r, "aMule no ha aceptado los enlaces"));
    const results = Array.isArray(r.data?.results) ? r.data.results : [];
    const failed = results.filter((x) => !x.ok);
    return { ok: true, count: results.length - failed.length, failed: failed.length, error: failed[0]?.error?.message || "" };
  }

  async function isAmuleApi(cfg) {
    try { return (await call(cfg, "/api/v1/version")).data?.service === "amuleapi"; } catch (_) { return false; }
  }

  async function test(raw) {
    const cfg = { type: typeOf(raw.type), url: cleanUrl(raw.url), user: raw.user || "", pass: raw.pass || "" };
    if (cfg.type === "amutorrent") return { version: "", categories: await amtCategories(cfg) };
    if (cfg.type === "rucio") {
      const version = await rucioCheck(cfg);
      return { version, categories: await rucioCategories(cfg) };
    }
    const v0 = await call(cfg, "/api/v1/version");
    if (v0.data?.service !== "amuleapi") {
      if (v0.status === 401 || v0.data?.type) throw new Error("Esa dirección parece la de aMuTorrent, no la de aMule: elige arriba «aMuTorrent».");
      let st = null;
      try { st = await call(cfg, "/api/v1/status"); } catch (_) {}
      if (st?.data?.peer_id) throw new Error("Esa dirección parece la de Rucio, no la de aMule: elige arriba «Rucio».");
      throw new Error("En esa dirección no responde la interfaz web de aMule 3.1 o posterior (amuleapi). Comprueba la dirección y el puerto; con versiones antiguas de aMule no funciona.");
    }
    const token = await login(cfg, true);
    const v = await call(cfg, "/api/v1/version");
    const c = await call(cfg, "/api/v1/categories?limit=100", { token });
    const categories = (c.data?.categories || []).map((x) => ({ index: x.index, name: x.index === 0 ? "Por defecto" : x.name }));
    return { version: v.data?.daemon_version || v.data?.amuleapi_version || "", categories };
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "am-status") {
      config().then((c) => sendResponse({ configured: !!c }), () => sendResponse({ configured: false }));
      return true;
    }
    if (msg?.action === "am-add") {
      add(msg.links || [], msg.cat).then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "am-test") {
      test(msg).then((r) => sendResponse({ ok: true, ...r }), (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "am-reset") {
      Object.assign(mem, { token: null, exp: 0, key: "" });
      sendResponse({ ok: true });
    }
  });

  globalThis.__uispaAmule = { add, test, mem };
})();
