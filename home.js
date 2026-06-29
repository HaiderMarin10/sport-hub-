/* Sport Hub — home.js  (pestaña Inicio)
   Responde de un vistazo: "¿cómo estoy y qué toca hoy?"
   Readiness + veredicto + lo que has hecho hoy + accesos rápidos. Lee de Airtable. */
(function () {
  "use strict";
  const root = document.getElementById("inicio-root");
  if (!root || !window.shAirtable) return;
  const AT = window.shAirtable;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const go = (v) => { if (window.shShowView) window.shShowView(v); };
  const coach = () => { const f = document.getElementById("coach-fab"); if (f) f.click(); };

  function iconFor(fl) {
    const s = ((fl.ejercicios || "") + " " + (fl.tipo || "")).toLowerCase();
    if (s.indexOf("corr") !== -1 || s.indexOf("run") !== -1 || s.indexOf("caco") !== -1) return "🏃";
    if (s.indexOf("pilates") !== -1) return "🧘";
    if (s.indexOf("bici") !== -1 || s.indexOf("ride") !== -1 || s.indexOf("cycl") !== -1) return "🚴";
    if (s.indexOf("swim") !== -1 || s.indexOf("nat") !== -1) return "🏊";
    if (s.indexOf("hyrox") !== -1 || s.indexOf("wod") !== -1 || s.indexOf("crossfit") !== -1) return "🔥";
    if (s.indexOf("fuerza") !== -1 || s.indexOf("weight") !== -1 || s.indexOf("power") !== -1) return "💪";
    if (s.indexOf("movil") !== -1 || s.indexOf("yoga") !== -1 || s.indexOf("pilates") !== -1) return "🤸";
    if (s.indexOf("walk") !== -1 || s.indexOf("camin") !== -1) return "🚶";
    return "🟡";
  }

  function readiness(metr, sens) {
    const latest = metr.find((r) => typeof r.fields.recuperacion_whoop === "number");
    const ls = sens[0] ? sens[0].fields : {};
    const comps = [];
    if (latest) comps.push({ w: 35, v: latest.fields.recuperacion_whoop });
    if (latest && typeof latest.fields["sueño_total_min"] === "number") comps.push({ w: 20, v: Math.min(100, latest.fields["sueño_total_min"] / 480 * 100) });
    const espV = (typeof ls.espalda_noche === "number") ? ls.espalda_noche : ls.espalda_mañana;
    if (typeof espV === "number") comps.push({ w: 25, v: espV * 10 });
    if (typeof ls.energia_general === "number" || typeof ls.intensidad_gemelos === "number") {
      const en = typeof ls.energia_general === "number" ? ls.energia_general * 10 : 60;
      const mol = typeof ls.intensidad_gemelos === "number" ? 100 - ls.intensidad_gemelos * 10 : 100;
      comps.push({ w: 20, v: (en + mol) / 2 });
    }
    if (!comps.length) return null;
    const ws = comps.reduce((a, c) => a + c.w, 0);
    const score = Math.round(comps.reduce((a, c) => a + c.w * c.v, 0) / ws);
    let cat, col, verd;
    if (score >= 80) { cat = "Muy bueno"; col = "#2E6FB5"; verd = "dale caña (con cabeza)"; }
    else if (score >= 60) { cat = "Bueno"; col = "#2E6FB5"; verd = "entrena normal"; }
    else if (score >= 40) { cat = "Medio"; col = "#C2A21E"; verd = "entrena, pero sin pasarte"; }
    else { cat = "Malo"; col = "#7A2230"; verd = "hoy suave: movilidad y técnica"; }
    return { score: score, cat: cat, col: col, verd: verd };
  }

  function ctas() {
    return '<div class="card"><div class="ini-cta">' +
      '<button class="btn btn-primary" id="ini-gen">⚡ Generar entreno</button>' +
      '<button class="btn btn-ghost" id="ini-coach">💬 Coach</button>' +
      '<button class="btn btn-ghost" id="ini-dm">📝 Registrar día</button>' +
      '</div></div>';
  }
  function wire() {
    const g = document.getElementById("ini-gen"); if (g) g.addEventListener("click", () => go("gen"));
    const c = document.getElementById("ini-coach"); if (c) c.addEventListener("click", coach);
    const d = document.getElementById("ini-dm"); if (d) d.addEventListener("click", () => go("diario"));
    const x = document.getElementById("ini-go-dm"); if (x) x.addEventListener("click", () => go("diario"));
  }

  async function render() {
    if (!AT.hasToken()) {
      root.innerHTML = '<div class="card"><p class="eyebrow">👋 Bienvenido</p><p class="at-help">Conecta tu Airtable en <b>Daily Metrics</b> para ver tu resumen, tu readiness y tu historial.</p>' +
        '<button class="btn btn-primary" id="ini-go-dm" style="margin-top:8px">Ir a Daily Metrics</button></div>' + ctas();
      wire(); return;
    }
    root.innerHTML = '<div class="card"><div class="hist-empty">Cargando tu resumen…</div></div>';
    let metr = [], sens = [], entr = [];
    try {
      const r = await Promise.all([
        AT.list("metricas", { maxRecords: 14, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
        AT.list("sensaciones", { maxRecords: 7, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
        AT.list("entrenos", { maxRecords: 30, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
      ]);
      metr = r[0]; sens = r[1]; entr = r[2];
    } catch (e) { root.innerHTML = '<div class="card"><div class="hist-empty">No se pudo cargar: ' + esc(e.message) + '</div></div>'; return; }

    const rd = readiness(metr, sens);
    const now = new Date();
    const todayKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    const hoy = entr.filter((r) => String(r.fields.fecha || "").slice(0, 10) === todayKey);

    let html = "";
    // readiness
    if (rd) {
      html += '<div class="card"><p class="eyebrow">⚡ Tu readiness de hoy</p>' +
        '<div class="est-ready" style="margin:0;border:none;background:none;padding:0">' +
        '<div class="est-ready-top"><div class="est-ready-lft">' +
        '<div class="est-ready-score" style="color:' + rd.col + '">' + rd.score + '<small>/100</small></div>' +
        '<div class="est-ready-cat" style="color:' + rd.col + '">' + rd.cat + '</div></div>' +
        '<div class="est-ready-verd"><span class="est-ready-vl">VEREDICTO</span>' + esc(rd.verd) + '</div></div></div>' +
        '<button class="btn btn-ghost" id="ini-dm2" style="margin-top:12px;width:100%">Ver el detalle en Daily Metrics →</button></div>';
    } else {
      html += '<div class="card"><p class="eyebrow">⚡ Tu readiness de hoy</p>' +
        '<p class="at-help">Aún no hay datos suficientes. Registra cómo te sientes (o tus métricas de WHOOP) y aquí verás tu nota del día.</p>' +
        '<button class="btn btn-primary" id="ini-dm2" style="margin-top:8px">Registrar ahora</button></div>';
    }
    // hoy
    html += '<div class="card"><p class="eyebrow">🗓️ Lo que llevas hoy</p>';
    if (hoy.length) {
      html += '<div class="ini-hoy">' + hoy.map((r) => '<span class="ini-act"><span class="ini-ic">' + iconFor(r.fields) + '</span>' + esc(r.fields.ejercicios || r.fields.tipo || "Entreno") + '</span>').join("") + '</div>';
    } else {
      html += '<p class="at-help">Aún no has registrado nada hoy. ¿Generamos un entreno acorde a tu readiness?</p>';
    }
    html += '</div>';
    html += ctas();

    root.innerHTML = html;
    wire();
    const d2 = document.getElementById("ini-dm2"); if (d2) d2.addEventListener("click", () => go("diario"));
  }

  document.querySelectorAll('.tab[data-view="inicio"]').forEach((t) => t.addEventListener("click", render));
  render();
})();
