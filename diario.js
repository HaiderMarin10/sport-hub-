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

      // ---- formulario sensaciones ----
      '<div class="card" id="diario-form" ' + (connected ? "" : 'style="opacity:.5;pointer-events:none"') + '>' +
        '<p class="eyebrow">¿Cómo estás hoy?</p>' +
        '<div class="row"><div class="lbl">Fecha</div><input type="date" id="d-fecha" value="' + hoy() + '" /></div>' +
        slider("d-esp-m", "Espalda al despertar", "1 fatal · 10 perfecta", 1, 10, 6) +
        slider("d-esp-n", "Espalda por la noche", "1 fatal · 10 perfecta", 1, 10, 6) +
        '<div class="d-sub">Dolor localizado</div>' + chipset("d-dolor", DOLOR, true) +
        slider("d-gem", "Molestia en gemelos", "0 nada · 10 máxima", 0, 10, 0) +
        '<div class="d-sub">¿Cuándo notas los gemelos?</div>' + chipset("d-gemctx", CONTEXTO, false) +
        slider("d-ener", "Energía general", "1 plano · 10 a tope", 1, 10, 6) +
        slider("d-animo", "Ánimo", "1 bajo · 10 alto", 1, 10, 6) +
        slider("d-gen", "Sensación general del día", "1 malo · 10 genial", 1, 10, 6) +
        '<div class="d-sub">Etiquetas</div>' + chipset("d-flags", FLAGS, true) +
        '<div class="d-sub">Nota</div><textarea id="d-nota" rows="3" placeholder="Lo que quieras anotar de hoy…"></textarea>' +
        '<button class="btn btn-primary" id="d-save" style="margin-top:14px">Guardar el día</button>' +
        '<div class="done-note" id="d-note"></div>' +
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
    const nota = (document.getElementById("d-nota").value || "").trim(); if (nota) fields.nota_transcrita = nota;

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

  async function cargarHistorico() {
    const body = document.getElementById("hist-body");
    if (!body) return;
    body.innerHTML = '<div class="hist-empty">Cargando…</div>';
    try {
      const [sens, entr] = await Promise.all([
        AT.list("sensaciones", { maxRecords: 14, sort: [{ field: "fecha", direction: "desc" }] }),
        AT.list("entrenos", { maxRecords: 10, sort: [{ field: "fecha", direction: "desc" }] }),
      ]);
      let html = "";
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
        return '<div class="hist-row"><span class="hist-d">' + fmtFecha(f.fecha) + '</span>' +
          '<span class="hist-tag">' + esc(f.tipo || "—") + '</span>' +
          '<span class="hist-meta">' + (f.duracion_min ? f.duracion_min + "′ · " : "") + (n ? n + " ejercicios" : esc((f.notas || "").slice(0, 40))) + '</span></div>';
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
    } catch (e) {
      body.innerHTML = '<div class="hist-empty">No se pudo cargar: ' + esc(e.message) + '</div>';
    }
  }

  render();
})();
