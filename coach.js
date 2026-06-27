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
  const historial = [];

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
    "- Cuando Andrés te pida MONTAR o GENERAR un entreno, NO lo escribas como tabla de texto: " +
    "LLAMA a la herramienta `proponer_entreno` para que aparezca en su Generador (editable, con series y para marcar como hecho). " +
    "Usa nombres EXACTOS del repertorio de arriba. Tras llamarla, comenta brevemente qué le has montado y por qué.\n" +
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
      burbuja("assistant", "✅ Te lo he montado en el Generador (" + total + " ejercicios). Está en esa pestaña: puedes cambiar ejercicios, ajustar las series y marcarlo como hecho. 💪", "coach");
      return "Entreno cargado en el generador (" + total + " ejercicios). Coméntalo brevemente.";
    } catch (e) {
      return "Error al cargar el entreno: " + (e.message || e);
    }
  }

  // ---------- llamada a Claude (con bucle de tool use) ----------
  async function callClaude() {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": getKey(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [TOOL_ENTRENO],
        messages: historial,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function ronda(depth) {
    if (depth > 3) return;
    const typing = burbuja("assistant", "escribiendo…", "coach typing");
    const { ok, status, data } = await callClaude();
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
      const results = tools.map((tu) => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: tu.name === "proponer_entreno" ? cargarEntreno(tu.input) : "hecho",
      }));
      historial.push({ role: "user", content: results });
      await ronda(depth + 1); // que Claude cierre con un comentario
    }
  }

  async function enviar(texto) {
    texto = (texto || "").trim();
    if (!texto) return;
    if (!getKey()) { keybar.classList.remove("hidden"); keyInput.focus(); return; }
    input.value = "";
    burbuja("user", texto);
    historial.push({ role: "user", content: texto });
    sendBtn.disabled = true;
    try {
      await ronda(0);
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

  // ---------- arranque ----------
  refrescar();
  if (getKey()) {
    burbuja("assistant", "Hola, Andrés 👋 Soy tu coach. Pídeme un entreno y te lo monto directamente en el Generador, listo para hacerlo. O pregúntame por un ejercicio, o cómo tienes hoy la espalda.", "coach");
  } else {
    keybar.classList.remove("hidden");
  }
})();
