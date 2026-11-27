// UIspa · Modo tele
// Para usar Hispashare en la tele desde un portátil o mini PC: todo se maneja con
// flechas + Intro + Atrás (teclado, mando de la tele por HDMI-CEC o mando de consola).
//   · Se activa con la tecla T, desde el menú ◐ o al poner el navegador en pantalla completa.
//   · Las flechas mueven el foco al elemento más cercano en esa dirección.
//   · Atrás vuelve a la pantalla anterior; en la portada sale del modo tele.
(() => {
  const html = document.documentElement;
  if (!html.classList.contains("hcm")) return; // sin el rediseño no hay modo tele
  const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const me = ext?.runtime?.id || "uispa";
  if (html.dataset.uispaOwner && html.dataset.uispaOwner !== me) return;

  const KEY = "uispa-tv";          // "on" (a mano) o "auto" (por pantalla completa)
  const NOFS = "uispa-tv-nofs";    // lo quitaste a mano estando en pantalla completa
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (_) {} },
  };
  const isOn = () => html.classList.contains("hcm-tv");
  const params = new URLSearchParams(location.search);
  const isHome = () => location.pathname === "/" && (!params.get("view") || params.get("view") === "list") && !params.get("q");
  const isTitle = () => params.get("view") === "title";
  const isList = () => !!document.querySelector(".hcm-grid");
  const streamingShown = () => !!document.querySelector(".hcm-stream-hero, .hcm-strip-sec");

  // ------------------------------------------------------------ encender / apagar
  function enable(how) {
    ss.set(KEY, how);
    html.classList.add("hcm-tv");
    // La portada en filas tipo Netflix: si se pintó con otro diseño, se vuelve a pintar
    if (isList() && !streamingShown()) { location.reload(); return; }
    hint();
    setTimeout(initFocus, 50);
    pads();
  }
  function disable() {
    const wasStreaming = streamingShown();
    ss.set(KEY, null);
    html.classList.remove("hcm-tv", "hcm-tv-keys");
    closeKeyboard();
    setFocus(null);
    let layout = "grid";
    try { layout = JSON.parse(localStorage.getItem("uispa-look") || "{}").layout || "grid"; } catch (_) {}
    if (isList() && wasStreaming && layout !== "streaming") location.reload();
  }
  function toggle() {
    if (isOn()) { if (isFull()) ss.set(NOFS, "1"); disable(); }
    else enable("on");
  }
  document.addEventListener("uispa-tv-toggle", toggle);

  // Pantalla completa (F11 o la del navegador)
  const isFull = () => !!document.fullscreenElement || (innerWidth >= screen.width - 2 && innerHeight >= screen.height - 2);
  let fsTimer = null;
  addEventListener("resize", () => {
    clearTimeout(fsTimer);
    fsTimer = setTimeout(() => {
      if (isFull()) { if (!isOn() && !ss.get(NOFS)) enable("auto"); }
      else { ss.set(NOFS, null); if (isOn() && ss.get(KEY) === "auto") disable(); }
    }, 300);
  });

  // ------------------------------------------------------------ foco
  let focused = null;
  function setFocus(el) {
    focused?.classList.remove("hcm-tv-focus");
    focused = el;
    if (!el) return;
    if (!el.matches("a[href], button, input, select, textarea, [tabindex]")) el.tabIndex = -1;
    el.classList.add("hcm-tv-focus");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }

  const SELECTOR = "a[href], button, input:not([type=hidden]), select, [tabindex]:not([tabindex='-1'])";
  function scope() {
    return document.querySelector(".hcm-tv-kb") || document.querySelector(".hc-nas-pop") || document.querySelector(".hcm-dd.hcm-open .hcm-dd-menu") || document;
  }
  function visible(el) {
    if (el.disabled || el.closest("[hidden], [inert]")) return false;
    if (/arrow/.test(el.className) || el.classList.contains("hcm-look-classic")) return false; // flechas de las filas: sobran con el mando
    if (el.matches("input[type=text]") && el.closest(".hc-nas-pop")) return false; // escribir rutas no tiene sentido con el mando
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }
  const candidates = () => [...scope().querySelectorAll(SELECTOR)].filter(visible);

  function initFocus() {
    if (!isOn()) return;
    const pick = (sel) => [...document.querySelectorAll(sel)].find(visible);
    const el = isTitle()
      ? pick(".hcm-pref > .hcm-ver-head") || pick(".hcm-seasons button.hcm-on, .hcm-seasons button") || pick(".hcm-ver-head") || pick(".hcm-fav-btn")
      : pick(".hcm-stream-hero a") || pick(".hcm-card") || pick("#hcm-root a[href]");
    if (el) setFocus(el);
  }

  // El elemento más cercano en esa dirección: distancia en la dirección del
  // movimiento más una penalización por desviarse (sin penalización si se solapan)
  function move(dir) {
    const cur = focused && focused.isConnected && scope().contains(focused) ? focused : null;
    const list = candidates();
    if (!cur) { setFocus(list[0] || null); return; }
    const a = cur.getBoundingClientRect();
    const horizontal = dir === "right" || dir === "left";
    const opts = [];
    for (const el of list) {
      if (el === cur || cur.contains(el) || el.contains(cur)) continue;
      const b = el.getBoundingClientRect();
      const main = dir === "right" ? b.left - a.right : dir === "left" ? a.left - b.right : dir === "down" ? b.top - a.bottom : a.top - b.bottom;
      if (main < -8) continue;
      const overlap = horizontal
        ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        : Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const side = horizontal
        ? Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)
        : Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2);
      opts.push({ el, main: Math.max(main, 0), overlap, side });
    }
    // En horizontal, solo lo que está en la misma fila: al final de una fila la
    // flecha no hace nada, como en la tele. En vertical, la fila más cercana y,
    // dentro de ella, lo que queda justo encima o debajo (o lo más próximo).
    let pool;
    if (horizontal) pool = opts.filter((o) => o.overlap > 4);
    else if (opts.length) {
      const near = Math.min(...opts.map((o) => o.main));
      pool = opts.filter((o) => o.main <= near + 40);
    } else pool = [];
    let best = null, bestScore = Infinity;
    for (const o of pool) {
      const score = o.main + o.side * (o.overlap > 4 ? 0.2 : 1);
      if (score < bestScore) { bestScore = score; best = o.el; }
    }
    if (best) setFocus(best);
  }

  function activate() {
    const el = focused && focused.isConnected ? focused : null;
    if (!el) { initFocus(); return; }
    if (el.matches("input[type=search], input[type=text]")) { if (el.closest(".hcm-search")) openKeyboard(el); else el.focus(); return; }
    el.click();
    // Tras abrir algo (versión, temporada, recuadro del NAS) se recoloca el foco
    setTimeout(() => {
      const pop = document.querySelector(".hc-nas-pop");
      if (pop && !pop.contains(focused)) setTimeout(() => { const f = candidates().find((c) => c.matches(".hc-nas-ok")) || candidates()[0]; setFocus(f || null); }, 300);
      else if (focused && !focused.isConnected) initFocus();
    }, 150);
  }

  function back() {
    if (closeKeyboard()) return;
    const pop = document.querySelector(".hc-nas-pop");
    if (pop) {
      const cancel = [...pop.querySelectorAll("button")].find((b) => /Cancelar|Volver/.test(b.textContent));
      if (cancel) cancel.click(); else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      setTimeout(initFocus, 100);
      return;
    }
    const menu = document.querySelector(".hcm-dd.hcm-open, .hcm-dd-menu.hcm-open");
    if (menu) { document.body.click(); return; }
    if (isHome()) disable();
    else history.back();
  }

  function goSearch() {
    const input = document.querySelector(".hcm-search input");
    if (input) openKeyboard(input);
  }
  function favorite() {
    const b = [...document.querySelectorAll(".hcm-fav-btn")].find(visible);
    b?.click();
  }

  // ------------------------------------------------------------ teclado en pantalla
  let kb = null, kbInput = null;
  const KB_ROWS = ["1234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm-'."];
  function openKeyboard(input) {
    if (kb) return;
    kbInput = input;
    const shown = document.createElement("div");
    shown.className = "hcm-tv-kb-text";
    const render = () => { shown.textContent = input.value || " "; };
    kb = document.createElement("div");
    kb.className = "hcm-tv-kb";
    kb.setAttribute("role", "dialog");
    kb.setAttribute("aria-label", "Buscar");
    const title = document.createElement("div");
    title.className = "hcm-tv-kb-title";
    title.textContent = "🔎 Buscar";
    kb.append(title, shown);
    const key = (label, fn, cls = "") => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hcm-tv-key " + cls;
      b.textContent = label;
      b.addEventListener("click", () => { fn(); render(); });
      return b;
    };
    for (const row of KB_ROWS) {
      const r = document.createElement("div");
      r.className = "hcm-tv-kb-row";
      for (const ch of row) r.append(key(ch.toUpperCase(), () => { input.value += ch; }));
      kb.append(r);
    }
    const last = document.createElement("div");
    last.className = "hcm-tv-kb-row";
    last.append(
      key("Espacio", () => { input.value += " "; }, "hcm-tv-key-wide"),
      key("⌫ Borrar", () => { input.value = input.value.slice(0, -1); }, "hcm-tv-key-wide"),
      key("Buscar", () => submit(), "hcm-tv-key-wide hcm-tv-key-go"));
    kb.append(last);
    (document.getElementById("hcm-root") || document.body).append(kb);
    render();
    kb.__render = render;
    setFocus(kb.querySelector(".hcm-tv-key"));
  }
  function submit() {
    const form = kbInput?.form;
    if (!form || !kbInput.value.trim()) return;
    closeKeyboard();
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
  }
  function closeKeyboard() {
    if (!kb) return false;
    kb.remove();
    kb = null;
    setTimeout(initFocus, 50);
    return true;
  }

  // ------------------------------------------------------------ teclado y mando de la tele
  const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  const BACK = new Set(["Backspace", "Escape", "BrowserBack", "GoBack"]);
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const typing = !!t?.matches && (t.isContentEditable || (t.matches("input, textarea, select") && !t.matches("input[type=checkbox], input[type=radio]")));
    if (!isOn()) {
      if ((e.key === "t" || e.key === "T") && !typing) { e.preventDefault(); toggle(); }
      return;
    }
    // Con el teclado en pantalla abierto, también se puede escribir con el de verdad
    if (kb) {
      if (e.key.length === 1 && e.key !== " ") { e.preventDefault(); kbInput.value += e.key; kb.__render(); return; }
      if (e.key === "Backspace") { e.preventDefault(); kbInput.value = kbInput.value.slice(0, -1); kb.__render(); return; }
    }
    if (typing && !kb) {
      // En un campo de texto las flechas izquierda/derecha mueven el cursor
      if (e.key === "Escape") { e.preventDefault(); t.blur(); setFocus(t); }
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); move(DIRS[e.key]); }
      return;
    }
    html.classList.add("hcm-tv-keys");
    if (DIRS[e.key]) { e.preventDefault(); e.stopPropagation(); move(DIRS[e.key]); }
    else if (e.key === "Enter" || (e.key === " " && kb)) { e.preventDefault(); e.stopPropagation(); activate(); }
    else if (BACK.has(e.key)) { e.preventDefault(); e.stopPropagation(); back(); }
    else if (e.key === "t" || e.key === "T") { e.preventDefault(); toggle(); }
    else if (e.key === "/" || e.key === "s" || e.key === "S") { e.preventDefault(); goSearch(); }
    else if (e.key === "f" || e.key === "F") { e.preventDefault(); favorite(); }
  }, true);
  // Al volver a usar el ratón, se ve el puntero
  addEventListener("mousemove", () => html.classList.remove("hcm-tv-keys"), { passive: true });
  // Si el foco cambia con el ratón o con Tab, se sigue desde ahí
  addEventListener("focusin", (e) => { if (isOn() && e.target !== focused && e.target.matches?.(SELECTOR)) { focused?.classList.remove("hcm-tv-focus"); focused = e.target; focused.classList.add("hcm-tv-focus"); } });

  // ------------------------------------------------------------ mando de consola
  // A = aceptar · B = atrás · Y = buscar · X = favorito · Start = modo tele · cruceta o stick = moverse
  let padLoop = 0;
  const held = new Map();
  function pads() {
    if (padLoop || !navigator.getGamepads) return;
    const tick = (now) => {
      padLoop = requestAnimationFrame(tick);
      const gp = [...navigator.getGamepads()].find(Boolean);
      if (!gp) return;
      const ax = gp.axes || [];
      const pressed = {
        up: gp.buttons[12]?.pressed || ax[1] < -0.6, down: gp.buttons[13]?.pressed || ax[1] > 0.6,
        left: gp.buttons[14]?.pressed || ax[0] < -0.6, right: gp.buttons[15]?.pressed || ax[0] > 0.6,
        a: gp.buttons[0]?.pressed, b: gp.buttons[1]?.pressed, x: gp.buttons[2]?.pressed, y: gp.buttons[3]?.pressed,
        start: gp.buttons[9]?.pressed,
      };
      for (const [k, on] of Object.entries(pressed)) {
        const h = held.get(k);
        if (!on) { held.delete(k); continue; }
        const repeat = ["up", "down", "left", "right"].includes(k);
        if (!h) { held.set(k, { t: now, n: 0 }); fire(k); }
        else if (repeat && now - h.t > (h.n ? 120 : 380)) { h.t = now; h.n++; fire(k); }
      }
    };
    const fire = (k) => {
      if (k === "start") { toggle(); return; }
      if (!isOn()) return;
      html.classList.add("hcm-tv-keys");
      if (["up", "down", "left", "right"].includes(k)) move(k);
      else if (k === "a") activate();
      else if (k === "b") back();
      else if (k === "y") goSearch();
      else if (k === "x") favorite();
    };
    padLoop = requestAnimationFrame(tick);
  }
  addEventListener("gamepadconnected", pads);

  // ------------------------------------------------------------ aviso al entrar
  function hint() {
    document.querySelector(".hcm-tv-hint")?.remove();
    const d = document.createElement("div");
    d.className = "hcm-tv-hint";
    d.textContent = "📺 Modo tele · ↑↓←→ moverse · Intro abrir · Atrás volver · / buscar · F favorito · T salir";
    (document.getElementById("hcm-root") || document.body).append(d);
    setTimeout(() => d.classList.add("hcm-tv-hint-out"), 4500);
    setTimeout(() => d.remove(), 5200);
  }

  // Al cargar una página con el modo tele ya activo (se guarda mientras dure la pestaña)
  if (ss.get(KEY)) {
    html.classList.add("hcm-tv");
    setTimeout(initFocus, 300);
    pads();
  } else if (isFull() && !ss.get(NOFS)) enable("auto");
})();
