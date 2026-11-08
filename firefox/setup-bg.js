// UIspa · al instalar la extensión por primera vez se abre el asistente de
// configuración (los ajustes, paso a paso). En las actualizaciones, no.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  api.runtime.onInstalled.addListener((details) => {
    // La 3.6.0 quitó el calendario de capítulos: se borran sus ajustes (y la clave de TMDb)
    if (details.reason === "update") api.storage.local.remove(["tmdbKey", "calOff"]);
    if (details.reason !== "install") return;
    api.tabs.create({ url: api.runtime.getURL("options.html#asistente") });
  });
})();
