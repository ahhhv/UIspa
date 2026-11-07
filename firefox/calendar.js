// UIspa · calendario de capítulos en las fichas de series.
// Debajo de cada versión añade, en gris, los capítulos de esa temporada que
// aún no están en Hispashare, con su fecha de emisión (TVmaze, o TMDb si has
// puesto clave). Arriba, junto al título, indica cuándo sale el próximo.
(() => {
  if (document.documentElement.dataset.uispaCal) return;
  document.documentElement.dataset.uispaCal = "1";
  const api = typeof browser !== "undefined" ? browser : chrome;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function parseEpisode(name) {
    const m = name.match(/\b(\d{1,2})x(\d{1,3})\b/i) || name.match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
    return m ? { s: Number(m[1]), e: Number(m[2]) } : null;
  }
  const pad = (n) => String(n).padStart(2, "0");

  // ------------------------------------------------------------ fechas
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
  function fmtDate(d, long = false) {
    const days = Math.round((d - today()) / 86400000);
    if (days === 0) return "hoy";
    if (days === 1) return "mañana";
    if (days === -1) return "ayer";
    const opts = { weekday: "short", day: "numeric", month: "short" };
    if (d.getFullYear() !== today().getFullYear()) opts.year = "numeric";
    if (long) opts.weekday = "long";
    return d.toLocaleDateString("es-ES", opts).replace(/\./g, "").replace(",", "");
  }

  // ------------------------------------------------------------ página
  function pageInfo() {
    const imdb = (($("a[href*='imdb.com/title/']")?.href || "").match(/tt\d+/) || [])[0];
    const title = txt($("td.R2 h1"));
    // versiones: cada bloque con enlaces Download(…)
    const versions = new Map();
    $$("a[href^='javascript:Download(']").forEach((a) => {
      const ep = parseEpisode(txt(a));
      if (!ep) return;
      const row = a.closest("tr");
      const box = row?.closest("td[colspan]") || row?.closest("table")?.parentElement;
      const table = row?.closest("table");
      if (!box || !table) return;
      if (!versions.has(box)) versions.set(box, { box, table, eps: [], rows: [] });
      const v = versions.get(box);
      v.eps.push(ep);
      v.rows.push(row);
      v.prefix = v.prefix || txt(a).split(/\s+\d{1,2}x\d{1,3}\b|\s+S\d{1,2}E\d/i)[0];
    });
    return { imdb, title, versions: [...versions.values()] };
  }

  // ------------------------------------------------------------ pintar
  function heroSlot() {
    const slot = $(".hcm-eyebrow") || $("td.R2 h1");
    if (slot && slot.matches("h1")) {
      let box = $(".hc-plex-herobox");
      if (!box) { box = h("div", "hc-plex-herobox"); slot.after(box); }
      return box;
    }
    return slot;
  }
  function hero(text, title, cls = "") {
    const b = h("span", `hc-plex hc-plex-hero hc-cal-hero ${cls}`.trim(), text);
    b.title = title;
    heroSlot()?.append(b);
  }

  function addRows(v, list, source) {
    const last = v.rows[v.rows.length - 1];
    const cols = last ? last.children.length : 4;
    const sourceName = source === "tmdb" ? "TMDb" : "TVmaze";
    let after = last;
    for (const ep of list) {
      const tr = h("tr", "hc-cal-row");
      const d = parseDate(ep.date);
      const aired = d && d < today();
      const code = `${pad(ep.s)}x${pad(ep.e)}`;
      const name = h("td", "hc-cal-name");
      name.append(h("span", "hc-cal-ep", `${v.prefix || ""} ${code}`.trim()));
      if (ep.name && !/^(episode|episodio|capítulo)\s*\d+$/i.test(ep.name)) name.append(h("span", "hc-cal-title", ep.name));
      const when = h("span", `hc-cal-date${aired ? " hc-cal-aired" : ""}`,
        !d ? "fecha por confirmar" : aired ? `emitido ${fmtDate(d)} · aún no subido` : fmtDate(d));
      when.title = d ? `${aired ? "Se emitió" : "Se emite"} el ${fmtDate(d, true)} (fecha original de emisión, según ${sourceName})` : `Sin fecha todavía en ${sourceName}`;
      name.append(when);
      const cells = [h("td", "ICON"), name];
      while (cells.length < cols) cells.push(h("td", "SIZE"));
      tr.append(...cells);
      after.after(tr);
      after = tr;
    }
    // atribución (licencia de los datos)
    const credit = h("tr", "hc-cal-row hc-cal-credit");
    const td = h("td");
    td.colSpan = cols;
    td.textContent = source === "tmdb" ? "Fechas y títulos: TMDb" : "Fechas: TVmaze (CC BY-SA)";
    credit.append(td);
    after.after(credit);
  }

  async function run() {
    const page = pageInfo();
    if (!page.imdb || !page.versions.length) return;           // solo series con capítulos
    const maxSeason = Math.max(...page.versions.flatMap((v) => v.eps.map((e) => e.s)));
    let data;
    try {
      data = await api.runtime.sendMessage({ action: "cal-lookup", query: { imdb: page.imdb, fromSeason: maxSeason } });
    } catch (_) { return; }
    if (!data?.found || !data.episodes?.length) return;

    const onPage = new Set(page.versions.flatMap((v) => v.eps.map((e) => `${e.s}x${e.e}`)));
    const pending = data.episodes
      .filter((e) => !onPage.has(`${e.s}x${e.e}`))
      .sort((a, b) => a.s - b.s || a.e - b.e);

    // Debajo de las versiones de la última temporada: los capítulos que vienen
    // después del último que tienen (las temporadas antiguas no se tocan)
    for (const v of page.versions) {
      const seasons = [...new Set(v.eps.map((e) => e.s))];
      if (seasons.length !== 1 || seasons[0] !== maxSeason) continue;   // packs y temporadas anteriores: no
      const s = seasons[0];
      const lastEp = Math.max(...v.eps.map((e) => e.e));
      const list = pending.filter((e) => e.s === s && e.e > lastEp);
      if (list.length) addRows(v, list, data.source);
    }

    // Arriba: próximo capítulo o estado de la serie
    const t = today();
    const upcoming = data.episodes
      .map((e) => ({ ...e, d: parseDate(e.date) }))
      .filter((e) => e.d && e.d >= t)
      .sort((a, b) => a.d - b.d);
    const src = data.source === "tmdb" ? "TMDb" : "TVmaze";
    if (upcoming.length) {
      const n = upcoming[0];
      const newSeason = n.s > maxSeason;
      hero(newSeason ? `📅 Temporada ${n.s}: ${fmtDate(n.d)}` : `📅 Próximo: ${n.s}x${pad(n.e)} · ${fmtDate(n.d)}`,
        `${newSeason ? "Estreno de la temporada " + n.s : "Próximo capítulo"} el ${fmtDate(n.d, true)} (fecha original de emisión, según ${src})`, "hc-cal-next");
    } else if (data.ended) {
      hero("Serie finalizada", `Según ${src}, la serie ha terminado`, "hc-cal-ended");
    }
    if (data.warning) console.info("[UIspa] " + data.warning);
  }

  run();
})();
