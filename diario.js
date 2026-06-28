/* Sport Hub — diario.js
   Pestaña "Diario": formulario de sensaciones diarias + histórico, contra Airtable (BYOK).
   Tabla sensaciones_diarias y lectura de entrenos. Vanilla JS. */
(function () {
  "use strict";
  const root = document.getElementById("diario-root");
  if (!root || !window.shAirtable) return;
  const AT = window.shAirtable;

  const DOLOR = ["Ninguno", "Lumbar", "Glúteo izquierdo", "Glúteo derecho", "Gemelo izquierdo", "Gemelo derecho", "Pierna izquierda", "Pierna derecha", "Múltiple"];
  const CONTEXTO = ["En reposo", "Caminando", "Durante entreno", "Post entreno", "Al despertar"];
  const FLAGS = ["Día malo espalda", "PR entreno", "Mal sueño", "Estrés laboral", "Viaje", "Lesión"];

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const fmtFecha = (s) => { if (!s) return ""; const p = String(s).slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] : s; };

  // slider 1-10 con badge en vivo
  function slider(id, label, hint, min, max, val) {
    return '<div class="sld"><div class="sld-top"><span class="sld-lbl">' + esc(label) +
      '<small>' + esc(hint) + '</small></span><span class="sld-val" id="' + id + '-v">' + val + '</span></div>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" value="' + val + '" /></div>';
  }
  function chipset(id, opts, multi) {
    return '<div class="chips" id="' + id + '" data-multi="' + (multi ? 1 : 0) + '">' +
      opts.map((o) => '<button type="button" class="chip" data-v="' + esc(o) + '">' + esc(o) + '</button>').join("") + '</div>';
  }

  function render() {
    const connected = AT.hasToken();
    root.innerHTML =
      // ---- barra conexión Airtable (BYOK) ----
      '<div class="card at-bar ' + (connected ? "ok" : "") + '" id="at-bar">' +
        (connected
          ? '<span class="at-dot"></span><span class="at-txt">Airtable conectado — tu diario se guarda en tu base.</span>' +
            '<a class="muted at-change" id="at-change">cambiar / desconectar</a>'
          : '<p class="eyebrow">🔌 Conecta tu Airtable (una vez)</p>' +
            '<p class="at-help">Pega tu <b>Personal Access Token</b> de Airtable. Se guarda <b>solo en este dispositivo</b>. ' +
            'Lo creas en <a href="https://airtable.com/create/tokens" target="_blank" rel="noopener">airtable.com/create/tokens</a> ' +
            'con permisos <b>data.records:read</b> y <b>write</b> sobre la base Sport Hub.</p>' +
            '<div class="at-row"><input type="text" id="at-token" placeholder="pat…" autocomplete="off" />' +
            '<button class="btn btn-primary" id="at-save">Conectar</button></div>') +
      '</div>' +

      // ---- ESTADO: readiness + carga/ACWR + alertas ----
      (connected ? '<div class="card estado-card" id="estado"><div class="hist-empty">Calculando tu estado…</div></div>' : '') +

      // ---- formulario sensaciones ----
      '<div class="card" id="diario-form" ' + (connected ? "" : 'style="opacity:.5;pointer-events:none"') + '>' +
        '<p class="eyebrow">Tus sensaciones de hoy</p>' +
        '<div class="row"><div class="lbl">Fecha</div><input type="date" id="d-fecha" value="' + hoy() + '" /></div>' +

        '<div class="d-moment"><b>🌅</b> <span>Cómo te has levantado</span></div>' +
        slider("d-esp-m", "Espalda al despertar", "1 fatal · 10 perfecta", 1, 10, 6) +
        '<div class="d-sub">¿Dónde notabas molestia?</div>' + chipset("d-dolor", DOLOR, true) +

        '<div class="d-moment"><b>💪</b> <span>Antes de entrenar</span></div>' +
        slider("d-ener", "Energía / cómo te sentías", "1 plano · 10 a tope", 1, 10, 6) +

        '<div class="d-moment"><b>🏋️</b> <span>Cómo has entrenado</span></div>' +
        slider("d-entreno", "Qué tal el entreno", "1 flojo · 10 genial", 1, 10, 6) +
        slider("d-gem", "Molestia gemelos / glúteos", "0 nada · 10 máxima", 0, 10, 0) +
        '<div class="d-sub">¿Cuándo la notas?</div>' + chipset("d-gemctx", CONTEXTO, false) +

        '<div class="d-moment"><b>🌙</b> <span>Cómo estás esta noche</span></div>' +
        slider("d-esp-n", "Espalda esta noche", "1 fatal · 10 perfecta", 1, 10, 6) +
        slider("d-animo", "Ánimo", "1 bajo · 10 alto", 1, 10, 6) +
        slider("d-gen", "Sensación general del día", "1 malo · 10 genial", 1, 10, 6) +

        '<div class="d-sub">Etiquetas</div>' + chipset("d-flags", FLAGS, true) +
        '<div class="d-sub">Nota</div><textarea id="d-nota" rows="3" placeholder="Lo que quieras anotar de hoy…"></textarea>' +
        '<button class="btn btn-primary" id="d-save" style="margin-top:14px">Guardar el día</button>' +
        '<div class="done-note" id="d-note"></div>' +
        '<div class="d-reminder">🌅 Mañana, nada más despertarte, vuelve a abrir el Diario y registra cómo amaneces — es el dato clave de tu espalda.</div>' +
      '</div>' +

      // ---- histórico ----
      '<div class="card">' +
        '<div class="hist-head"><p class="eyebrow" style="margin:0">Tu histórico</p>' +
        '<a class="muted" id="hist-refresh">↻ actualizar</a></div>' +
        '<div id="hist-body"><div class="hist-empty">' + (connected ? "Cargando…" : "Conecta Airtable para ver tu histórico.") + '</div></div>' +
      '</div>';

    wire();
    if (connected) cargarHistorico();
  }

  function wire() {
    // sliders -> badge
    root.querySelectorAll('input[type="range"]').forEach((r) => {
      const v = document.getElementById(r.id + "-v");
      r.addEventListener("input", () => { if (v) v.textContent = r.value; });
    });
    // chipsets (multi / single)
    root.querySelectorAll(".chips[data-multi]").forEach((set) => {
      const multi = set.dataset.multi === "1";
      set.addEventListener("click", (e) => {
        const b = e.target.closest(".chip"); if (!b) return;
        if (!multi) set.querySelectorAll(".chip").forEach((c) => { if (c !== b) c.classList.remove("on"); });
        b.classList.toggle("on");
      });
    });
    // conexión
    const save = document.getElementById("at-save");
    if (save) save.addEventListener("click", conectar);
    const tk = document.getElementById("at-token");
    if (tk) tk.addEventListener("keydown", (e) => { if (e.key === "Enter") conectar(); });
    const ch = document.getElementById("at-change");
    if (ch) ch.addEventListener("click", () => { AT.setToken(""); render(); });
    // guardar día
    const ds = document.getElementById("d-save");
    if (ds) ds.addEventListener("click", guardar);
    const hr = document.getElementById("hist-refresh");
    if (hr) hr.addEventListener("click", cargarHistorico);
  }

  async function conectar() {
    const inp = document.getElementById("at-token");
    const val = (inp.value || "").trim();
    if (!val) return;
    AT.setToken(val);
    const note = document.getElementById("at-bar");
    note.insertAdjacentHTML("beforeend", '<div class="done-note" id="at-note">Probando conexión…</div>');
    const r = await AT.test();
    if (r.ok) { render(); }
    else { AT.setToken(""); document.getElementById("at-note").textContent = "No conecta: " + r.error; }
  }

  const vals = (id) => Array.from(document.querySelectorAll("#" + id + " .chip.on")).map((c) => c.dataset.v);
  const num = (id) => Number(document.getElementById(id).value);

  async function guardar() {
    const btn = document.getElementById("d-save");
    const note = document.getElementById("d-note");
    const fields = {
      fecha: document.getElementById("d-fecha").value || hoy(),
      espalda_mañana: num("d-esp-m"),
      espalda_noche: num("d-esp-n"),
      intensidad_gemelos: num("d-gem"),
      energia_general: num("d-ener"),
      estado_animo: num("d-animo"),
      sensacion_general_dia: num("d-gen"),
    };
    const dolor = vals("d-dolor"); if (dolor.length) fields.dolor_localizado = dolor;
    const ctx = vals("d-gemctx"); if (ctx.length) fields.gemelos_contexto = ctx[0];
    const flags = vals("d-flags"); if (flags.length) fields.flags = flags;
    const entreno = num("d-entreno");
    const notaUser = (document.getElementById("d-nota").value || "").trim();
    fields.nota_transcrita = ["Entreno hoy: " + entreno + "/10", notaUser].filter(Boolean).join(" — ");

    btn.disabled = true; btn.textContent = "Guardando…"; note.textContent = "";
    try {
      await AT.create("sensaciones", fields);
      btn.textContent = "Guardado ✓"; note.textContent = "Anotado en tu diario (sensaciones_diarias) con fecha " + fmtFecha(fields.fecha) + ".";
      setTimeout(() => { btn.disabled = false; btn.textContent = "Guardar el día"; }, 1800);
      cargarHistorico();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Guardar el día";
      note.textContent = "No se pudo guardar: " + e.message;
    }
  }

  // ------- histórico -------
  function sparkline(values) {
    const v = values.filter((x) => typeof x === "number");
    if (v.length < 2) return "";
    const w = 220, h = 38, pad = 3, min = 1, max = 10;
    const step = (w - pad * 2) / (v.length - 1);
    const y = (val) => h - pad - ((val - min) / (max - min)) * (h - pad * 2);
    const pts = v.map((val, i) => (pad + i * step).toFixed(1) + "," + y(val).toFixed(1)).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<polyline points="' + pts + '" fill="none" stroke="var(--acid)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  // ------- ESTADO: readiness + carga/ACWR + alertas -------
  function renderEstado(sens, entr, metr) {
    const box = document.getElementById("estado");
    if (!box) return;
    const now = new Date();
    const daysAgo = (f) => Math.floor((now - new Date(f)) / 86400000);
    const loadOf = (r) => {
      const f = r.fields;
      if (typeof f.duracion_min === "number" && f.duracion_min > 0) return f.duracion_min;
      const n = f.ejercicios ? f.ejercicios.split(",").length : 0;
      return n ? n * 6 : 45; // estimación de carga si no hay duración
    };
    // --- Carga / ACWR (agudo 7d vs crónico media de 4 semanas) ---
    const recientes = entr.filter((r) => r.fields.fecha && daysAgo(r.fields.fecha) >= 0 && daysAgo(r.fields.fecha) <= 27);
    let acwr = null;
    if (recientes.length >= 4) {
      const acute = recientes.filter((r) => daysAgo(r.fields.fecha) <= 6).reduce((a, r) => a + loadOf(r), 0);
      const chronic = recientes.reduce((a, r) => a + loadOf(r), 0) / 4;
      acwr = chronic > 0 ? acute / chronic : null;
    }
    let acwrHtml;
    if (acwr != null) {
      let color, label;
      if (acwr < 0.8) { color = "amber"; label = "carga baja"; }
      else if (acwr <= 1.3) { color = "green"; label = "zona óptima"; }
      else if (acwr <= 1.5) { color = "amber"; label = "subiendo, ojo"; }
      else { color = "red"; label = "riesgo: cargas demasiado rápido"; }
      acwrHtml = row(color, "Carga (ACWR)", acwr.toFixed(2) + " · " + label);
    } else {
      acwrHtml = row("gray", "Carga (ACWR)", '<span class="est-muted">recopilando · faltan ' + Math.max(0, 4 - recientes.length) + " entrenos</span>");
    }
    // --- Espalda (último valor + tendencia) ---
    const esp = sens.map((r) => r.fields.espalda_noche || r.fields.espalda_mañana).filter((x) => typeof x === "number");
    let espHtml = "";
    if (esp.length) {
      const last = esp[0];
      let arrow = "";
      if (esp.length >= 3) {
        const recent = (esp[0] + esp[1]) / 2, older = (esp[1] + esp[2]) / 2;
        arrow = recent > older + 0.3 ? " ↑" : recent < older - 0.3 ? " ↓" : " →";
      }
      espHtml = row(last >= 7 ? "green" : last >= 5 ? "amber" : "red", "Espalda", last + "/10" + arrow);
    }

    // --- WHOOP: anillo de recuperación + métricas + barras 7 días (paleta corporativa) ---
    const zoneCol = (v) => (v >= 67 ? "#004ABD" : v >= 34 ? "#C2A21E" : "#7A2230");
    const txtCol = (v) => (v >= 34 && v < 67 ? "#1a1500" : "#fff");
    const metrSorted = (metr || []).slice().sort((a, b) => (b.fields.fecha || "").localeCompare(a.fields.fecha || ""));
    const latest = metrSorted.find((r) => typeof r.fields.recuperacion_whoop === "number");
    let whoopHtml = "";
    if (latest) {
      const f = latest.fields, rec = f.recuperacion_whoop, col = zoneCol(rec);
      const rad = 54, circ = 2 * Math.PI * rad, dash = (rec / 100) * circ;
      const ring = '<svg viewBox="0 0 140 140" class="est-ring">' +
        '<circle cx="70" cy="70" r="' + rad + '" fill="none" stroke="#1c1f25" stroke-width="11"/>' +
        '<circle cx="70" cy="70" r="' + rad + '" fill="none" stroke="' + col + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 70 70)"/>' +
        '<text x="70" y="64" text-anchor="middle" fill="#fff" font-size="30" font-weight="700">' + rec + '%</text>' +
        '<text x="70" y="86" text-anchor="middle" fill="' + col + '" font-size="8.5" letter-spacing="2">RECUPERACIÓN</text></svg>';
      const tile = (v, l) => '<div class="est-tile"><div class="est-tile-v">' + v + '</div><div class="est-tile-l">' + l + '</div></div>';
      const tiles = [];
      if (typeof f.hrv === "number") tiles.push(tile(f.hrv, "HRV ms"));
      if (typeof f.fc_reposo === "number") tiles.push(tile(f.fc_reposo, "FC reposo"));
      if (typeof f["sueño_total_min"] === "number") { const h = Math.floor(f["sueño_total_min"] / 60), m = f["sueño_total_min"] % 60; tiles.push(tile(h + ":" + String(m).padStart(2, "0"), "Sueño")); }
      if (typeof f.strain_whoop === "number") tiles.push(tile(f.strain_whoop, "Strain"));
      const recDays = metrSorted.filter((r) => typeof r.fields.recuperacion_whoop === "number").slice(0, 7).reverse();
      let bars = "";
      if (recDays.length >= 2) {
        bars = '<div class="est-sub2">Recuperación · últimos días</div><div class="est-bars">' + recDays.map((r) => {
          const v = r.fields.recuperacion_whoop, d = fmtFecha(r.fields.fecha).split("/")[0];
          return '<div class="est-bcol"><div class="est-barea"><div class="est-bar" style="height:' + v + '%;background:' + zoneCol(v) + '"><span style="color:' + txtCol(v) + '">' + v + '</span></div></div><span class="est-bd">' + d + '</span></div>';
        }).join("") + '</div>';
      }
      whoopHtml = '<div class="est-whoop"><div class="est-ring-wrap">' + ring + '</div>' +
        (tiles.length ? '<div class="est-tiles">' + tiles.join("") + '</div>' : "") + '</div>' + bars;
    }

    // --- Alertas ---
    const alerts = [];
    if (esp.length >= 3 && esp[0] < esp[1] && esp[1] < esp[2]) alerts.push("Tu espalda lleva 3 días bajando: hoy prioriza movilidad y control, sin cargar.");
    if (acwr != null && acwr > 1.5) alerts.push("Estás subiendo la carga más rápido de lo que tu cuerpo asimila → riesgo de recaída. Baja la intensidad.");
    if (latest && latest.fields.recuperacion_whoop <= 33) alerts.push("Recuperación baja (" + latest.fields.recuperacion_whoop + "%): hoy mejor movilidad y técnica, no metas carga alta.");
    const alertHtml = alerts.length
      ? alerts.map((a) => '<div class="est-alert">⚠ ' + esc(a) + "</div>").join("")
      : '<div class="est-ok">Todo en orden. Sigue registrando para afinar el seguimiento.</div>';

    box.innerHTML = '<p class="eyebrow">⚡ Estado de hoy</p>' + whoopHtml +
      (whoopHtml ? '<div class="est-div"></div>' : "") + espHtml + acwrHtml + alertHtml;
    function row(color, k, v) {
      return '<div class="est-row"><span class="est-dot ' + color + '"></span><span class="est-k">' + k + '</span><span class="est-v">' + v + "</span></div>";
    }
  }

  async function cargarHistorico() {
    const body = document.getElementById("hist-body");
    if (!body) return;
    body.innerHTML = '<div class="hist-empty">Cargando…</div>';
    try {
      const [sens, entr, metr] = await Promise.all([
        AT.list("sensaciones", { maxRecords: 14, sort: [{ field: "fecha", direction: "desc" }] }),
        AT.list("entrenos", { maxRecords: 10, sort: [{ field: "fecha", direction: "desc" }] }),
        AT.list("metricas", { maxRecords: 14, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
      ]);
      let html = "";
      // medias de los últimos 7 días (los números → tendencia)
      const last7 = sens.slice(0, 7);
      if (last7.length >= 2) {
        const avg = (f) => { const v = last7.map((r) => r.fields[f]).filter((x) => typeof x === "number"); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
        const cell = (lbl, val) => val ? '<div class="avg-cell"><div class="avg-n">' + val + '</div><div class="avg-l">' + lbl + '</div></div>' : '';
        const row = cell("espalda AM", avg("espalda_mañana")) + cell("espalda PM", avg("espalda_noche")) + cell("energía", avg("energia_general")) + cell("ánimo", avg("estado_animo"));
        if (row) html += '<div class="avg-row">' + row + '</div><div class="avg-cap">medias de los últimos ' + last7.length + ' días</div>';
      }
      // métricas WHOOP/Samsung (solo si hay datos)
      if (metr && metr.length) {
        html += '<div class="d-sub" style="margin-top:0">Métricas (WHOOP / Samsung)</div>';
        html += metr.map((r) => {
          const f = r.fields, bits = [];
          if (typeof f.recuperacion_whoop === "number") bits.push("recup " + f.recuperacion_whoop + "%");
          if (typeof f.hrv === "number") bits.push("HRV " + f.hrv);
          if (typeof f.fc_reposo === "number") bits.push("FC rep " + f.fc_reposo);
          if (typeof f["sueño_total_min"] === "number") bits.push("sueño " + (f["sueño_total_min"] / 60).toFixed(1) + "h");
          if (typeof f.peso_kg === "number") bits.push(f.peso_kg + "kg");
          return '<div class="hist-row"><span class="hist-d">' + fmtFecha(f.fecha) + '</span><span class="hist-meta">' + esc(bits.join(" · ") || "—") + '</span></div>';
        }).join("");
      }
      // tendencia espalda (de más antiguo a más reciente)
      const esp = sens.slice().reverse().map((r) => r.fields.espalda_noche || r.fields.espalda_mañana).filter((x) => typeof x === "number");
      if (esp.length >= 2) {
        const last = esp[esp.length - 1];
        html += '<div class="trend"><div class="trend-h">Tendencia espalda <b>' + last + '/10</b></div>' + sparkline(esp) + '</div>';
      }
      // entrenos recientes
      html += '<div class="d-sub" style="margin-top:6px">Últimos entrenos</div>';
      if (!entr.length) html += '<div class="hist-empty">Aún no hay entrenos registrados.</div>';
      else html += entr.map((r) => {
        const f = r.fields, n = (f.ejercicios ? f.ejercicios.split(",").length : 0);
        const head = '<span class="hist-d">' + fmtFecha(f.fecha) + '</span>' +
          '<span class="hist-tag">' + esc(f.tipo || "—") + '</span>' +
          '<span class="hist-meta">' + (f.duracion_min ? f.duracion_min + "′ · " : "") + (n ? n + (n === 1 ? " ejercicio" : " ejercicios") : esc((f.notas || "").slice(0, 40))) + '</span>';
        const detalle = f.series_reps_cargas || f.ejercicios || "";
        if (!detalle) return '<div class="hist-row">' + head + '</div>';
        return '<details class="hist-det"><summary class="hist-row">' + head + '<span class="hist-caret">▾</span></summary>' +
          '<div class="hist-detail">' + esc(detalle).replace(/ \| /g, "<br>").replace(/\|/g, "<br>") +
          (f.notas ? '<div class="hist-note">' + esc(f.notas) + '</div>' : "") + '</div></details>';
      }).join("");
      // sensaciones recientes
      html += '<div class="d-sub" style="margin-top:12px">Últimos días</div>';
      if (!sens.length) html += '<div class="hist-empty">Aún no has registrado sensaciones.</div>';
      else html += sens.map((r) => {
        const f = r.fields;
        const bits = [];
        if (typeof f.espalda_noche === "number" || typeof f.espalda_mañana === "number") bits.push("espalda " + (f.espalda_noche || f.espalda_mañana) + "/10");
        if (typeof f.energia_general === "number") bits.push("energía " + f.energia_general);
        if (typeof f.estado_animo === "number") bits.push("ánimo " + f.estado_animo);
        return '<div class="hist-row"><span class="hist-d">' + fmtFecha(f.fecha) + '</span>' +
          '<span class="hist-meta">' + esc(bits.join(" · ") || "—") + (f.nota_transcrita ? ' · “' + esc(f.nota_transcrita.slice(0, 30)) + '”' : "") + '</span></div>';
      }).join("");
      body.innerHTML = html;
      renderEstado(sens, entr, metr);
    } catch (e) {
      body.innerHTML = '<div class="hist-empty">No se pudo cargar: ' + esc(e.message) + '</div>';
    }
  }

  render();
})();
