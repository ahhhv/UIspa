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

// ------------------------------------------------------------ descarga remota (amuleapi, aMuTorrent o Rucio)
{
  const st = $("amStatus");
  const amSay = (msg, cls = "") => { st.className = cls; st.textContent = msg; };
  const AM_KEYS = ["amType", "amUrl", "amUser", "amPass", "amCat"];
  const TYPES = {
    amuleapi: { name: "aMule", port: "4711", placeholder: "http://192.168.1.10:4711", pass: "Contraseña", passRequired: true },
    amutorrent: { name: "aMuTorrent", port: "4000", placeholder: "http://192.168.1.10:4000", pass: "Clave de API (si la pide)", passRequired: false },
    rucio: { name: "Rucio", port: "3003", placeholder: "http://127.0.0.1:3003", pass: "Contraseña del proxy (opcional)", passRequired: false }
  };
  const type = () => { const v = document.querySelector("input[name=amType]:checked")?.value; return TYPES[v] ? v : "amuleapi"; };
  function applyType() {
    const t = TYPES[type()];
    $("amUrl").placeholder = t.placeholder;
    $("amPassLabel").textContent = t.pass;
    $("amPass").type = type() === "amutorrent" ? "text" : "password";
    $("amUserBox").hidden = type() !== "rucio";
  }

  function amUrl(raw) {
    let v = (raw || "").trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = "http://" + v;
    try {
      const u = new URL(v);
      if (!u.port && u.protocol === "http:" && u.pathname === "/") u.port = TYPES[type()].port;
      // se respeta una ruta (detrás de un proxy inverso)
      return (u.origin + u.pathname).replace(/\/+$/, "");
    } catch (_) { return null; }
  }
  function fillCats(categories, selected) {
    const sel = $("amCat");
    sel.textContent = "";
    const list = categories?.length ? categories : [{ index: type() === "amuleapi" ? 0 : "", name: "Por defecto" }];
    for (const c of list) {
      const o = document.createElement("option");
      o.value = String(c.index);
      o.textContent = c.name || `Categoría ${c.index}`;
      sel.append(o);
    }
    sel.value = String(selected ?? list[0].index);
    if (sel.selectedIndex < 0) sel.selectedIndex = 0;
  }
  const catValue = () => type() === "amuleapi" ? Number($("amCat").value) || 0
    : type() === "rucio" ? ($("amCat").value === "" ? "" : Number($("amCat").value)) : $("amCat").value;

  // Lee el formulario y pide permiso para esa dirección (desde el clic)
  async function withAmule(fn) {
    const t = type();
    const url = amUrl($("amUrl").value);
    const pass = $("amPass").value.trim();
    const user = t === "rucio" ? $("amUser").value.trim() : "";
    if (!url) { amSay(`Escribe la dirección de ${TYPES[t].name}, por ejemplo ${TYPES[t].placeholder}`, "err"); return; }
    if (TYPES[t].passRequired && !pass) { amSay("Falta la contraseña de la interfaz web de aMule.", "err"); return; }
    let granted = false;
    try { granted = await api.permissions.request({ origins: [hostPattern(url)] }); }
    catch (e) { amSay("No se pudo pedir permiso: " + e.message, "err"); return; }
    if (!granted) { amSay(`Sin permiso para acceder a ${url}, la extensión no puede usarlo.`, "err"); return; }
    $("amUrl").value = url;
    await fn({ type: t, url, user, pass });
  }

  async function amTest(cfg) {
    amSay("Conectando…");
    const r = await api.runtime.sendMessage({ action: "am-test", ...cfg });
    if (!r?.ok) { amSay(r?.error || "No se pudo conectar.", "err"); return false; }
    fillCats(r.categories, $("amCat").value);
    const what = `${TYPES[cfg.type].name}${r.version ? " " + r.version : ""}`;
    amSay(`Conectado a ${what}.` + (r.categories?.length > 1 ? ` ${r.categories.length} categorías.` : ""), "ok");
    return true;
  }

  document.querySelectorAll("input[name=amType]").forEach((i) => i.addEventListener("change", () => {
    applyType();
    fillCats([], null);
    amSay("");
  }));
  $("amTest").addEventListener("click", () => withAmule(amTest));
  $("amSave").addEventListener("click", () => withAmule(async (cfg) => {
    if (!(await amTest(cfg))) return;
    await api.storage.local.set({ amType: cfg.type, amUrl: cfg.url, amUser: cfg.user, amPass: cfg.pass, amCat: catValue() });
    await api.runtime.sendMessage({ action: "am-reset" });
    st.prepend("Guardado. Recarga Hispashare para ver la fila 🐳 Descarga remota. ");
  }));
  $("amCat").addEventListener("change", async () => {
    const { amUrl: saved, amType: savedType } = await api.storage.local.get(["amUrl", "amType"]);
    if (saved && (savedType || "amuleapi") === type()) await api.storage.local.set({ amCat: catValue() });
  });
  $("amClear").addEventListener("click", async () => {
    const { amUrl: old } = await api.storage.local.get("amUrl");
    await api.storage.local.remove(AM_KEYS);
    await api.runtime.sendMessage({ action: "am-reset" });
    if (old) { try { await api.permissions.remove({ origins: [hostPattern(old)] }); } catch (_) {} }
    $("amUrl").value = $("amPass").value = $("amUser").value = "";
    fillCats([], null);
    amSay("Descarga remota desconectada. Se han borrado la dirección y la contraseña.");
  });

  api.storage.local.get(AM_KEYS).then((s) => {
    const t = TYPES[s.amType] ? s.amType : "amuleapi";
    document.querySelector(`input[name=amType][value=${t}]`).checked = true;
    applyType();
    if (s.amUrl) $("amUrl").value = s.amUrl;
    if (s.amUser) $("amUser").value = s.amUser;
    if (s.amPass) $("amPass").value = s.amPass;
    const cat = s.amCat ?? null;
    const isDefault = cat === null || cat === "" || cat === 0 || cat === "Default";
    fillCats(isDefault ? [] : [{ index: t === "amuleapi" ? 0 : "", name: "Por defecto" }, { index: cat, name: t === "amutorrent" ? cat : `Categoría ${cat}` }], cat);
    if (s.amUrl && (t !== "amuleapi" || s.amPass)) amSay(`${TYPES[t].name} configurado. Prueba la conexión para ver sus categorías.`, "ok");
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


// ------------------------------------------------------------ pestañas de los ajustes
// Fuera del asistente se ve una sección (o grupo) cada vez. El punto verde de
// cada pestaña indica que hay algo conectado. La pestaña va en la dirección
// (#descargas/nas), así que recargar o enlazar abre la misma.
const uiNav = (() => {
  const TABS = [
    { id: "apariencia", label: "🎨 Apariencia", secs: ["sec-look"] },
    { id: "multimedia", label: "📺 Plex / Jellyfin", secs: ["sec-media"],
      dot: (s) => !!((s.plexUrl && s.plexToken) || (s.jfUrl && s.jfKey)) },
    { id: "descargas", label: "⬇ Descargas", subs: [
      { id: "local", label: "En este ordenador", sec: "sec-local" },
      { id: "nas", label: "NAS Synology", sec: "sec-nas", dot: (s) => !!(s.dsUrl && s.dsUser && s.dsPass) },
      { id: "remota", label: "Descarga remota", sec: "sec-amule", dot: (s) => !!s.amUrl }
    ] },
    { id: "favoritos", label: "⭐ Favoritos", secs: ["sec-favs"] }
  ];
  TABS[2].dot = (s) => TABS[2].subs.some((x) => x.dot?.(s));
  const KEYS = ["plexUrl", "plexToken", "jfUrl", "jfKey", "dsUrl", "dsUser", "dsPass", "amUrl"];
  let cur = "apariencia", sub = "local";

  const mk = (label, onclick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.append(label);
    b.addEventListener("click", onclick);
    return b;
  };
  const nav = $("nav"), subnav = $("subnav");
  for (const t of TABS) {
    const b = mk(t.label, () => go(t.id));
    b.dataset.tab = t.id;
    if (t.dot) { const d = document.createElement("span"); d.className = "dot"; b.append(d); }
    nav.append(b);
  }
  for (const x of TABS[2].subs) {
    const b = mk(x.label, () => go("descargas", x.id));
    b.dataset.sub = x.id;
    b.setAttribute("role", "tab");
    if (x.dot) { const d = document.createElement("span"); d.className = "dot"; b.append(d); }
    subnav.append(b);
  }

  function apply() {
    if (document.body.classList.contains("wizard")) return;
    const t = TABS.find((x) => x.id === cur) || TABS[0];
    const visible = t.subs ? [t.subs.find((x) => x.id === sub)?.sec || t.subs[0].sec] : t.secs;
    document.querySelectorAll("main > section").forEach((sec) => (sec.hidden = !visible.includes(sec.id)));
    nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t.id));
    subnav.hidden = !t.subs;
    subnav.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("on", b.dataset.sub === sub);
      b.setAttribute("aria-selected", String(b.dataset.sub === sub));
    });
  }
  function go(tab, subId) {
    cur = tab;
    if (subId) sub = subId;
    const hash = "#" + tab + (tab === "descargas" ? "/" + sub : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
    apply();
  }
  function fromHash() {
    const [t, x] = location.hash.replace(/^#/, "").split("/");
    if (TABS.some((y) => y.id === t)) { cur = t; if (x && TABS[2].subs.some((y) => y.id === x)) sub = x; }
  }
  async function dots() {
    const s = await api.storage.local.get(KEYS);
    for (const t of TABS) nav.querySelector(`[data-tab="${t.id}"] .dot`)?.classList.toggle("set", !!t.dot?.(s));
    for (const x of TABS[2].subs) subnav.querySelector(`[data-sub="${x.id}"] .dot`)?.classList.toggle("set", !!x.dot?.(s));
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("[data-go]");
    if (!a) return;
    e.preventDefault();
    const [t, x] = a.dataset.go.split("/");
    go(t, x);
    window.scrollTo({ top: 0 });
  });
  api.storage.onChanged.addListener((ch, area) => { if (area === "local" && KEYS.some((k) => k in ch)) dots(); });
  fromHash();
  dots();
  return { apply, go };
})();

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
    { id: "sec-amule", name: "Descarga remota", intro: "Si tienes aMule en Docker, en un NAS o en otro ordenador, aMuTorrent o Rucio, conéctalo para mandarle los enlaces con 🐳. Si usas eMule o aMule en este mismo ordenador no hace falta: pulsa Omitir.",
      dirty: () => !!$("amUrl").value.trim() && !amSaved(), save: "amSave", status: "amStatus" },
    { id: "sec-done", name: "Listo", intro: "" }
  ];
  let step = 0, nasStored = {};
  const nasSaved = () => $("dsUrl").value.trim() === (nasStored.dsUrl || "") && $("dsUser").value.trim() === (nasStored.dsUser || "") && $("dsPass").value === (nasStored.dsPass || "");
  const refreshNas = () => api.storage.local.get(["dsUrl", "dsUser", "dsPass"]).then((s) => { nasStored = s; });
  refreshNas();
  let amStored = {};
  const amSaved = () => $("amUrl").value.trim() === (amStored.amUrl || "") && $("amPass").value.trim() === (amStored.amPass || "") && $("amUser").value.trim() === (amStored.amUser || "")
    && (document.querySelector("input[name=amType]:checked")?.value || "amuleapi") === (amStored.amType || "amuleapi");
  const refreshAm = () => api.storage.local.get(["amType", "amUrl", "amUser", "amPass"]).then((s) => { amStored = s; });
  refreshAm();

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
    const s = await api.storage.local.get(["plexUrl", "plexToken", "jfUrl", "jfKey", "dsUrl", "dsUser", "dsPass", "amType", "amUrl", "amPass", "look"]);
    const ul = $("wizSummary");
    ul.textContent = "";
    const theme = { dark: "oscuro", light: "claro", auto: "automático" }[s.look?.theme || "dark"];
    const items = [
      `Tema ${theme}.`,
      s.plexUrl && s.plexToken ? "✓ Plex conectado." : "Plex: sin configurar.",
      s.jfUrl && s.jfKey ? "✓ Jellyfin conectado." : "Jellyfin: sin configurar.",
      s.dsUrl && s.dsUser && s.dsPass ? "✓ NAS conectado (botones 📥)." : "NAS: sin configurar.",
      s.amUrl && (s.amPass || (s.amType && s.amType !== "amuleapi")) ? `✓ Descarga remota conectada: ${{ amutorrent: "aMuTorrent", rucio: "Rucio" }[s.amType] || "aMule"} (botones 🐳).` : "Descarga remota: sin configurar."
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
    if (location.hash === "#asistente") history.replaceState(null, "", location.pathname);
    uiNav.apply();
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
      if (cur.id === "sec-amule") await refreshAm();
      if (!ok) return; // se queda en el paso para que veas el error
    }
    step++;
    render();
  });
  if (location.hash === "#asistente") open();
  else uiNav.apply();
}

// ------------------------------------------------------------ favoritos
{
  let area = api.storage.local;
  const PREFIX = "fav:";
  const st = $("favStatus");
  const favSay = (msg, cls = "") => { st.className = cls; st.textContent = msg; };
  const areaOf = (name) => (name === "local" || !api.storage.sync ? api.storage.local : api.storage.sync);
  const readFavs = async (a) => Object.entries((await a.get(null)) || {}).filter(([k, v]) => k.startsWith(PREFIX) && v?.id);
  async function all() {
    const { favArea } = await api.storage.local.get("favArea");
    area = areaOf(favArea);
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
  $("emuleBtns").addEventListener("change", async (e) => {
    if (e.target.checked) await api.storage.local.remove("emuleOff");
    else await api.storage.local.set({ emuleOff: true });
    $("localStatus").textContent = "Guardado. Recarga las pestañas de Hispashare para verlo.";
  });
  api.storage.local.get("emuleOff").then((s) => { $("emuleBtns").checked = !s.emuleOff; });
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
  // Cambiar dónde se guardan: se mueven los favoritos de un sitio al otro
  if (!api.storage.sync) {
    document.querySelector("input[name=favArea][value=sync]").disabled = true;
    document.querySelector("input[name=favArea][value=local]").checked = true;
  }
  document.querySelectorAll("input[name=favArea]").forEach((r) => r.addEventListener("change", async () => {
    const to = r.value;
    const { favArea } = await api.storage.local.get("favArea");
    const from = favArea === "local" ? "local" : "sync";
    if (to === from) return;
    try {
      const items = await readFavs(areaOf(from));
      if (items.length) {
        await areaOf(to).set(Object.fromEntries(items));
        await areaOf(from).remove(items.map(([k]) => k));
      }
      await api.storage.local.set({ favArea: to });
      favSay(items.length
        ? `${items.length} favoritos movidos ${to === "sync" ? "a tu cuenta del navegador" : "a este navegador"}.`
        : `Los favoritos se guardarán ${to === "sync" ? "en tu cuenta del navegador" : "solo en este navegador"}.`, "ok");
      render();
    } catch (e) {
      favSay("No se pudieron mover los favoritos: " + e.message, "err");
      document.querySelector(`input[name=favArea][value=${from}]`).checked = true;
    }
  }));
  api.storage.local.get(["favCheckOff", "favArea"]).then((s) => {
    $("favCheck").checked = !s.favCheckOff;
    const v = s.favArea === "local" || !api.storage.sync ? "local" : "sync";
    document.querySelector(`input[name=favArea][value=${v}]`).checked = true;
  });
  api.storage.onChanged.addListener((changes) => { if (Object.keys(changes).some((k) => k.startsWith(PREFIX))) render(); });
  render();
}
