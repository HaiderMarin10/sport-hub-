/* Sport Hub — coach.js
   Chat con el coach IA. "Trae tu propia clave" (BYOK): la API key de Anthropic
   se guarda SOLO en este dispositivo (localStorage) y el navegador habla
   directamente con Claude. Sin servidor, sin cuentas extra. Funciona en el móvil. */
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

  // ---------- system prompt (con el repertorio de Nacho) ----------
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
    "Su entrenador y fisio se llama Nacho; el repertorio de ejercicios de la app es de Nacho. Cuando propongas entrenos, " +
    "usa preferentemente ejercicios de ese repertorio y respeta su espalda: evita por defecto carga axial alta e impacto " +
    "salvo que Andrés lo pida.\n\nREPERTORIO DE NACHO (categoría: ejercicios):\n" + repertorio() + "\n\nREGLAS:\n" +
    "- Responde SIEMPRE en español, claro y conciso, con tono de coach cercano que le conoce.\n" +
    "- Al montar un entreno, estructúralo en bloques con series × repeticiones.\n" +
    "- No eres médico: ante dolor agudo o señales neurológicas nuevas, recomiéndale ver a Nacho o a su médico.\n" +
    "- No inventes datos. Si falta información, pregunta.";

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

  // ---------- enviar a Claude (directo, BYOK) ----------
  async function enviar(texto) {
    texto = (texto || "").trim();
    if (!texto) return;
    const key = getKey();
    if (!key) { keybar.classList.remove("hidden"); keyInput.focus(); return; }
    input.value = "";
    burbuja("user", texto);
    historial.push({ role: "user", content: texto });
    sendBtn.disabled = true;
    const typing = burbuja("assistant", "escribiendo…", "coach typing");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: historial,
        }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (!res.ok) {
        const m = (data.error && data.error.message) || ("Error " + res.status);
        burbuja("assistant", "⚠ " + m + (res.status === 401 ? " — revisa tu API key." : ""), "coach");
        if (res.status === 401) keybar.classList.remove("hidden");
      } else {
        const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
        burbuja("assistant", reply || "(sin respuesta)");
        historial.push({ role: "assistant", content: reply });
      }
    } catch (e) {
      typing.remove();
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
    setKey("");
    keybar.classList.remove("hidden");
  });

  // ---------- arranque ----------
  refrescar();
  if (getKey()) {
    burbuja("assistant", "Hola, Andrés 👋 Soy tu coach. Pídeme un entreno, que te explique un ejercicio, o dime cómo tienes hoy la espalda.", "coach");
  } else {
    keybar.classList.remove("hidden");
  }
})();
