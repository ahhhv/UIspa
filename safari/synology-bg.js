// UIspa · conector de Synology Download Station (segundo plano).
// Envía enlaces ed2k a Download Station mediante su API web (DSM 7).
// Las credenciales se guardan solo en este navegador y únicamente se envían
// a tu NAS.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const KEYS = ["dsUrl", "dsUser", "dsPass", "dsDest", "dsRecent"];
  const mem = { apis: null, sids: {}, key: "" }; // una sesión por aplicación de DSM

  const AUTH_ERRORS = {
    400: "Usuario o contraseña incorrectos",
    401: "La cuenta está desactivada",
    402: "La cuenta no tiene permiso para Download Station",
    403: "La cuenta tiene activada la verificación en dos pasos; desactívala para este usuario",
    404: "Falló la verificación en dos pasos",
    406: "La cuenta necesita activar la verificación en dos pasos",
    407: "El NAS ha bloqueado esta IP por demasiados intentos fallidos",
    408: "La contraseña ha caducado",
    409: "La contraseña ha caducado",
    410: "La contraseña debe cambiarse"
  };
  const TASK_ERRORS = {
    400: "No se pudieron enviar los enlaces",
    401: "Download Station ha alcanzado el máximo de descargas",
    402: "El usuario no tiene permiso para escribir en la carpeta de destino",
    403: "La carpeta de destino no existe",
    406: "Download Station no tiene carpeta de destino predeterminada: indica una en los ajustes de UIspa",
    407: "No se pudo usar la carpeta de destino"
  };
  const COMMON_ERRORS = {
    102: "Download Station no está instalado o no está en marcha",
    103: "Esta versión de Download Station no admite la operación",
    105: "El usuario no tiene permiso para Download Station",
    119: "La sesión ha caducado"
  };

  // "/video/Series/" → "video/Series" (Download Station quiere la ruta sin barra inicial)
  const cleanDir = (d) => String(d || "").trim().replace(/^\/+|\/+$/g, "");

  async function config() {
    const s = await api.storage.local.get(KEYS);
    if (!s.dsUrl || !s.dsUser || !s.dsPass) return null;
    return { url: String(s.dsUrl).replace(/\/+$/, ""), user: s.dsUser, pass: s.dsPass, dest: cleanDir(s.dsDest), recent: Array.isArray(s.dsRecent) ? s.dsRecent : [] };
  }

  // Llamada a la API web de DSM. Los parámetros van en el cuerpo (POST) para
  // que la contraseña no aparezca en direcciones ni registros.
  async function call(cfg, path, params) {
    let res;
    try {
      res = await fetch(`${cfg.url}/webapi/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: new URLSearchParams(params).toString(),
        credentials: "omit"
      });
    } catch (e) {
      throw new Error(await globalThis.__uispaNoReach(cfg.url, "No se puede conectar con el NAS"));
    }
    if (!res.ok) throw new Error("El NAS respondió con el error " + res.status);
    let data;
    try { data = await res.json(); } catch (_) { throw new Error("La dirección no parece un NAS Synology"); }
    return data;
  }

  // Rutas y versiones de las API que necesitamos (cambian entre versiones de DSM)
  async function apis(cfg) {
    if (mem.apis) return mem.apis;
    const r = await call(cfg, "query.cgi", {
      api: "SYNO.API.Info", version: "1", method: "query",
      query: "SYNO.API.Auth,SYNO.DownloadStation.Task,SYNO.DownloadStation.Info,SYNO.FileStation.List,SYNO.FileStation.CreateFolder"
    });
    if (!r.success || !r.data) throw new Error("La dirección no parece un NAS Synology");
    if (!r.data["SYNO.DownloadStation.Task"]) throw new Error("Download Station no está instalado en el NAS");
    mem.apis = r.data;
    return r.data;
  }

  async function login(cfg, session) {
    const key = `${cfg.url}|${cfg.user}`;
    if (mem.key !== key) { mem.sids = {}; mem.key = key; }
    if (mem.sids[session]) return mem.sids[session];
    const a = (await apis(cfg))["SYNO.API.Auth"];
    const version = String(Math.min(a.maxVersion || 3, 6));
    const r = await call(cfg, a.path, {
      api: "SYNO.API.Auth", version, method: "login",
      account: cfg.user, passwd: cfg.pass, session, format: "sid" // ggignore (variable, no es una contraseña)
    });
    if (!r.success) {
      const code = r.error?.code;
      throw new Error(AUTH_ERRORS[code] || COMMON_ERRORS[code] || `No se pudo iniciar sesión (error ${code})`);
    }
    mem.sids[session] = r.data.sid;
    return mem.sids[session];
  }

  // Llama a una API de DSM; si la sesión ha caducado, vuelve a entrar una vez
  async function syno(cfg, apiName, params, errors = {}, session = "DownloadStation") {
    const info = (await apis(cfg))[apiName];
    if (!info) throw new Error(errors.missing || "Esta versión de DSM no ofrece esa función");
    const version = String(Math.min(info.maxVersion || 1, apiName === "SYNO.FileStation.List" ? 2 : 1));
    for (let attempt = 0; attempt < 2; attempt++) {
      const sid = await login(cfg, session);
      const r = await call(cfg, info.path, { api: apiName, version, ...params, _sid: sid });
      if (r.success) return r.data || {};
      const code = r.error?.code;
      if ((code === 105 || code === 106 || code === 107 || code === 119) && attempt === 0) { delete mem.sids[session]; continue; }
      throw new Error(errors[code] || COMMON_ERRORS[code] || `El NAS respondió con el error ${code}`);
    }
  }
  const ds = (cfg, apiName, params, errors) => syno(cfg, apiName, params, errors, "DownloadStation");

  // ------------------------------------------------------------ carpetas (File Station)
  const FS_ERRORS = {
    missing: "File Station no está disponible en el NAS",
    105: "El usuario no tiene permiso para File Station: actívalo en DSM para poder explorar carpetas",
    119: "La sesión ha caducado",
    407: "No tienes permiso para ver esta carpeta",
    408: "La carpeta no existe"
  };
  // Lista las subcarpetas de una ruta ("" = carpetas compartidas). Las rutas se
  // devuelven sin barra inicial, que es como las espera Download Station.
  async function listFolders(path) {
    const cfg = await config();
    if (!cfg) return { ok: false, error: "Download Station no está configurado" };
    const dir = cleanDir(path);
    const strip = (x) => cleanDir(x);
    if (!dir) {
      const d = await syno(cfg, "SYNO.FileStation.List", { method: "list_share", sort_by: "name" }, FS_ERRORS, "FileStation");
      return { ok: true, path: "", folders: (d.shares || []).map((x) => ({ name: x.name, path: strip(x.path) })) };
    }
    const d = await syno(cfg, "SYNO.FileStation.List", { method: "list", folder_path: "/" + dir, filetype: "dir", sort_by: "name" }, FS_ERRORS, "FileStation");
    return { ok: true, path: dir, folders: (d.files || []).filter((x) => x.isdir !== false).map((x) => ({ name: x.name, path: strip(x.path) })) };
  }

  // Crea una subcarpeta dentro de "parent" (no se pueden crear carpetas compartidas)
  const CREATE_ERRORS = {
    ...FS_ERRORS,
    missing: "Esta versión de DSM no permite crear carpetas desde la extensión",
    407: "No tienes permiso para crear carpetas aquí",
    414: "Ya existe una carpeta con ese nombre",
    418: "Ese nombre no es válido",
    1100: "El NAS no pudo crear la carpeta",
    1101: "Se ha alcanzado el límite de carpetas"
  };
  async function createFolder(parent, rawName) {
    const cfg = await config();
    if (!cfg) return { ok: false, error: "Download Station no está configurado" };
    const dir = cleanDir(parent);
    const name = String(rawName || "").trim();
    if (!dir) return { ok: false, error: "Entra primero en una carpeta compartida" };
    if (!name || name === "." || name === ".." || /[\\/:*?"<>|,]/.test(name) || name.length > 200) {
      return { ok: false, error: "Ese nombre no es válido" };
    }
    const d = await syno(cfg, "SYNO.FileStation.CreateFolder",
      { method: "create", folder_path: "/" + dir, name, force_parent: "false" }, CREATE_ERRORS, "FileStation");
    const made = d.folders?.[0]?.path;
    return { ok: true, path: made ? cleanDir(made) : `${dir}/${name}` };
  }

  // Las comas separan enlaces en la API: se codifican las que haya dentro de un nombre
  const encodeLink = (l) => l.replace(/,/g, "%2C");

  // dest: carpeta elegida al enviar; si viene vacía, la carpeta por defecto de los ajustes
  async function add(links, chosen) {
    const cfg = await config();
    if (!cfg) return { ok: false, error: "Download Station no está configurado" };
    const params = { method: "create", uri: links.map(encodeLink).join(",") };
    const dest = cleanDir(chosen) || cfg.dest;
    if (dest) params.destination = dest;
    await ds(cfg, "SYNO.DownloadStation.Task", params, TASK_ERRORS);
    // recuerda las últimas carpetas usadas para ofrecerlas la próxima vez
    if (dest) {
      const recent = [dest, ...cfg.recent.filter((d) => d !== dest)].slice(0, 20);
      await api.storage.local.set({ dsRecent: recent });
    }
    return { ok: true, count: links.length, destination: dest || "" };
  }

  async function test(raw) {
    mem.apis = null; mem.sids = {};
    const cfg = { url: String(raw.url).replace(/\/+$/, ""), user: raw.user, pass: raw.pass };
    const conf = await ds(cfg, "SYNO.DownloadStation.Info", { method: "getconfig" });
    const warnings = [];
    if (conf.emule_enabled === false) warnings.push("eMule está desactivado en Download Station: actívalo en Configuración → General → Habilitar descargas eMule.");
    let browse = true;
    try { await syno(cfg, "SYNO.FileStation.List", { method: "list_share", limit: "1" }, FS_ERRORS, "FileStation"); }
    catch (_) { browse = false; warnings.push("El usuario no tiene permiso para File Station: podrás escribir la carpeta al enviar, pero no explorarla. Actívalo en DSM → Usuario y grupo → Aplicaciones → File Station."); }
    const def = conf.emule_default_destination || conf.default_destination || "";
    if (!def && !cleanDir(raw.dest)) warnings.push("Download Station no tiene carpeta de destino predeterminada: indica una carpeta por defecto.");
    return { defaultDestination: def, warnings, browse };
  }

  // ---------------------------------------------------------------------------
  // Carpeta propuesta según Plex / Jellyfin. El servidor multimedia ve las rutas
  // a su manera: «/volume1/medialibrary/tv/911» si está instalado en el NAS, o
  // «/tv/911» si va en Docker. Se traducen a la carpeta del NAS así:
  //   1. equivalencias escritas en los ajustes («/tv = medialibrary/tv»)
  //   2. equivalencias que UIspa ya descubrió antes
  //   3. quitando «/volumeN/»
  //   4. buscando en el NAS una carpeta que termine igual (y se recuerda)
  async function exists(cfg, dir) {
    try {
      await syno(cfg, "SYNO.FileStation.List", { method: "list", folder_path: "/" + dir, filetype: "dir", limit: 1 }, FS_ERRORS, "FileStation");
      return true;
    } catch (_) { return false; }
  }
  function parseMap(text) {
    return String(text || "").split(/\n/).map((l) => l.split("=")).filter((x) => x.length === 2)
      .map(([from, to]) => ({ from: "/" + cleanDir(from), to: cleanDir(to) })).filter((m) => m.to);
  }
  function applyMap(maps, path) {
    const best = maps.filter((m) => path === m.from || path.startsWith(m.from === "/" ? "/" : m.from + "/"))
      .sort((a, b) => b.from.length - a.from.length)[0];
    if (!best) return null;
    return cleanDir(best.to + "/" + path.slice(best.from === "/" ? 1 : best.from.length));
  }
  async function resolvePath(cfg, raw) {
    const path = "/" + cleanDir(String(raw || "").replace(/\\/g, "/"));
    if (path === "/") return null;
    const { pathMap = "", pathMapAuto = [] } = await api.storage.local.get(["pathMap", "pathMapAuto"]);
    for (const maps of [parseMap(pathMap), pathMapAuto]) {
      const d = applyMap(maps, path);
      if (d && (await exists(cfg, d))) return d;
    }
    const vol = /^\/volume\d+\/(.+)$/.exec(path);
    if (vol && (await exists(cfg, cleanDir(vol[1])))) return cleanDir(vol[1]);
    // Búsqueda: quitando carpetas del principio y probando con cada carpeta compartida
    const segs = cleanDir(path).split("/");
    let shares = [];
    try { shares = (await listFolders("")).folders.map((f) => f.path); } catch (_) {}
    for (let i = 0; i < Math.min(segs.length, 4); i++) {
      const rest = segs.slice(i).join("/");
      const cands = [rest, ...shares.filter((sh) => sh !== segs[i]).map((sh) => sh + "/" + rest)];
      for (const c of cands) {
        if (!(await exists(cfg, c))) continue;
        // Se recuerda la equivalencia para la próxima vez
        const from = "/" + segs.slice(0, i).join("/");
        const to = cleanDir(c.slice(0, c.length - rest.length));
        const learned = (await api.storage.local.get("pathMapAuto")).pathMapAuto || [];
        if (!learned.some((m) => m.from === from && m.to === to)) {
          learned.push({ from, to });
          await api.storage.local.set({ pathMapAuto: learned.slice(-10) });
        }
        return c;
      }
    }
    return null;
  }

  async function suggest(query) {
    const cfg = await config();
    const media = globalThis.__uispaMedia;
    if (!cfg || !media?.folders || !query) return { ok: true, own: null, libraries: [] };
    const f = await media.folders(query);
    const own = f.own ? await resolvePath(cfg, f.own) : null;
    const libraries = [];
    for (const l of f.libraries.slice(0, 4)) {
      const d = await resolvePath(cfg, l);
      if (d && !libraries.includes(d)) libraries.push(d);
    }
    return { ok: true, server: f.server, own, libraries };
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "ds-suggest") {
      suggest(msg.query).then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "ds-status") {
      config().then((c) => sendResponse(c ? { configured: true, dest: c.dest, recent: c.recent } : { configured: false }), () => sendResponse({ configured: false }));
      return true;
    }
    if (msg?.action === "ds-add") {
      add(msg.links || [], msg.dest).then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "ds-list") {
      listFolders(msg.path).then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "ds-mkdir") {
      createFolder(msg.path, msg.name).then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "ds-test") {
      test(msg).then((r) => sendResponse({ ok: true, ...r }), (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "ds-reset") {
      mem.apis = null; mem.sids = {}; mem.key = "";
      sendResponse({ ok: true });
    }
  });

  globalThis.__uispaSynology = { add, test, listFolders, createFolder, mem };
})();
