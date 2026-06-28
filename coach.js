/* Sport Hub — coach.js
   Chat con el coach IA (BYOK: la API key vive solo en este dispositivo).
   INTEGRADO con la app: cuando le pides un entreno, usa una "tool" y lo carga
   directamente en el Generador (editable, con series, marcar hecho). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  if (!$("#coach-log")) return;

  const LS = "sh_anthropic_key";
  const MODEL = "claude-sonnet-4-6";
  const log = $("#coach-log"), input = $("#coach-text"), sendBtn = $("#coach-send");
  const keybar = $("#coach-keybar"), keyInput = $("#coach-key"), keySave = $("#coach-key-save"), clearKey = $("#coach-clearkey");
  const drawer = $("#coach"), fab = $("#coach-fab"), drawerClose = $("#coach-close");
  const historial = [];

  function abrir() {
    drawer.classList.add("open");
    document.body.classList.add("coach-open");
    cargarContexto(); // refresca el diario reciente cada vez que abre
    setTimeout(() => { (getKey() ? input : (keyInput || input)).focus(); }, 280);
  }
  function cerrar() {
    drawer.classList.remove("open");
    document.body.classList.remove("coach-open");
  }

  // ---------- repertorio + system prompt ----------
  function repertorio() {
    const EX = window.EJERCICIOS || [];
    const cats = {};
    EX.forEach((e) => { (cats[e.c] = cats[e.c] || []).push(e.n); });
    return Object.keys(cats).map((c) => "- " + c + ": " + cats[c].join(", ")).join("\n");
  }
  const SYSTEM =
    "Eres el asistente personal de Andrés Marín (35 años, banquero de M&A en Madrid) DENTRO de su app SportsHub. " +
    "Eres su coach deportivo y de rehabilitación, PERO TAMBIÉN su asistente para todo lo demás: responde CUALQUIER pregunta que te haga " +
    "(sobre su salud, su evolución, su recuperación, su Pace of Aging, su actividad, sus datos de WHOOP/Strava/diario, o lo que sea), " +
    "con criterio y de forma útil, como un asistente completo. Si te pregunta por su evolución o sus métricas, usa el contexto que tienes y respóndele claro. " +
    "Andrés está en rehabilitación de espalda: hernia L4-L5 recidivada con afectación radicular L5-S1; síntomas " +
    "frecuentes en gemelos y glúteos. Su objetivo a medio plazo es volver a Hyrox y triatlón, gestionando la espalda. " +
    "Su entrenador y fisio se llama Nacho; el repertorio de ejercicios de la app es de Nacho.\n\n" +
    "REPERTORIO DE NACHO (categoría: ejercicios):\n" + repertorio() + "\n\nREGLAS:\n" +
    "- Responde SIEMPRE en español, claro y conciso, con tono de coach cercano.\n" +
    "- Cuando Andrés te pida un entreno (montar, generar, 'en formato generador', 'output', 'pásalo al generador', o te pegue un entreno ya escrito para que lo cargues), " +
    "NUNCA lo escribas como tabla ni texto en el chat: SIEMPRE LLAMA a la herramienta `proponer_entreno` para que aparezca en su Generador " +
    "(editable, con series, para marcar como hecho). Usa nombres EXACTOS del repertorio de arriba. Tras llamarla, comenta en 1-2 frases qué le has montado y por qué.\n" +
    "- Para VER o MODIFICAR el entreno que ya tiene cargado, primero llama a `entreno_actual` para leerlo y luego `proponer_entreno` con la versión cambiada.\n" +
    "- REGISTRAR EL DÍA (importante): cuando Andrés te cuente con sus palabras cómo se siente (espalda al levantarse o por la noche, gemelos/glúteos, energía, ánimo, cómo le ha ido el día o el entreno) o te diga 'registra/anota mi día', llama a `registrar_dia` extrayendo SOLO lo que mencione. Escalas 1-10 (en espalda/energía/ánimo, 10 = mejor; en gemelos, 10 = más molestia). Si te cuenta un entreno que YA ha hecho ('he salido a correr 10k', 'he hecho fuerza'), llama a `registrar_entreno`. Si te da MÉTRICAS de WHOOP/Samsung/MyFitnessPal/báscula (recuperación, HRV, sueño, FC reposo, pasos, calorías, proteína, peso…), llama a `registrar_metricas`. No le interrogues: extrae lo que diga; tras guardar, confírmaselo en 1 frase y, si falta algo clave (p.ej. no dijo cómo tiene la espalda), pregúntaselo suelto.\n" +
    "- Si Andrés pide 'un entreno de favoritos', móntalo con `proponer_entreno` usando sus ejercicios favoritos (te los paso en el contexto).\n" +
    "- Respeta su espalda: evita por defecto carga axial alta e impacto salvo que lo pida.\n" +
    "- No eres médico: ante dolor agudo o señales neurológicas nuevas, recomiéndale ver a Nacho o a su médico.\n" +
    "- No inventes datos. Si falta información, pregunta.";

  const TOOL_ENTRENO = {
    name: "proponer_entreno",
    description: "Carga un entrenamiento estructurado en el Generador de la app, para que Andrés lo vea, edite, ajuste series y lo marque como hecho. Úsalo SIEMPRE que pida montar/generar un entreno. Los nombres deben ser ejercicios del repertorio de Nacho.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título corto del entreno" },
        bloques: {
          type: "array",
          description: "Bloques del entreno (movilidad, activación, fuerza, estabilidad, core…)",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "Nombre del bloque (incluye 'movilidad', 'activación', 'fuerza', 'estabilidad' o 'core' si aplica)" },
              ejercicios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nombre: { type: "string", description: "Nombre exacto del ejercicio del repertorio" },
                    series: { type: "string", description: "Prescripción, p.ej. '4 × 8-12', '3 × 8 / lado' o '2 × 45\"'" },
                  },
                  required: ["nombre", "series"],
                },
              },
            },
            required: ["titulo", "ejercicios"],
          },
        },
      },
      required: ["titulo", "bloques"],
    },
  };

  const TOOL_VER = {
    name: "entreno_actual",
    description: "Devuelve el entreno que Andrés tiene cargado AHORA en el Generador (bloques, ejercicios y series). Úsalo cuando pida ver o MODIFICAR el entreno actual: léelo con esta herramienta y luego llama a proponer_entreno con la versión modificada.",
    input_schema: { type: "object", properties: {} },
  };

  const hoyISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  const TOOL_DIA = {
    name: "registrar_dia",
    description: "Guarda en el DIARIO de Andrés (sensaciones_diarias) cómo se siente, a partir de lo que te cuenta con sus palabras. Úsalo SIEMPRE que Andrés describa su estado (espalda al levantarse o por la noche, gemelos/glúteos, energía, ánimo, cómo le ha ido el día o el entreno) o te pida registrar/anotar su día. EXTRAE solo lo que mencione; deja sin rellenar lo que no diga. No le interrogues con muchas preguntas.",
    input_schema: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "YYYY-MM-DD. Si no lo dice, hoy." },
        espalda_manana: { type: "number", description: "Espalda al despertar: 1 (fatal) a 10 (perfecta)." },
        espalda_noche: { type: "number", description: "Espalda por la noche: 1 a 10." },
        intensidad_gemelos: { type: "number", description: "Molestia gemelos/glúteos: 0 (nada) a 10 (máxima)." },
        gemelos_contexto: { type: "string", enum: ["En reposo", "Caminando", "Durante entreno", "Post entreno", "Al despertar"] },
        dolor_localizado: { type: "array", items: { type: "string", enum: ["Ninguno", "Lumbar", "Glúteo izquierdo", "Glúteo derecho", "Gemelo izquierdo", "Gemelo derecho", "Pierna izquierda", "Pierna derecha", "Múltiple"] } },
        energia_general: { type: "number", description: "1 (plano) a 10 (a tope)." },
        estado_animo: { type: "number", description: "1 a 10." },
        sensacion_general_dia: { type: "number", description: "1 (malo) a 10 (genial)." },
        flags: { type: "array", items: { type: "string", enum: ["Día malo espalda", "PR entreno", "Mal sueño", "Estrés laboral", "Viaje", "Lesión"] } },
        entreno_valoracion: { type: "number", description: "Si comenta qué tal entrenó: 1 (flojo) a 10 (genial)." },
        nota: { type: "string", description: "Texto con los matices que cuente (miedos, contexto, lo que le ha molado…)." },
      },
    },
  };

  const TOOL_ENT_LOG = {
    name: "registrar_entreno",
    description: "Guarda en la tabla entrenos un entrenamiento que Andrés YA HA HECHO y te cuenta con sus palabras (p.ej. 'hoy he salido a correr 10k', 'he hecho fuerza'). NO es para proponer un entreno futuro (para eso usa proponer_entreno).",
    input_schema: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "YYYY-MM-DD; si no lo dice, hoy." },
        tipo: { type: "string", enum: ["Fuerza", "Movilidad", "Pilates", "Cardio", "Rehabilitación", "Mixto"] },
        duracion_min: { type: "number" },
        ejercicios: { type: "string", description: "Ejercicios o actividad realizada (texto)." },
        sensacion_espalda_durante: { type: "number", description: "1 a 10." },
        notas: { type: "string" },
      },
      required: ["tipo"],
    },
  };

  const TOOL_METRICAS = {
    name: "registrar_metricas",
    description: "Guarda métricas fisiológicas y de nutrición que Andrés te diga (de WHOOP, Samsung Health, MyFitnessPal o la báscula): recuperación, HRV, strain, sueño, FC en reposo, pasos, calorías, macros, peso… en la tabla metricas_diarias. Úsalo cuando te dé números de esos. Extrae solo lo que mencione.",
    input_schema: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "YYYY-MM-DD; si no lo dice, hoy." },
        recuperacion_whoop: { type: "number", description: "Recuperación WHOOP en % (0-100)." },
        hrv: { type: "number", description: "Variabilidad de frecuencia cardiaca (ms)." },
        strain_whoop: { type: "number", description: "Strain WHOOP (0-21)." },
        sueno_total_min: { type: "number", description: "Sueño total en MINUTOS (si te lo da en horas, multiplica ×60)." },
        sueno_calidad_subjetiva: { type: "number", description: "Calidad de sueño percibida 1-10." },
        fc_reposo: { type: "number", description: "Frecuencia cardiaca en reposo (ppm)." },
        pasos: { type: "number" },
        calorias_consumidas: { type: "number" },
        proteina_g: { type: "number" },
        carbos_g: { type: "number" },
        grasa_g: { type: "number" },
        hidratacion_ml: { type: "number" },
        peso_kg: { type: "number" },
      },
    },
  };

  // ---------- clave ----------
  const getKey = () => localStorage.getItem(LS) || "";
  function setKey(k) { if (k) localStorage.setItem(LS, k); else localStorage.removeItem(LS); refrescar(); }
  function refrescar() {
    const has = !!getKey();
    keybar.classList.toggle("hidden", has);
    input.disabled = !has;
    sendBtn.disabled = !has;
    clearKey.textContent = has ? "🔑 Cambiar / borrar clave" : "";
  }
  // Sincroniza la clave con Airtable para que sobreviva al borrado de caché / cambio de dispositivo.
  async function sincronizarClave(k) {
    const AT = window.shAirtable;
    if (!AT || !AT.hasToken()) return;
    try {
      const recs = await AT.list("config", { maxRecords: 10 });
      const r = recs.find((x) => x.fields.clave === "anthropic_key");
      if (r) await AT.del("config", r.id);
      if (k) await AT.create("config", { clave: "anthropic_key", valor: k });
    } catch (e) { /* silencioso */ }
  }
  async function recuperarClave() {
    if (getKey()) return false;
    const AT = window.shAirtable;
    if (!AT || !AT.hasToken()) return false;
    try {
      const recs = await AT.list("config", { maxRecords: 10 });
      const r = recs.find((x) => x.fields.clave === "anthropic_key");
      if (r && r.fields.valor) { localStorage.setItem(LS, String(r.fields.valor).trim()); refrescar(); return true; }
    } catch (e) {}
    return false;
  }

  // ---------- burbujas ----------
  function burbuja(role, texto, clase) {
    const div = document.createElement("div");
    div.className = "msg " + (clase || (role === "user" ? "user" : "coach"));
    div.textContent = texto;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // ---------- construir el entreno y cargarlo en el Generador ----------
  function cargarEntreno(input) {
    try {
      const EX = window.EJERCICIOS || [];
      const byName = {};
      EX.forEach((e) => { byName[e.n.toLowerCase()] = e; });
      const findEx = (nombre) => {
        const k = (nombre || "").toLowerCase().trim();
        if (byName[k]) return byName[k];
        const hit = EX.find((e) => e.n.toLowerCase().includes(k) || (k.length > 3 && k.includes(e.n.toLowerCase())));
        return hit || { n: nombre, c: "Sugerido", s: "", b: "fuerza", r: "medio", d: "" };
      };
      const blkFromTitle = (t) => {
        t = (t || "").toLowerCase();
        if (t.indexOf("movil") !== -1) return ["movilidad"];
        if (t.indexOf("activ") !== -1) return ["activacion"];
        if (t.indexOf("estab") !== -1) return ["estabilidad"];
        if (t.indexOf("core") !== -1) return ["core"];
        return ["fuerza"];
      };
      const plan = (input.bloques || []).map((b) => ({
        titulo: b.titulo || "Bloque",
        blks: blkFromTitle(b.titulo),
        ejercicios: (b.ejercicios || []).map((x) => ({ e: findEx(x.nombre), serie: x.series || "" })),
      })).filter((g) => g.ejercicios.length);

      if (!plan.length || !window.SportHub) return "No pude cargar el entreno en el generador.";
      window.SportHub.cargarPlan(plan);
      const total = plan.reduce((a, g) => a + g.ejercicios.length, 0);
      if (window.innerWidth < 980) setTimeout(cerrar, 800); // en móvil, cierra el panel para ver el generador
      burbuja("assistant", "✅ Montado en el Generador (" + total + " ejercicios): cámbialo, ajusta series o márcalo como hecho. Puedes seguir pidiéndome cambios desde aquí. 💪", "coach");
      return "Entreno cargado en el generador (" + total + " ejercicios). Coméntalo brevemente.";
    } catch (e) {
      return "Error al cargar el entreno: " + (e.message || e);
    }
  }

  // ---------- contexto reciente del diario (CONECTA los números con el coach) ----------
  let contextoReciente = "";
  async function cargarContexto() {
    const bloques = [];
    // favoritos (localStorage, no necesita Airtable)
    const favs = (window.SportHubFavs ? window.SportHubFavs.list() : []);
    if (favs.length) bloques.push("EJERCICIOS FAVORITOS de Andrés: " + favs.join(", ") +
      ".\nSi pide 'un entreno de favoritos' (o algo así), MÓNTALO con `proponer_entreno` priorizando estos ejercicios (nombres exactos del repertorio).");
    // diario reciente (necesita Airtable conectado)
    if (window.shAirtable && window.shAirtable.hasToken()) {
      try {
        const [sens, entr, metr, mens] = await Promise.all([
          window.shAirtable.list("sensaciones", { maxRecords: 7, sort: [{ field: "fecha", direction: "desc" }] }),
          window.shAirtable.list("entrenos", { maxRecords: 3, sort: [{ field: "fecha", direction: "desc" }] }),
          window.shAirtable.list("metricas", { maxRecords: 5, sort: [{ field: "fecha", direction: "desc" }] }).catch(() => []),
          window.shAirtable.list("mensual", { maxRecords: 12, sort: [{ field: "orden", direction: "asc" }] }).catch(() => []),
        ]);
        // WHOOP reciente
        const ml = metr.filter((r) => typeof r.fields.recuperacion_whoop === "number").slice(0, 3)
          .map((r) => { const f = r.fields; return (f.fecha || "") + " recup " + f.recuperacion_whoop + "% · HRV " + f.hrv + " · FC reposo " + f.fc_reposo + " · sueño " + (f["sueño_total_min"] ? Math.round(f["sueño_total_min"] / 6) / 10 + "h" : "—") + " · strain " + (f.strain_whoop || "—"); });
        if (ml.length) bloques.push("WHOOP reciente:\n- " + ml.join("\n- "));
        // evolución mensual (Pace of Aging / WHOOP Age)
        if (mens.length) {
          const me = mens.map((r) => r.fields);
          const lastM = me[me.length - 1];
          bloques.push("EVOLUCIÓN MENSUAL (de los Month in Review de WHOOP): Pace of Aging va " +
            me.map((m) => m.pace_aging + "x").join("→") + " (último mes " + lastM.mes + ": WHOOP Age " + lastM.whoop_age + ", Pace " + lastM.pace_aging + "x, VO2max " + lastM.vo2max + ", sueño " + (lastM.sueno_min ? Math.round(lastM.sueno_min / 6) / 10 + "h" : "—") +
            "). CLAVE: el empeoramiento (primavera 2026) viene del bajón de carga/VO2max por la lesión, NO del sueño; revierte recuperando carga cardiovascular con cabeza.");
        }
        const lines = sens.slice(0, 5).map((r) => {
          const f = r.fields, p = [];
          if (typeof f.espalda_mañana === "number") p.push("espalda AM " + f.espalda_mañana);
          if (typeof f.espalda_noche === "number") p.push("PM " + f.espalda_noche);
          if (typeof f.intensidad_gemelos === "number") p.push("gemelos/glúteo " + f.intensidad_gemelos);
          if (typeof f.energia_general === "number") p.push("energía " + f.energia_general);
          if (Array.isArray(f.dolor_localizado) && f.dolor_localizado.length) p.push("dolor: " + f.dolor_localizado.join("/"));
          return (f.fecha || "") + " → " + p.join(", ") + (f.nota_transcrita ? " — " + f.nota_transcrita : "");
        });
        // entrenos CON la lista completa de ejercicios (para que sepa todo lo que ha hecho)
        const ent = entr.map((r) => (r.fields.fecha || "") + " " + (r.fields.tipo || "") + ": " + String(r.fields.ejercicios || "(sin detalle)"));
        if (lines.length) bloques.push("Sensaciones recientes:\n- " + lines.join("\n- "));
        if (ent.length) bloques.push("Últimos entrenos (con los ejercicios EXACTOS que hizo):\n- " + ent.join("\n- "));
      } catch (e) { /* sin diario si falla */ }
    }
    contextoReciente = bloques.length
      ? "CONTEXTO DE ANDRÉS (de su app; intégralo con naturalidad, vigila su espalda L4-L5 / glúteos / gemelos; NO lo recites entero):\n" + bloques.join("\n\n")
      : "";
  }

  // ---------- registrar el día / el entreno en Airtable (voz/texto -> datos) ----------
  async function registrarDia(input) {
    if (!window.shAirtable || !window.shAirtable.hasToken())
      return "NO PUEDO guardar: Andrés tiene que conectar Airtable en la pestaña Hoy (un token, una vez). Pídeselo amablemente.";
    try {
      const f = { fecha: input.fecha || hoyISO() };
      if (typeof input.espalda_manana === "number") f["espalda_mañana"] = input.espalda_manana;
      if (typeof input.espalda_noche === "number") f.espalda_noche = input.espalda_noche;
      if (typeof input.intensidad_gemelos === "number") f.intensidad_gemelos = input.intensidad_gemelos;
      if (typeof input.energia_general === "number") f.energia_general = input.energia_general;
      if (typeof input.estado_animo === "number") f.estado_animo = input.estado_animo;
      if (typeof input.sensacion_general_dia === "number") f.sensacion_general_dia = input.sensacion_general_dia;
      if (input.gemelos_contexto) f.gemelos_contexto = input.gemelos_contexto;
      if (Array.isArray(input.dolor_localizado) && input.dolor_localizado.length) f.dolor_localizado = input.dolor_localizado;
      if (Array.isArray(input.flags) && input.flags.length) f.flags = input.flags;
      const nota = [];
      if (typeof input.entreno_valoracion === "number") nota.push("Entreno: " + input.entreno_valoracion + "/10");
      if (input.nota) nota.push(input.nota);
      if (nota.length) f.nota_transcrita = nota.join(" — ");
      await window.shAirtable.create("sensaciones", f);
      cargarContexto();
      return "GUARDADO en el diario (sensaciones, " + f.fecha + "). Confírmaselo a Andrés en 1 frase cálida y, si falta algún dato clave que no haya dicho, pregúntaselo suelto (sin agobiar).";
    } catch (e) { return "Error al guardar el día: " + (e.message || e); }
  }
  async function registrarEntreno(input) {
    if (!window.shAirtable || !window.shAirtable.hasToken())
      return "NO PUEDO guardar: Andrés tiene que conectar Airtable en la pestaña Hoy.";
    try {
      const f = { fecha: input.fecha || hoyISO(), fuente: "Manual" };
      if (input.tipo) f.tipo = input.tipo;
      if (typeof input.duracion_min === "number") f.duracion_min = input.duracion_min;
      if (input.ejercicios) f.ejercicios = input.ejercicios;
      if (typeof input.sensacion_espalda_durante === "number") f.sensacion_espalda_durante = input.sensacion_espalda_durante;
      if (input.notas) f.notas = input.notas;
      await window.shAirtable.create("entrenos", f);
      cargarContexto();
      return "GUARDADO en entrenos (" + f.fecha + "). Confírmaselo a Andrés en 1 frase.";
    } catch (e) { return "Error al guardar el entreno: " + (e.message || e); }
  }
  async function registrarMetricas(input) {
    if (!window.shAirtable || !window.shAirtable.hasToken())
      return "NO PUEDO guardar: Andrés tiene que conectar Airtable en la pestaña Hoy.";
    try {
      const f = { fecha: input.fecha || hoyISO() };
      const map = {
        recuperacion_whoop: "recuperacion_whoop", hrv: "hrv", strain_whoop: "strain_whoop",
        sueno_total_min: "sueño_total_min", sueno_calidad_subjetiva: "sueño_calidad_subjetiva",
        fc_reposo: "fc_reposo", pasos: "pasos", calorias_consumidas: "calorias_consumidas",
        proteina_g: "proteina_g", carbos_g: "carbos_g", grasa_g: "grasa_g",
        hidratacion_ml: "hidratacion_ml", peso_kg: "peso_kg",
      };
      Object.keys(map).forEach((k) => { if (typeof input[k] === "number") f[map[k]] = input[k]; });
      if (Object.keys(f).length <= 1) return "No me has dado ninguna métrica numérica. Pregúntale qué quiere registrar.";
      await window.shAirtable.create("metricas", f);
      cargarContexto();
      return "GUARDADO en metricas_diarias (" + f.fecha + "). Confírmaselo a Andrés en 1 frase.";
    } catch (e) { return "Error al guardar las métricas: " + (e.message || e); }
  }

  // ---------- llamada a Claude (con bucle de tool use) ----------
  async function callClaude(toolChoice) {
    const system = [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }];
    if (contextoReciente) system.push({ type: "text", text: contextoReciente });
    const body = {
      model: MODEL,
      max_tokens: 1500,
      system: system,
      tools: [TOOL_ENTRENO, TOOL_VER, TOOL_DIA, TOOL_ENT_LOG, TOOL_METRICAS],
      messages: historial,
    };
    if (toolChoice) body.tool_choice = toolChoice;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": getKey(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function ronda(depth, mode, propuesto) {
    if (depth > 4) return;
    let toolChoice;
    if (mode === "create" && depth === 0 && !propuesto) toolChoice = { type: "tool", name: "proponer_entreno" };
    else if (mode === "modify" && !propuesto) toolChoice = { type: "any" };

    const typing = burbuja("assistant", "escribiendo…", "coach typing");
    const { ok, status, data } = await callClaude(toolChoice);
    typing.remove();
    if (!ok) {
      const m = (data.error && data.error.message) || ("Error " + status);
      burbuja("assistant", "⚠ " + m + (status === 401 ? " — revisa tu API key." : ""), "coach");
      if (status === 401) keybar.classList.remove("hidden");
      return;
    }
    const content = data.content || [];
    historial.push({ role: "assistant", content });

    const text = content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (text) burbuja("assistant", text);

    const tools = content.filter((b) => b.type === "tool_use");
    if (tools.length) {
      const results = await Promise.all(tools.map(async (tu) => {
        let c = "hecho";
        if (tu.name === "proponer_entreno") c = cargarEntreno(tu.input);
        else if (tu.name === "entreno_actual") {
          const p = (window.SportHub && window.SportHub.getPlan) ? window.SportHub.getPlan() : null;
          c = p ? JSON.stringify(p) : "No hay ningún entreno cargado en el generador ahora mismo.";
        }
        else if (tu.name === "registrar_dia") c = await registrarDia(tu.input);
        else if (tu.name === "registrar_entreno") c = await registrarEntreno(tu.input);
        else if (tu.name === "registrar_metricas") c = await registrarMetricas(tu.input);
        return { type: "tool_result", tool_use_id: tu.id, content: c };
      }));
      if (tools.some((tu) => tu.name === "proponer_entreno")) propuesto = true;
      historial.push({ role: "user", content: results });
      await ronda(depth + 1, mode, propuesto); // que Claude cierre con un comentario
    }
  }

  async function enviar(texto) {
    texto = (texto || "").trim();
    if (!texto) return;
    if (!getKey()) {
      keybar.classList.remove("hidden");
      burbuja("assistant", "Para chatear conmigo necesito tu API key de Anthropic (se guarda solo en tu móvil). Pégala aquí arriba 👆 y dale a Guardar. La sacas gratis en console.anthropic.com → API Keys.", "coach");
      keyInput && keyInput.focus();
      return;
    }
    input.value = "";
    burbuja("user", texto);
    historial.push({ role: "user", content: texto });
    sendBtn.disabled = true;
    const t = texto.toLowerCase();
    const hayPlan = !!(window.SportHub && window.SportHub.getPlan && window.SportHub.getPlan());
    const esMod = hayPlan && /(cambi|modific|sustitu|qu[ií]t|a[ñn]ad|reemplaz|\bmete\b|\bsaca\b|ajusta)/.test(t);
    const esCrear = /(m[oó]ntame|\bmonta\b|gen[ée]rame|gen[ée]ra un|h[aá]zme un|dame un entren|prep[aá]rame|una rutina|entreno de favorit|formato generador|p[oó]nme un entren)/.test(t);
    const mode = esMod ? "modify" : (esCrear ? "create" : "auto");
    try {
      await ronda(0, mode, false);
    } catch (e) {
      burbuja("assistant", "⚠ No pude conectar con Claude. Revisa internet y la clave.", "coach");
    } finally {
      sendBtn.disabled = !getKey();
      input.focus();
    }
  }

  // ---------- wiring ----------
  sendBtn.addEventListener("click", () => enviar(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(input.value); });
  $$("#coach-quick .chip").forEach((ch) => ch.addEventListener("click", () => enviar(ch.dataset.q)));
  keySave.addEventListener("click", () => {
    const k = (keyInput.value || "").trim();
    if (!k) return;
    setKey(k); keyInput.value = "";
    sincronizarClave(k);
    burbuja("assistant", "¡Listo! Clave guardada (y respaldada en tu Airtable, así no te la vuelvo a pedir aunque borres). ¿Qué entrenamos hoy? 💪", "coach");
  });
  keyInput && keyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") keySave.click(); });
  clearKey.addEventListener("click", () => {
    if (getKey() && !confirm("¿Borrar la clave de este dispositivo?")) { keybar.classList.remove("hidden"); return; }
    setKey(""); sincronizarClave(""); keybar.classList.remove("hidden");
  });

  fab && fab.addEventListener("click", () => (drawer.classList.contains("open") ? cerrar() : abrir()));
  drawerClose && drawerClose.addEventListener("click", cerrar);

  // ---------- arranque ----------
  (async function () {
    await recuperarClave(); // trae la clave de Airtable si no está en este dispositivo (sobrevive a borrar caché)
    refrescar();
    if (getKey()) {
      burbuja("assistant", "Hola, Andrés 👋 Soy tu coach. Pídeme un entreno y te lo monto directamente en el Generador, o pregúntame lo que quieras: tu recuperación, tu evolución, cómo tienes hoy la espalda…", "coach");
    } else {
      keybar.classList.remove("hidden");
    }
  })();
})();
