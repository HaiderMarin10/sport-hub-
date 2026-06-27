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
    "Eres el coach deportivo y de rehabilitación personal de Andrés Marín (35 años, banquero de M&A en Madrid). " +
    "Andrés está en rehabilitación de espalda: hernia L4-L5 recidivada con afectación radicular L5-S1; síntomas " +
    "frecuentes en gemelos y glúteos. Su objetivo a medio plazo es volver a Hyrox y triatlón, gestionando la espalda. " +
    "Su entrenador y fisio se llama Nacho; el repertorio de ejercicios de la app es de Nacho.\n\n" +
    "REPERTORIO DE NACHO (categoría: ejercicios):\n" + repertorio() + "\n\nREGLAS:\n" +
    "- Responde SIEMPRE en español, claro y conciso, con tono de coach cercano.\n" +
    "- Cuando Andrés te pida un entreno (montar, generar, 'en formato generador', 'output', 'pásalo al generador', o te pegue un entreno ya escrito para que lo cargues), " +
    "NUNCA lo escribas como tabla ni texto en el chat: SIEMPRE LLAMA a la herramienta `proponer_entreno` para que aparezca en su Generador " +
    "(editable, con series, para marcar como hecho). Usa nombres EXACTOS del repertorio de arriba. Tras llamarla, comenta en 1-2 frases qué le has montado y por qué.\n" +
    "- Para VER o MODIFICAR el entreno que ya tiene cargado, primero llama a `entreno_actual` para leerlo y luego `proponer_entreno` con la versión cambiada.\n" +
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
    if (!window.shAirtable || !window.shAirtable.hasToken()) return;
    try {
      const [sens, entr] = await Promise.all([
        window.shAirtable.list("sensaciones", { maxRecords: 7, sort: [{ field: "fecha", direction: "desc" }] }),
        window.shAirtable.list("entrenos", { maxRecords: 3, sort: [{ field: "fecha", direction: "desc" }] }),
      ]);
      if (!sens.length && !entr.length) { contextoReciente = ""; return; }
      const lines = sens.slice(0, 5).map((r) => {
        const f = r.fields, p = [];
        if (typeof f.espalda_mañana === "number") p.push("espalda AM " + f.espalda_mañana);
        if (typeof f.espalda_noche === "number") p.push("PM " + f.espalda_noche);
        if (typeof f.intensidad_gemelos === "number") p.push("gemelos/glúteo " + f.intensidad_gemelos);
        if (typeof f.energia_general === "number") p.push("energía " + f.energia_general);
        if (Array.isArray(f.dolor_localizado) && f.dolor_localizado.length) p.push("dolor: " + f.dolor_localizado.join("/"));
        return (f.fecha || "") + " → " + p.join(", ") + (f.nota_transcrita ? " — " + f.nota_transcrita : "");
      });
      const ent = entr.slice(0, 3).map((r) => (r.fields.fecha || "") + " " + (r.fields.tipo || "") + " (" + String(r.fields.ejercicios || "").slice(0, 70) + ")");
      contextoReciente = "DIARIO RECIENTE DE ANDRÉS (de su app; úsalo para personalizar consejos y vigilar su espalda L4-L5 / glúteos / gemelos. NO lo recites entero, intégralo con naturalidad):\n" +
        "Sensaciones:\n- " + lines.join("\n- ") + (ent.length ? "\nÚltimos entrenos:\n- " + ent.join("\n- ") : "");
    } catch (e) { /* sin contexto si falla */ }
  }

  // ---------- llamada a Claude (con bucle de tool use) ----------
  async function callClaude(toolChoice) {
    const system = [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }];
    if (contextoReciente) system.push({ type: "text", text: contextoReciente });
    const body = {
      model: MODEL,
      max_tokens: 1500,
      system: system,
      tools: [TOOL_ENTRENO, TOOL_VER],
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
      const results = tools.map((tu) => {
        let c = "hecho";
        if (tu.name === "proponer_entreno") c = cargarEntreno(tu.input);
        else if (tu.name === "entreno_actual") {
          const p = (window.SportHub && window.SportHub.getPlan) ? window.SportHub.getPlan() : null;
          c = p ? JSON.stringify(p) : "No hay ningún entreno cargado en el generador ahora mismo.";
        }
        return { type: "tool_result", tool_use_id: tu.id, content: c };
      });
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
    const esCrear = /(entren|m[oó]ntame|\bmonta\b|gen[ée]ra|rutina|formato|output|generador|p[oó]nme|dame un|prep[aá]rame)/.test(t);
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
    burbuja("assistant", "¡Listo! Clave guardada en este dispositivo. ¿Qué entrenamos hoy? 💪", "coach");
  });
  keyInput && keyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") keySave.click(); });
  clearKey.addEventListener("click", () => {
    if (getKey() && !confirm("¿Borrar la clave de este dispositivo?")) { keybar.classList.remove("hidden"); return; }
    setKey(""); keybar.classList.remove("hidden");
  });

  fab && fab.addEventListener("click", () => (drawer.classList.contains("open") ? cerrar() : abrir()));
  drawerClose && drawerClose.addEventListener("click", cerrar);

  // ---------- arranque ----------
  refrescar();
  if (getKey()) {
    burbuja("assistant", "Hola, Andrés 👋 Soy tu coach. Pídeme un entreno y te lo monto directamente en el Generador, listo para hacerlo. O pregúntame por un ejercicio, o cómo tienes hoy la espalda.", "coach");
  } else {
    keybar.classList.remove("hidden");
  }
})();
