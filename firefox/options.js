// UIspa · página de ajustes (conexión con Plex o Jellyfin)
const api = typeof browser !== "undefined" ? browser : chrome;
const $ = (id) => document.getElementById(id);
const status = $("status");

const SERVERS = {
  plex: {
    name: "Plex", port: "32400", urlKey: "plexUrl", tokenKey: "plexToken",
    tokenLabel: "Token de Plex", missing: "Falta el token de Plex.", placeholder: "http://192.168.1.50:32400", tokenPlaceholder: "xxxxxxxxxxxxxxxxxxxx"
  },
  jellyfin: {
    name: "Jellyfin", port: "8096", urlKey: "jfUrl", tokenKey: "jfKey",
    tokenLabel: "Clave de API de Jellyfin", missing: "Falta la clave de API de Jellyfin.", placeholder: "http://192.168.1.50:8096", tokenPlaceholder: "clave de 32 caracteres"
  }
};
let stored = {};

const current = () => document.querySelector("input[name=server]:checked").value;

function say(msg, cls = "") {
  status.className = cls;
  status.textContent = msg;
}

function normalizeUrl(raw, port) {
  let v = (raw || "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "http://" + v;
  try {
    const u = new URL(v);
    if (!u.port && u.protocol === "http:" && !/plex\.direct$/i.test(u.hostname)) u.port = port;
    // se conserva la ruta por si Jellyfin está en un subdirectorio (/jellyfin)
    return (u.origin + u.pathname).replace(/\/+$/, "");
  } catch (_) { return null; }
}

// Muestra los campos del servidor elegido con lo que haya guardado
function showServer() {
  const s = SERVERS[current()];
  $("url").placeholder = s.placeholder;
  $("token").placeholder = s.tokenPlaceholder;
  $("tokenLabel").textContent = s.tokenLabel;
  $("url").value = stored[s.urlKey] || "";
  $("token").value = stored[s.tokenKey] || "";
  document.querySelectorAll("details[data-for]").forEach((d) => (d.hidden = d.dataset.for !== current()));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.querySelector("input").checked));
  say(isSet(current()) ? `${s.name} conectado. Puedes probar la conexión cuando quieras.` : "", isSet(current()) ? "ok" : "");
  dots();
}

const isSet = (id) => !!(stored[SERVERS[id].urlKey] && stored[SERVERS[id].tokenKey]);

// Punto verde en la pestaña de cada servidor conectado
function dots() {
  for (const id of Object.keys(SERVERS)) {
    const d = document.querySelector(`[data-dot=${id}]`);
    d.classList.toggle("set", isSet(id));
    d.title = isSet(id) ? "Conectado" : "Sin configurar";
  }
}

// Patrón de permiso para el servidor. Sin puerto: Safari no admite puertos en
// los patrones, y en Chrome y Firefox un patrón sin puerto cubre todos.
function hostPattern(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

// Pide permiso para hablar con el servidor (solo esa dirección).
// Debe llamarse directamente desde un clic.
async function withServer(fn) {
  const id = current();
  const s = SERVERS[id];
  const url = normalizeUrl($("url").value, s.port);
  const token = $("token").value.trim();
  if (!url) { say(`Escribe una dirección válida, por ejemplo ${s.placeholder}`, "err"); return; }
  if (!token) { say(s.missing, "err"); return; }
  const origin = new URL(url).origin;
  let granted = false;
  try { granted = await api.permissions.request({ origins: [hostPattern(url)] }); }
  catch (e) { say("No se pudo pedir permiso: " + e.message, "err"); return; }
  if (!granted) { say(`Sin permiso para acceder a ${origin}, la extensión no puede consultar tu ${s.name}.`, "err"); return; }
  $("url").value = url;
  await fn(id, url, token);
}

async function testConnection(id, url, token) {
  say("Conectando…");
  const r = await api.runtime.sendMessage({ action: "media-test", server: id, url, token });
  if (!r?.ok) { say(r?.error || "No se pudo conectar.", "err"); return false; }
  status.className = "ok";
  status.textContent = `Conectado a «${r.name}». Bibliotecas encontradas:`;
  const ul = document.createElement("ul");
  const items = r.sections.length ? r.sections.map((x) => `${x.title} (${x.type === "show" ? "series" : "películas"})`) : ["Ninguna biblioteca de películas o series."];
  for (const t of items) {
    const li = document.createElement("li");
    li.textContent = t;
    ul.append(li);
  }
  status.append(ul);
  return true;
}

$("test").addEventListener("click", () => withServer(testConnection));

$("save").addEventListener("click", () => withServer(async (id, url, token) => {
  const s = SERVERS[id];
  const data = { [s.urlKey]: url, [s.tokenKey]: token };
  await api.storage.local.set(data);
  await api.storage.local.remove("server"); // ya no hay un único servidor activo
  Object.assign(stored, data);
  dots();
  await api.runtime.sendMessage({ action: "media-reset" });
  const others = Object.keys(SERVERS).filter((k) => k !== id && isSet(k)).map((k) => SERVERS[k].name);
  if (await testConnection(id, url, token)) status.prepend(`Guardado. ${others.length ? `UIspa consultará ${s.name} y ${others.join(" y ")}. ` : ""}`);
}));

$("clear").addEventListener("click", async () => {
  const s = SERVERS[current()];
  const url = stored[s.urlKey];
  const remove = [s.urlKey, s.tokenKey];
  await api.storage.local.remove(remove);
  remove.forEach((k) => delete stored[k]);
  dots();
  await api.runtime.sendMessage({ action: "media-reset" });
  if (url) { try { await api.permissions.remove({ origins: [hostPattern(url)] }); } catch (_) {} }
  $("url").value = ""; $("token").value = "";
  say(`${s.name} desconectado. Se han borrado la dirección y la clave.`);
});

$("show").addEventListener("click", () => {
  $("token").type = $("token").type === "password" ? "text" : "password";
});

document.querySelectorAll("input[name=server]").forEach((r) => r.addEventListener("change", showServer));

api.storage.local.get(["server", "plexUrl", "plexToken", "jfUrl", "jfKey"]).then((s) => {
  stored = s;
  // Se abre en Plex salvo que solo esté configurado Jellyfin
  const id = !isSet("plex") && isSet("jellyfin") ? "jellyfin" : "plex";
  document.querySelector(`input[name=server][value=${id}]`).checked = true;
  showServer();
});

// Título según la extensión
{
  const name = api.runtime.getManifest().name;
  if (name !== "UIspa") { $("title").textContent = name + " · Ajustes"; document.title = name + " · Ajustes"; }
}

// ------------------------------------------------------------ Synology Download Station
{
  const st = $("dsStatus");
  const dsSay = (msg, cls = "") => { st.className = cls; st.textContent = msg; };
  const DS_KEYS = ["dsUrl", "dsUser", "dsPass", "dsDest"];

  function dsUrl(raw) {
    let v = (raw || "").trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = "http://" + v;
    try {
      const u = new URL(v);
      if (!u.port) u.port = u.protocol === "https:" ? "5001" : "5000";
      return u.origin;
    } catch (_) { return null; }
  }

  // Lee el formulario y pide permiso para la dirección del NAS (desde el clic)
  async function withNas(fn) {
    const url = dsUrl($("dsUrl").value);
    const user = $("dsUser").value.trim();
    const pass = $("dsPass").value;
    if (!url) { dsSay("Escribe la dirección del NAS, por ejemplo http://192.168.1.10:5000", "err"); return; }
    if (!user || !pass) { dsSay("Faltan el usuario o la contraseña.", "err"); return; }
    let granted = false;
    try { granted = await api.permissions.request({ origins: [hostPattern(url)] }); }
    catch (e) { dsSay("No se pudo pedir permiso: " + e.message, "err"); return; }
    if (!granted) { dsSay(`Sin permiso para acceder a ${url}, la extensión no puede usar tu NAS.`, "err"); return; }
    $("dsUrl").value = url;
    await fn({ url, user, pass, dest: $("dsDest").value.trim() });
  }

  async function dsTest(cfg) {
    dsSay("Conectando…");
    const r = await api.runtime.sendMessage({ action: "ds-test", ...cfg });
    if (!r?.ok) { dsSay(r?.error || "No se pudo conectar.", "err"); return false; }
    dsSay(`Conectado a Download Station como «${cfg.user}».` + (r.defaultDestination ? ` Carpeta predeterminada: ${r.defaultDestination}.` : ""), "ok");
    for (const w of r.warnings || []) {
      const span = document.createElement("span");
      span.className = "warn";
      span.textContent = "⚠ " + w;
      st.append(span);
    }
    return true;
  }

  $("dsTest").addEventListener("click", () => withNas(dsTest));
  $("dsSave").addEventListener("click", () => withNas(async (cfg) => {
    const dest = cfg.dest.replace(/^\/+|\/+$/g, "");
    $("dsDest").value = dest;
    await api.storage.local.set({ dsUrl: cfg.url, dsUser: cfg.user, dsPass: cfg.pass, dsDest: dest });
    await api.runtime.sendMessage({ action: "ds-reset" });
    if (await dsTest(cfg)) st.prepend("Guardado. Recarga Hispashare para ver los botones 📥. ");
  }));
  $("dsClear").addEventListener("click", async () => {
    const { dsUrl: old } = await api.storage.local.get("dsUrl");
    await api.storage.local.remove([...DS_KEYS, "dsRecent"]);
    await api.runtime.sendMessage({ action: "ds-reset" });
    if (old) { try { await api.permissions.remove({ origins: [hostPattern(old)] }); } catch (_) {} }
    DS_KEYS.forEach((k) => ($(k).value = ""));
    dsSay("Download Station desconectado. Se han borrado la dirección y las credenciales.");
  });

  api.storage.local.get(DS_KEYS).then((s) => {
    DS_KEYS.forEach((k) => { if (s[k]) $(k).value = s[k]; });
    if (s.dsUrl && s.dsUser && s.dsPass) dsSay("Download Station configurado. Puedes probar la conexión cuando quieras.", "ok");
  });
}

// ------------------------------------------------------------ apariencia
const LOOK_DEFAULT = { theme: "dark", size: "m", titleSize: "m", infinite: true };
async function loadLook() {
  const { look } = await api.storage.local.get("look");
  const l = { ...LOOK_DEFAULT, ...(look || {}) };
  $("lookTheme").value = l.theme;
  $("lookSize").value = l.size;
  $("lookTitleSize").value = l.titleSize || "m";
  $("lookInfinite").checked = !!l.infinite;
}
async function saveLook() {
  const look = {
    theme: $("lookTheme").value,
    size: $("lookSize").value,
    titleSize: $("lookTitleSize").value,
    infinite: $("lookInfinite").checked
  };
  await api.storage.local.set({ look });
  $("lookStatus").textContent = "Guardado. Se aplica al momento en las pestañas de Hispashare abiertas.";
}
for (const id of ["lookTheme", "lookSize", "lookTitleSize", "lookInfinite"]) $(id).addEventListener("change", saveLook);
loadLook();

// ------------------------------------------------------------ calendario de capítulos
{
  const st = $("calStatus");
  const calSay = (msg, cls = "") => { st.className = cls; st.textContent = msg; };
  let savedKey = "";

  $("calOn").addEventListener("change", async (e) => {
    if (e.target.checked) await api.storage.local.remove("calOff");
    else await api.storage.local.set({ calOff: true });
    calSay(e.target.checked ? "Calendario activado." : "Calendario desactivado.", "ok");
  });
  $("tmdbShow").addEventListener("click", () => {
    $("tmdbKey").type = $("tmdbKey").type === "password" ? "text" : "password";
  });
  async function test(key) {
    calSay("Comprobando la clave…");
    const r = await api.runtime.sendMessage({ action: "cal-test", key });
    if (!r?.ok) { calSay(r?.error || "No se pudo comprobar la clave.", "err"); return false; }
    calSay("La clave de TMDb funciona.", "ok");
    return true;
  }
  $("tmdbTest").addEventListener("click", () => test($("tmdbKey").value));
  $("tmdbSave").addEventListener("click", async () => {
    const key = $("tmdbKey").value.trim();
    if (!key) { calSay("Escribe la clave o pulsa «Quitar clave» para usar TVmaze.", "err"); return; }
    if (!(await test(key))) return;
    await api.storage.local.set({ tmdbKey: key });
    savedKey = key;
    calSay("Guardado. Las fichas de series mostrarán fechas y títulos de TMDb.", "ok");
  });
  $("tmdbClear").addEventListener("click", async () => {
    await api.storage.local.remove("tmdbKey");
    savedKey = "";
    $("tmdbKey").value = "";
    calSay("Clave quitada. Las fechas vendrán de TVmaze.");
  });
  api.storage.local.get(["calOff", "tmdbKey"]).then((s) => {
    $("calOn").checked = !s.calOff;
    if (s.tmdbKey) { savedKey = s.tmdbKey; $("tmdbKey").value = s.tmdbKey; calSay("Usando TMDb con tu clave.", "ok"); }
  });
  globalThis.__calDirty = () => $("tmdbKey").value.trim() !== savedKey && !!$("tmdbKey").value.trim();
}

// ------------------------------------------------------------ asistente de configuración
// Muestra las secciones de una en una. «Siguiente» guarda lo que hayas escrito
// en ese paso (con su prueba de conexión) antes de avanzar.
{
  const STEPS = [
    { id: "sec-welcome", name: "Bienvenida", intro: "" },
    { id: "sec-look", name: "Apariencia", intro: "Elige cómo quieres ver Hispashare. Se guarda al momento." },
    { id: "sec-media", name: "Plex / Jellyfin", intro: "Si tienes Plex o Jellyfin, conéctalo para ver en cada ficha qué ya tienes. Puedes configurar los dos (pestañas). Si no usas ninguno, pulsa Omitir.",
      dirty: () => {
        const s = SERVERS[current()];
        const url = $("url").value.trim(), token = $("token").value.trim();
        return !!(url && token) && (url !== (stored[s.urlKey] || "") || token !== (stored[s.tokenKey] || ""));
      }, save: "save", status: "status" },
    { id: "sec-nas", name: "NAS", intro: "Si tienes un Synology con Download Station, conéctalo para mandar descargas con 📥. Sigue los pasos de «¿Cómo lo preparo en el NAS?». Si no, pulsa Omitir.",
      dirty: () => !!($("dsUrl").value.trim() && $("dsUser").value.trim() && $("dsPass").value) && !nasSaved(), save: "dsSave", status: "dsStatus" },
    { id: "sec-cal", name: "Calendario", intro: "Las fechas de los próximos capítulos funcionan ya, sin configurar nada. La clave de TMDb es opcional: solo añade los títulos en castellano.",
      dirty: () => globalThis.__calDirty?.(), save: "tmdbSave", status: "calStatus" },
    { id: "sec-done", name: "Listo", intro: "" }
  ];
  let step = 0, nasStored = {};
  const nasSaved = () => $("dsUrl").value.trim() === (nasStored.dsUrl || "") && $("dsUser").value.trim() === (nasStored.dsUser || "") && $("dsPass").value === (nasStored.dsPass || "");
  const refreshNas = () => api.storage.local.get(["dsUrl", "dsUser", "dsPass"]).then((s) => { nasStored = s; });
  refreshNas();

  const all = () => [...document.querySelectorAll("main > section")];
  function render() {
    const cur = STEPS[step];
    all().forEach((sec) => (sec.hidden = sec.id !== cur.id));
    const ol = $("wizSteps");
    ol.textContent = "";
    STEPS.forEach((s, i) => {
      const li = document.createElement("li");
      li.textContent = s.name;
      li.className = i < step ? "done" : i === step ? "on" : "";
      ol.append(li);
    });
    $("wizIntro").textContent = cur.intro;
    $("wizIntro").hidden = !cur.intro;
    $("wizBack").hidden = step === 0;
    $("wizSkip").hidden = !cur.save;
    $("wizNext").textContent = step === 0 ? "Empezar →" : step === STEPS.length - 1 ? "Cerrar" : "Siguiente →";
    if (cur.id === "sec-done") summary();
    // en el asistente, la ayuda de cada paso se muestra abierta
    document.querySelectorAll(`#${cur.id} details`).forEach((d) => (d.open = true));
    window.scrollTo({ top: 0 });
  }
  async function summary() {
    const s = await api.storage.local.get(["plexUrl", "plexToken", "jfUrl", "jfKey", "dsUrl", "dsUser", "dsPass", "tmdbKey", "calOff", "look"]);
    const ul = $("wizSummary");
    ul.textContent = "";
    const theme = { dark: "oscuro", light: "claro", auto: "automático" }[s.look?.theme || "dark"];
    const items = [
      `Tema ${theme}.`,
      s.plexUrl && s.plexToken ? "✓ Plex conectado." : "Plex: sin configurar.",
      s.jfUrl && s.jfKey ? "✓ Jellyfin conectado." : "Jellyfin: sin configurar.",
      s.dsUrl && s.dsUser && s.dsPass ? "✓ NAS conectado (botones 📥)." : "NAS: sin configurar.",
      s.calOff ? "Calendario de capítulos desactivado." : s.tmdbKey ? "✓ Calendario con TMDb (títulos en castellano)." : "✓ Calendario con fechas de TVmaze."
    ];
    for (const t of items) { const li = document.createElement("li"); li.textContent = t; ul.append(li); }
  }
  // Espera a que el estado de la sección termine (ok / err) tras pulsar Guardar
  function waitStatus(id) {
    const el = $(id);
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        const done = /\b(ok|err)\b/.test(el.className) && !/…$/.test(el.textContent.trim());
        if (done) return resolve(el.className.includes("ok"));
        if (Date.now() - t0 > 25000) return resolve(false);
        setTimeout(tick, 150);
      };
      setTimeout(tick, 150);
    });
  }
  function open() {
    document.body.classList.add("wizard");
    $("wizBar").hidden = $("wizNav").hidden = false;
    $("wizStart").hidden = true;
    step = 0;
    render();
  }
  function close() {
    document.body.classList.remove("wizard");
    $("wizBar").hidden = $("wizNav").hidden = true;
    $("wizStart").hidden = false;
    all().forEach((sec) => (sec.hidden = sec.classList.contains("wiz-only")));
    if (location.hash) history.replaceState(null, "", location.pathname);
  }
  $("wizOpen").addEventListener("click", open);
  $("wizBack").addEventListener("click", () => { if (step > 0) { step--; render(); } });
  $("wizSkip").addEventListener("click", () => { step++; render(); });
  $("wizNext").addEventListener("click", async () => {
    const cur = STEPS[step];
    if (step === STEPS.length - 1) { close(); return; }
    if (cur.save && cur.dirty?.()) {
      // se pulsa «Guardar» dentro del mismo clic (los permisos lo necesitan)
      const st = $(cur.status);
      st.className = "";
      $(cur.save).click();
      const btn = $("wizNext");
      btn.disabled = true;
      const ok = await waitStatus(cur.status);
      btn.disabled = false;
      if (cur.id === "sec-nas") await refreshNas();
      if (!ok) return; // se queda en el paso para que veas el error
    }
    step++;
    render();
  });
  all().forEach((sec) => { if (sec.classList.contains("wiz-only")) sec.hidden = true; });
  if (location.hash === "#asistente") open();
}

// ------------------------------------------------------------ favoritos
{
  let area = api.storage.sync || api.storage.local;
  const PREFIX = "fav:";
  const st = $("favStatus");
  const favSay = (msg, cls = "") => { st.className = cls; st.textContent = msg; };
  async function all() {
    let items;
    try { items = await area.get(null); } catch (_) { area = api.storage.local; items = await area.get(null); }
    return Object.entries(items || {}).filter(([k, v]) => k.startsWith(PREFIX) && v?.id).map(([, v]) => v)
      .sort((a, b) => (b.added || 0) - (a.added || 0));
  }
  async function render() {
    const list = await all();
    const ul = $("favList");
    ul.textContent = "";
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "Todavía no tienes favoritos.";
      ul.append(li);
    }
    for (const f of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "https://www.hispashare.org" + f.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = f.title + (f.year ? ` (${f.year})` : "");
      li.append(a);
      if (f.news) { const n = document.createElement("span"); n.className = "fav-new"; n.textContent = f.news; li.append(n); }
      const x = document.createElement("button");
      x.type = "button"; x.className = "ghost fav-x"; x.textContent = "Quitar"; x.title = "Quitar de favoritos";
      x.addEventListener("click", async () => { await area.remove(PREFIX + f.id); render(); });
      li.append(x);
      ul.append(li);
    }
    $("favClear").disabled = $("favExport").disabled = !list.length;
  }
  $("favCheck").addEventListener("change", async (e) => {
    if (e.target.checked) await api.storage.local.remove("favCheckOff");
    else await api.storage.local.set({ favCheckOff: true });
  });
  $("favExport").addEventListener("click", async () => {
    const list = await all();
    const blob = new Blob([JSON.stringify({ uispa: "favoritos", version: 1, items: list }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "uispa-favoritos.json";
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    favSay(`Exportados ${list.length} favoritos.`, "ok");
  });
  $("favImport").addEventListener("click", () => $("favFile").click());
  $("favFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const items = (Array.isArray(data) ? data : data.items || []).filter((f) => f && /^\d+$/.test(String(f.id)) && f.title && /^\/?\?view=title&id=\d+/.test(String(f.url || "").replace(/^\/(index\.php)?/, "/")));
      if (!items.length) { favSay("El archivo no tiene favoritos de UIspa.", "err"); return; }
      const clean = items.map((f) => ({
        id: String(f.id), url: String(f.url), title: String(f.title).slice(0, 200), year: String(f.year || "").slice(0, 4),
        poster: /^https?:\/\//.test(f.poster || "") ? String(f.poster).slice(0, 500) : "",
        type: ["movie", "series", "doc", "music"].includes(f.type) ? f.type : "movie",
        added: Number(f.added) || Date.now(), seen: "", sig: "", checked: 0, news: null
      }));
      await area.set(Object.fromEntries(clean.map((f) => [PREFIX + f.id, f])));
      favSay(`Importados ${clean.length} favoritos.`, "ok");
      render();
    } catch (err) {
      favSay("No se pudo leer el archivo: " + err.message, "err");
    }
  });
  $("favClear").addEventListener("click", async () => {
    const list = await all();
    if (!list.length) return;
    if (!confirm(`¿Borrar tus ${list.length} favoritos?`)) return;
    await area.remove(list.map((f) => PREFIX + f.id));
    favSay("Favoritos borrados.");
    render();
  });
  api.storage.local.get("favCheckOff").then((s) => { $("favCheck").checked = !s.favCheckOff; });
  api.storage.onChanged.addListener((changes) => { if (Object.keys(changes).some((k) => k.startsWith(PREFIX))) render(); });
  render();
}
