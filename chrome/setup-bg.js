// UIspa · al instalar la extensión por primera vez se abre el asistente de
// configuración (los ajustes, paso a paso). En las actualizaciones, no.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  api.runtime.onInstalled.addListener((details) => {
    if (details.reason !== "install") return;
    api.tabs.create({ url: api.runtime.getURL("options.html#asistente") });
  });
})();
