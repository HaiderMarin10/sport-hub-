/* Sport Hub — salud.js
   Pestaña "Salud": resumen ejecutivo + evolución mensual (WHOOP) + actividad (Strava),
   en formato fácil de leer (3 min). Lee de Airtable (resumen_mensual, entrenos, metricas). */
(function () {
  "use strict";
  const root = document.getElementById("salud-root");
  if (!root || !window.shAirtable) return;
  const AT = window.shAirtable;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n1 = (x) => (typeof x === "number" ? x.toFixed(1) : "—");
  const n0 = (x) => (typeof x === "number" ? Math.round(x) : "—");

  function sparkline(values, color, w, h) {
    const v = values.filter((x) => typeof x === "number");
    if (v.length < 2) return "";
    const min = Math.min.apply(null, v), max = Math.max.apply(null, v), rng = (max - min) || 1;
    const pad = 6, iw = w - pad * 2, ih = h - pad * 2, step = iw / (values.length - 1);
    const y = (val) => pad + ih - (val - min) / rng * ih;
    const pts = values.map((val, i) => (pad + i * step).toFixed(0) + "," + y(val).toFixed(0)).join(" ");
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="display:block;height:' + h + 'px">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function metricCard(label, now, prev, dec, unit, color, values, betterDown) {
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
      '<div class="sal-m-v">' + val + (unit ? '<small>' + unit + '</small>' : "") + '</div>' +
      sparkline(values, color, 180, 34) + '</div>';
  }

  const sport = (name) => {
    const s = (name || "").toLowerCase();
    return s.indexOf("ride") !== -1 ? "Bici" : s.indexOf("swim") !== -1 ? "Natación" :
      s.indexOf("run") !== -1 ? "Carrera" : s.indexOf("walk") !== -1 || s.indexOf("hike") !== -1 ? "Caminar" : "Otro";
  };

  async function render() {
    if (!AT.hasToken()) { root.innerHTML = '<div class="card"><p class="at-help">Conecta Airtable en la pestaña <b>Diario</b> para ver tu salud.</p></div>'; return; }
    root.innerHTML = '<div class="card"><div class="hist-empty">Cargando tu salud…</div></div>';
    let mensual = [], entr = [], metr = [];
    try {
      const res = await Promise.all([
        AT.list("mensual", { maxRecords: 24, sort: [{ field: "orden", direction: "asc" }] }).catch(() => []),
        AT.list("entrenos", { maxRecords: 80, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
        AT.list("metricas", { maxRecords: 14, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
      ]);
      mensual = res[0].map((r) => r.fields); entr = res[1]; metr = res[2];
    } catch (e) { root.innerHTML = '<div class="card"><div class="hist-empty">No se pudo cargar: ' + esc(e.message) + '</div></div>'; return; }

    const last = mensual[mensual.length - 1] || {}, prev = mensual[mensual.length - 2] || {}, first = mensual[0] || {};
    const pace = mensual.map((m) => m.pace_aging), age = mensual.map((m) => m.whoop_age),
      vo2 = mensual.map((m) => m.vo2max), sue = mensual.map((m) => (typeof m.sueno_min === "number" ? m.sueno_min / 60 : null));

    // ---- evolución ----
    let evol = "";
    if (mensual.length >= 2) {
      evol = '<div class="card"><p class="eyebrow">📈 Evolución · ' + mensual.length + ' meses</p><div class="sal-grid">' +
        metricCard("Pace of Aging", last.pace_aging, prev.pace_aging, 1, "x", "#7A2230", pace, true) +
        metricCard("WHOOP Age", last.whoop_age, prev.whoop_age, 1, "", "#7A2230", age, true) +
        metricCard("VO₂max", last.vo2max, prev.vo2max, 0, "", "#004ABD", vo2, false) +
        metricCard("Sueño", typeof last.sueno_min === "number" ? last.sueno_min / 60 : null, typeof prev.sueno_min === "number" ? prev.sueno_min / 60 : null, 1, "h", "#004ABD", sue, false) +
        '</div><div class="sal-insight">Lo que más bajó es el <b>VO₂max</b> (' + n0(Math.max.apply(null, vo2.filter((x) => typeof x === "number"))) + '→' + n0(last.vo2max) + '), por el parón de intensidad de la lesión — <b>no el sueño</b>. Tu Pace of Aging (' + n1(first.pace_aging) + 'x→' + n1(last.pace_aging) + 'x) debería revertir al recuperar carga cardiovascular con cabeza.</div></div>';
    }

    // ---- actividad (Strava, 30 días) ----
    const today = new Date();
    const daysAgo = (f) => { try { return Math.floor((today - new Date(f)) / 86400000); } catch (e) { return 9999; } };
    const act = entr.filter((r) => daysAgo(r.fields.fecha) <= 30 && r.fields.fuente === "Strava");
    const byS = {};
    act.forEach((r) => { const s = sport(r.fields.ejercicios); const o = byS[s] = byS[s] || { n: 0, min: 0, km: 0 }; o.n++; o.min += r.fields.duracion_min || 0; o.km += r.fields.distancia_km || 0; });
    const totMin = act.reduce((a, r) => a + (r.fields.duracion_min || 0), 0), totKm = act.reduce((a, r) => a + (r.fields.distancia_km || 0), 0);
    let acti = '<div class="card"><p class="eyebrow">🏃 Actividad · últimos 30 días</p>';
    if (!act.length) acti += '<div class="hist-empty">Aún no hay actividades de Strava en 30 días.</div>';
    else {
      acti += '<div class="sal-stats">' +
        '<div class="sal-stat"><div class="sal-stat-v">' + act.length + '</div><div class="sal-stat-l">sesiones</div></div>' +
        '<div class="sal-stat"><div class="sal-stat-v">' + (totMin / 60).toFixed(1) + '</div><div class="sal-stat-l">horas</div></div>' +
        '<div class="sal-stat"><div class="sal-stat-v">' + Math.round(totKm) + '</div><div class="sal-stat-l">km</div></div></div>' +
        '<div class="sal-sub">Por deporte</div>' +
        Object.keys(byS).map((s) => { const o = byS[s], spd = o.min ? o.km / (o.min / 60) : 0; return '<div class="sal-sport"><span class="sal-sp-n">' + s + '</span><span class="sal-sp-m">' + o.n + ' ses · ' + (o.min / 60).toFixed(1) + ' h' + (o.km ? ' · ' + Math.round(o.km) + ' km · ' + spd.toFixed(1) + ' km/h' : "") + '</span></div>'; }).join("");
    }
    acti += '</div>';

    // ---- resumen ejecutivo ----
    const rec = metr.find((m) => typeof m.fields.recuperacion_whoop === "number");
    let res = '<div class="card"><p class="eyebrow">📋 Resumen ejecutivo</p><ul class="sal-bul">';
    if (rec) res += '<li>Recuperación actual: <b>' + rec.fields.recuperacion_whoop + '%</b>' + (rec.fields.recuperacion_whoop <= 40 ? ' — hoy mejor suave.' : '.') + '</li>';
    res += '<li>Pace of Aging: <b>' + n1(last.pace_aging) + 'x</b> (empeoró por el parón de la lesión; reversible).</li>';
    res += '<li>Lo que más bajó: <b>VO₂max</b> (' + n0(last.vo2max) + '). Palanca: recuperar carga cardiovascular.</li>';
    if (act.length) res += '<li>Actividad (30 d): <b>' + act.length + ' sesiones</b>, ' + (totMin / 60).toFixed(0) + ' h, ' + Math.round(totKm) + ' km.</li>';
    res += '</ul><button class="btn btn-primary" id="sal-coach" style="margin-top:6px">💬 Consultar con el coach</button></div>';

    root.innerHTML = evol + acti + res;
    const cb = document.getElementById("sal-coach");
    if (cb) cb.addEventListener("click", () => { const fab = document.getElementById("coach-fab"); if (fab) fab.click(); });
  }

  // render al abrir la pestaña (y una vez al cargar)
  document.querySelectorAll('.tab[data-view="salud"]').forEach((t) => t.addEventListener("click", render));
  render();
})();
