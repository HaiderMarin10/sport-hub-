/* Sport Hub — salud.js  (H&PH · Health & Performance Hub)
   3 sub-secciones para aprender qué viene de cada fuente:
     · General  → mezcla WHOOP + Strava (la foto de conjunto)
     · WHOOP    → evolución fisiológica (Pace of Aging, recuperación, HRV…)
     · Strava   → rendimiento de cardio + "casillas" de conceptos pro (con explicación)
   Lee de Airtable (resumen_mensual, entrenos, metricas). */
(function () {
  "use strict";
  const root = document.getElementById("salud-root");
  if (!root || !window.shAirtable) return;
  const AT = window.shAirtable;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n1 = (x) => (typeof x === "number" ? x.toFixed(1) : "—");
  const n0 = (x) => (typeof x === "number" ? Math.round(x) : "—");

  function metricCard(label, now, prev, dec, unit, betterDown) {
    let deltaHtml = "";
    if (typeof now === "number" && typeof prev === "number") {
      const delta = now - prev;
      if (Math.abs(delta) > 0.0001) {
        const up = delta > 0, good = betterDown ? !up : up;
        deltaHtml = '<span class="sal-m-d" style="color:' + (good ? "#2E6FB5" : "#C8742A") + '">' +
          (up ? "▲" : "▼") + " " + Math.abs(delta).toFixed(dec) + "</span>";
      }
    }
    const val = typeof now === "number" ? now.toFixed(dec) : "—";
    return '<div class="sal-metric"><div class="sal-m-top"><span class="sal-m-l">' + label + '</span>' + deltaHtml + '</div>' +
      '<div class="sal-m-v">' + val + (unit ? '<small>' + unit + '</small>' : "") + '</div></div>';
  }

  function barChart(vals, labels, colorFn, dec, maxOverride) {
    const w = 600, h = 132, pad = 22, iw = w - pad * 2, ih = h - pad * 2, n = vals.length;
    const bw = Math.min(46, iw / n - 8), gap = n > 1 ? (iw - bw * n) / (n - 1) : 0;
    const mx = maxOverride || Math.max.apply(null, vals.filter((x) => typeof x === "number")) || 1;
    let b = "";
    vals.forEach((v, i) => {
      if (typeof v !== "number") return;
      const bx = pad + i * (bw + gap), bh = Math.max(8, v / mx * ih), by = pad + ih - bh;
      b += '<rect x="' + bx.toFixed(0) + '" y="' + by.toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '" rx="3" fill="' + colorFn(v) + '"/>' +
        '<text x="' + (bx + bw / 2).toFixed(0) + '" y="' + (by - 5).toFixed(0) + '" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">' + v.toFixed(dec) + '</text>' +
        '<text x="' + (bx + bw / 2).toFixed(0) + '" y="' + (h - 6) + '" font-size="9.5" fill="#85858c" text-anchor="middle">' + labels[i] + '</text>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="display:block">' + b + '</svg>';
  }

  const sport = (name) => {
    const s = (name || "").toLowerCase();
    return s.indexOf("ride") !== -1 || s.indexOf("cycl") !== -1 || s.indexOf("bici") !== -1 ? "Bici" :
      s.indexOf("swim") !== -1 || s.indexOf("nat") !== -1 ? "Natación" :
      s.indexOf("run") !== -1 || s.indexOf("carrera") !== -1 ? "Carrera" :
      s.indexOf("walk") !== -1 || s.indexOf("hike") !== -1 || s.indexOf("camin") !== -1 ? "Caminar" : "Otro";
  };

  // "casilla" de concepto: título + qué es + estado (dato real o pendiente, para aprender)
  function concepto(emoji, titulo, queEs, estadoHtml, activo) {
    return '<div class="sal-concept' + (activo ? "" : " locked") + '">' +
      '<div class="sal-c-h">' + emoji + ' <b>' + titulo + '</b>' + (activo ? "" : ' <span class="sal-c-lock">🔒 se activa al entrenar</span>') + '</div>' +
      '<div class="sal-c-d">' + queEs + '</div>' +
      '<div class="sal-c-s">' + estadoHtml + '</div></div>';
  }

  // cabecera de marca: muestra el logo (img/…) si existe; si no, el nombre estilizado en su color
  function brand(src, text, cls) {
    return '<div class="sal-brand">' +
      '<img class="sal-brand-img" src="' + src + '" alt="' + text + '" ' +
      'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-block\'">' +
      '<span class="sal-brand-txt ' + cls + '" style="display:none">' + text + '</span></div>';
  }

  // icono por tipo de actividad
  function iconFor(fl) {
    const s = ((fl.ejercicios || "") + " " + (fl.tipo || "")).toLowerCase();
    if (s.indexOf("caco") !== -1 || s.indexOf("corr") !== -1 || s.indexOf("run") !== -1 || s.indexOf("carrera") !== -1) return "🏃";
    if (s.indexOf("pilates") !== -1) return "🧘";
    if (s.indexOf("bici") !== -1 || s.indexOf("ride") !== -1 || s.indexOf("cycl") !== -1) return "🚴";
    if (s.indexOf("swim") !== -1 || s.indexOf("nat") !== -1) return "🏊";
    if (s.indexOf("hyrox") !== -1 || s.indexOf("wod") !== -1 || s.indexOf("crossfit") !== -1 || s.indexOf("metcon") !== -1) return "🔥";
    if (s.indexOf("fuerza") !== -1 || s.indexOf("weight") !== -1 || s.indexOf("power") !== -1 || s.indexOf("strength") !== -1) return "💪";
    if (s.indexOf("movil") !== -1 || s.indexOf("yoga") !== -1 || s.indexOf("estab") !== -1) return "🤸";
    if (s.indexOf("walk") !== -1 || s.indexOf("camin") !== -1) return "🚶";
    if (s.indexOf("cardio") !== -1) return "🏃";
    return "🟡";
  }

  // calendario tipo Strava: 5 semanas, un iconito por actividad de cada día
  function trainingCalendar(entr) {
    const byDay = {};
    entr.forEach((r) => { const f = r.fields.fecha; if (!f) return; const k = String(f).slice(0, 10); (byDay[k] = byDay[k] || []).push(r.fields); });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0 = lunes
    const end = new Date(today); end.setDate(end.getDate() + (6 - dow));
    const start = new Date(end); start.setDate(start.getDate() - 34);
    const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    let cells = ["L", "M", "X", "J", "V", "S", "D"].map((d) => '<div class="cal-dow">' + d + '</div>').join("");
    for (let dd = new Date(start); dd <= end; dd.setDate(dd.getDate() + 1)) {
      const k = key(dd), acts = byDay[k] || [], isToday = k === key(today), fut = dd > today;
      const ic = Array.from(new Set(acts.map(iconFor))).slice(0, 3).join("");
      cells += '<div class="cal-day' + (acts.length ? " has" : "") + (isToday ? " today" : "") + (fut ? " fut" : "") + '">' +
        '<span class="cal-n">' + dd.getDate() + '</span>' + (ic ? '<span class="cal-ic">' + ic + '</span>' : "") + '</div>';
    }
    return '<div class="card"><p class="eyebrow">🗓️ Calendario de entrenos</p><div class="cal-grid">' + cells + '</div>' +
      '<div class="sal-c-note" style="margin-top:10px">🏃 cardio · 💪 fuerza · 🧘 pilates · 🤸 movilidad · 🔥 WOD/Hyrox · 🚶 caminar. <i>(Las caminatas sueltas de WHOOP entrarán al activar el auto-sync, #26.)</i></div></div>';
  }

  let data = null, subView = "general";

  async function load() {
    const res = await Promise.all([
      AT.list("mensual", { maxRecords: 24, sort: [{ field: "orden", direction: "asc" }] }).catch(() => []),
      AT.list("entrenos", { maxRecords: 120, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
      AT.list("metricas", { maxRecords: 30, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
    ]);
    return { mensual: res[0].map((r) => r.fields), entr: res[1], metr: res[2] };
  }

  function stravaStats(entr, dias) {
    const today = new Date();
    const daysAgo = (f) => { try { return Math.floor((today - new Date(f)) / 86400000); } catch (e) { return 9999; } };
    const act = entr.filter((r) => daysAgo(r.fields.fecha) <= dias && r.fields.fuente === "Strava");
    const byS = {};
    act.forEach((r) => {
      const s = sport(r.fields.ejercicios); const o = byS[s] = byS[s] || { n: 0, min: 0, km: 0, hr: 0, nhr: 0 };
      o.n++; o.min += r.fields.duracion_min || 0; o.km += r.fields.distancia_km || 0;
      if (typeof r.fields.fc_media === "number") { o.hr += r.fields.fc_media; o.nhr++; }
    });
    const totMin = act.reduce((a, r) => a + (r.fields.duracion_min || 0), 0);
    const totKm = act.reduce((a, r) => a + (r.fields.distancia_km || 0), 0);
    return { act, byS, totMin, totKm };
  }

  // -------- PANEL: WHOOP --------
  function panelWhoop(d) {
    const { mensual, metr } = d;
    const last = mensual[mensual.length - 1] || {}, prev = mensual[mensual.length - 2] || {};
    const vo2 = mensual.map((m) => m.vo2max), pace = mensual.map((m) => m.pace_aging);
    let html = brand("img/whoop-logo.png", "WHOOP", "b-whoop");
    // reciente (metricas)
    const rec = metr.find((m) => typeof m.fields.recuperacion_whoop === "number");
    const hrv = metr.find((m) => typeof m.fields.hrv === "number");
    const rhr = metr.find((m) => typeof m.fields.fc_reposo === "number");
    html += '<div class="card"><p class="eyebrow">❤️ WHOOP · estado reciente</p>' +
      '<div class="sal-grid">' +
      metricCard("Recuperación", rec ? rec.fields.recuperacion_whoop : null, null, 0, "%", false) +
      metricCard("HRV", hrv ? hrv.fields.hrv : null, null, 0, "ms", false) +
      metricCard("FC reposo", rhr ? rhr.fields.fc_reposo : null, null, 0, "bpm", true) +
      '</div><div class="sal-c-d" style="margin-top:8px">Recuperación = cómo de listo está tu cuerpo hoy · HRV alta y FC reposo baja = buena forma.</div></div>';
    // evolución mensual
    if (mensual.length >= 2) {
      const labels = mensual.map((m) => m.mes);
      const paceCol = (v) => (v <= 0.9 ? "#2E6FB5" : v <= 1.3 ? "#C2A21E" : "#7A2230");
      const tbl = '<div class="sal-tblwrap"><table class="sal-tbl"><tr><th>Mes</th><th>Pace</th><th>WHOOP Age</th><th>VO₂max</th><th>Sueño</th></tr>' +
        mensual.map((m) => '<tr><td>' + m.mes + '</td><td>' + n1(m.pace_aging) + 'x</td><td>' + n1(m.whoop_age) + '</td><td>' + n0(m.vo2max) + '</td><td>' + (typeof m.sueno_min === "number" ? (m.sueno_min / 60).toFixed(1) + "h" : "—") + '</td></tr>').join("") + '</table></div>';
      html += '<div class="card"><p class="eyebrow">📈 Evolución · ' + mensual.length + ' meses</p>' +
        '<div class="sal-grid">' +
        metricCard("Pace of Aging", last.pace_aging, prev.pace_aging, 1, "x", true) +
        metricCard("WHOOP Age", last.whoop_age, prev.whoop_age, 1, "", true) +
        metricCard("VO₂max", last.vo2max, prev.vo2max, 0, "", false) +
        metricCard("Sueño", typeof last.sueno_min === "number" ? last.sueno_min / 60 : null, typeof prev.sueno_min === "number" ? prev.sueno_min / 60 : null, 1, "h", false) +
        '</div>' +
        '<div class="sal-sub">Pace of Aging por mes <span style="text-transform:none;letter-spacing:0;color:var(--txt3)">(objetivo &lt; 1.0)</span></div>' +
        barChart(pace, labels, paceCol, 1, 2) +
        '<div class="sal-sub">Detalle mensual</div>' + tbl +
        '<div class="sal-insight">Lo que más bajó es el <b>VO₂max</b> (' + n0(Math.max.apply(null, vo2.filter((x) => typeof x === "number"))) + '→' + n0(last.vo2max) + '), por el parón de la lesión — <b>no el sueño</b>. Recuperando carga cardiovascular con cabeza, el Pace of Aging vuelve hacia ~0.5x.</div></div>';
    } else {
      html += '<div class="card"><div class="hist-empty">Aún no hay histórico mensual de WHOOP.</div></div>';
    }
    return html;
  }

  // -------- PANEL: STRAVA --------
  function panelStrava(d) {
    const { entr } = d;
    const { act, byS, totMin, totKm } = stravaStats(entr, 30);
    let html = brand("img/strava-logo.png", "STRAVA", "b-strava");
    html += '<div class="card"><p class="eyebrow">🏃 Strava · actividad (30 días)</p>';
    if (!act.length) {
      html += '<div class="hist-empty">Aún no hay actividades de Strava en 30 días. En cuanto salgas a correr/nadar/bici y lo publiques, aparece aquí solo.</div>';
    } else {
      html += '<div class="sal-stats">' +
        '<div class="sal-stat"><div class="sal-stat-v">' + act.length + '</div><div class="sal-stat-l">sesiones</div></div>' +
        '<div class="sal-stat"><div class="sal-stat-v">' + (totMin / 60).toFixed(1) + '</div><div class="sal-stat-l">horas</div></div>' +
        '<div class="sal-stat"><div class="sal-stat-v">' + Math.round(totKm) + '</div><div class="sal-stat-l">km</div></div></div>' +
        '<div class="sal-sub">Por deporte</div>' +
        Object.keys(byS).map((s) => { const o = byS[s], spd = o.min ? o.km / (o.min / 60) : 0, hr = o.nhr ? Math.round(o.hr / o.nhr) : 0;
          return '<div class="sal-sport"><span class="sal-sp-n">' + s + '</span><span class="sal-sp-m">' + o.n + ' ses · ' + (o.min / 60).toFixed(1) + ' h' + (o.km ? ' · ' + Math.round(o.km) + ' km · ' + spd.toFixed(1) + ' km/h' : "") + (hr ? ' · ' + hr + ' ppm' : "") + '</span></div>'; }).join("");
    }
    html += '</div>';

    // casillas de conceptos pro (para aprender)
    html += '<div class="card"><p class="eyebrow">🎓 Conceptos pro (aprende a leer Strava)</p>' +
      '<div class="sal-c-note">Estas son las métricas que miran los que saben. Las marcadas 🔒 se activan cuando entrenes con pulso/GPS y enriquezcamos el sync.</div>' +
      concepto("📊", "Fitness / Fatiga / Forma", "Tu fitness sube despacio y la fatiga rápido; la <b>forma</b> es la resta. Sirve para llegar a tope a una carrera.", "Necesita varias semanas de sesiones con carga (Relative Effort).", false) +
      concepto("🎯", "Tiempo en zonas (FC)", "El ~80% del volumen debería ir en <b>Zona 2</b> (base aeróbica); el resto, intensidad. Es tu palanca contra el Pace of Aging.", "Pon bien tus zonas en Strava y graba con pulso.", false) +
      concepto("🔥", "Relative Effort", "La <b>carga</b> de cada sesión. Progresa <b>+10%/semana</b> sin picos (los picos lesionan).", "Se captura al enriquecer el sync de Strava.", false) +
      concepto("📉", "Eficiencia aeróbica", "A igual ritmo, ¿tu FC sube menos con el tiempo? → estás mejorando de base.", "Necesita series de FC por actividad.", false) +
      concepto("🏅", "Best efforts / PRs", "Tus mejores 1k, 5k, 10k… se detectan solos y marcan tu progreso.", "Se activa al enriquecer el sync.", false) +
      concepto("🗺️", "Mapa de rutas", "El recorrido GPS de cada actividad, pintado en un mapa.", "Se captura el trazado (polyline) al enriquecer el sync.", false) +
      '</div>';
    return html;
  }

  // -------- PANEL: GENERAL (mezcla) --------
  function panelGeneral(d) {
    const { mensual, metr, entr } = d;
    const last = mensual[mensual.length - 1] || {};
    const { act, totMin, totKm } = stravaStats(entr, 30);
    const rec = metr.find((m) => typeof m.fields.recuperacion_whoop === "number");
    let html = trainingCalendar(entr);
    html += '<div class="card"><p class="eyebrow">🧭 Visión de conjunto</p>' +
      '<div class="sal-c-note">Aquí se mezclan tus dos fuentes: <b style="color:#7a9cff">WHOOP</b> (cómo te recuperas por dentro) + <b style="color:#fc5200">Strava</b> (lo que entrenas por fuera).</div>' +
      '<ul class="sal-bul">';
    if (rec) html += '<li><b style="color:#7a9cff">WHOOP</b> · Recuperación actual: <b>' + rec.fields.recuperacion_whoop + '%</b>' + (rec.fields.recuperacion_whoop <= 40 ? ' — hoy mejor suave.' : '.') + '</li>';
    if (typeof last.pace_aging === "number") html += '<li><b style="color:#7a9cff">WHOOP</b> · Pace of Aging: <b>' + n1(last.pace_aging) + 'x</b> (empeoró por el parón; reversible).</li>';
    if (typeof last.vo2max === "number") html += '<li><b style="color:#7a9cff">WHOOP</b> · Lo que más bajó: <b>VO₂max</b> (' + n0(last.vo2max) + '). Palanca: recuperar carga cardiovascular.</li>';
    if (act.length) html += '<li><b style="color:#fc5200">Strava</b> · Últimos 30 d: <b>' + act.length + ' sesiones</b>, ' + (totMin / 60).toFixed(0) + ' h, ' + Math.round(totKm) + ' km.</li>';
    else html += '<li><b style="color:#fc5200">Strava</b> · Sin cardio en 30 días. En cuanto empieces, aquí verás carga vs recuperación.</li>';
    html += '</ul></div>';

    // la fusión (clave)
    html += '<div class="card"><p class="eyebrow">🔗 Carga (Strava) × Recuperación (WHOOP)</p>' +
      '<div class="sal-c-d">La idea más potente del hub: cruzar <b>lo que te cuesta un entreno por fuera</b> (ritmo, distancia, esfuerzo de Strava) con <b>lo que te cuesta por dentro</b> (strain y la recuperación del día siguiente de WHOOP). Así sabremos cuánto te "pasa factura" cada sesión y cómo dosificar para volver a 0.5x sin recaer la espalda.</div>' +
      (act.length ? "" : '<div class="sal-c-note" style="margin-top:8px">Se llenará en cuanto entrenes: cada actividad traerá su coste de recuperación al lado.</div>') +
      '</div>';

    html += '<button class="btn btn-primary" id="sal-coach" style="margin-top:2px">💬 Consultar con el coach</button>';
    return html;
  }

  function paint() {
    const tabs = '<div class="subtabs sal-subtabs">' +
      '<button class="subtab' + (subView === "general" ? " active" : "") + '" data-sv="general">🧭 General</button>' +
      '<button class="subtab' + (subView === "whoop" ? " active" : "") + '" data-sv="whoop">❤️ WHOOP</button>' +
      '<button class="subtab' + (subView === "strava" ? " active" : "") + '" data-sv="strava">🏃 Strava</button>' +
      '</div>';
    const panel = subView === "whoop" ? panelWhoop(data) : subView === "strava" ? panelStrava(data) : panelGeneral(data);
    root.innerHTML = tabs + panel;
    root.querySelectorAll(".sal-subtabs .subtab").forEach((b) => b.addEventListener("click", () => {
      subView = b.dataset.sv; paint();
    }));
    const cb = document.getElementById("sal-coach");
    if (cb) cb.addEventListener("click", () => { const fab = document.getElementById("coach-fab"); if (fab) fab.click(); });
  }

  async function render() {
    if (!AT.hasToken()) { root.innerHTML = '<div class="card"><p class="at-help">Conecta Airtable en la pestaña <b>Daily Metrics</b> para ver tu salud.</p></div>'; return; }
    root.innerHTML = '<div class="card"><div class="hist-empty">Cargando tu H&amp;PH…</div></div>';
    try { data = await load(); } catch (e) { root.innerHTML = '<div class="card"><div class="hist-empty">No se pudo cargar: ' + esc(e.message) + '</div></div>'; return; }
    paint();
  }

  document.querySelectorAll('.tab[data-view="salud"]').forEach((t) => t.addEventListener("click", render));
  render();
})();
