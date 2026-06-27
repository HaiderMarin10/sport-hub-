/* Sport Hub — coach.js
   Chat con el coach IA. Habla con el backend local (coach_server.py) en /api/coach,
   que es quien llama a Claude con la clave guardada en el servidor (nunca en el navegador). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  if (!$("#coach-log")) return;

  const log = $("#coach-log"), input = $("#coach-text"), sendBtn = $("#coach-send"), note = $("#coach-note");
  const historial = [];   // [{role:"user"|"assistant", content}]

  function burbuja(role, texto, clase) {
    const div = document.createElement("div");
    div.className = "msg " + (clase || (role === "user" ? "user" : "coach"));
    div.textContent = texto;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  async function enviar(texto) {
    texto = (texto || "").trim();
    if (!texto) return;
    input.value = "";
    burbuja("user", texto);
    historial.push({ role: "user", content: texto });
    sendBtn.disabled = true;
    const typing = burbuja("assistant", "escribiendo…", "coach typing");

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historial }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (!res.ok || !data.reply) {
        const err = data.error || ("Error " + res.status);
        burbuja("assistant", "⚠ " + err, "coach");
      } else {
        burbuja("assistant", data.reply);
        historial.push({ role: "assistant", content: data.reply });
      }
    } catch (e) {
      typing.remove();
      burbuja("assistant",
        "⚠ No hay conexión con el coach. Arranca el servidor con tu API key:\n" +
        "python scripts/coach_server.py", "coach");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", () => enviar(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(input.value); });
  $$("#coach-quick .chip").forEach((ch) => ch.addEventListener("click", () => enviar(ch.dataset.q)));

  // pista inicial sobre cómo activarlo
  note.textContent = "El coach usa tu API key de Anthropic en el servidor local (coach_server.py). " +
    "Si responde con un aviso, añade ANTHROPIC_API_KEY en .env y arranca ese servidor.";
})();
