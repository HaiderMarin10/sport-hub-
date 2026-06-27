/* Sport Hub — timer.js
   Timer flotante: Cronómetro · Cuenta atrás (AMRAP) · EMOM · Tabata. Pitidos con Web Audio.
   Módulo aparte; no toca nada del generador. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  if (!$("#timer-display")) return;

  let actx;
  function beep(freq, dur) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = freq || 880; g.gain.value = 0.18;
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.15));
    } catch (e) {}
  }
  function beepEnd() { beep(660, 0.18); setTimeout(() => beep(660, 0.18), 200); setTimeout(() => beep(990, 0.45), 420); }
  const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), x = s % 60; return (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x; };

  const PRESETS = { cron: [], down: [5, 10, 12, 15, 20], emom: [10, 12, 16, 20], tabata: [6, 8, 10] };
  const UNIT = { down: "min", emom: "min", tabata: "rondas" };
  let mode = "cron", running = false, id = null, sel = { down: 12, emom: 12, tabata: 8 }, st = null;

  const disp = $("#timer-display"), label = $("#timer-label"), startBtn = $("#timer-start");

  function stop() { running = false; if (id) { clearInterval(id); id = null; } startBtn.textContent = "Empezar"; }

  function reset() {
    stop();
    if (mode === "cron") st = { elapsed: 0 };
    else if (mode === "down") st = { remaining: sel.down * 60, total: sel.down * 60 };
    else if (mode === "emom") st = { remaining: sel.emom * 60, total: sel.emom * 60 };
    else st = { round: 1, rounds: sel.tabata, phase: "work", left: 20 };
    render();
  }

  function render() {
    disp.classList.remove("work", "rest");
    if (mode === "cron") { disp.textContent = fmt(st.elapsed); label.textContent = "Cronómetro"; }
    else if (mode === "down") { disp.textContent = fmt(st.remaining); label.textContent = st.remaining <= 0 ? "¡Tiempo!" : "AMRAP · quedan"; }
    else if (mode === "emom") {
      const mins = st.total / 60;
      const min = Math.min(Math.floor((st.total - st.remaining) / 60) + 1, mins);
      const secInMin = st.remaining <= 0 ? 0 : (((st.remaining - 1) % 60) + 1);
      disp.textContent = fmt(secInMin);
      label.textContent = st.remaining <= 0 ? "¡Hecho!" : ("EMOM · Min " + min + "/" + mins);
    } else {
      disp.textContent = fmt(st.left);
      disp.classList.add(st.phase === "work" ? "work" : "rest");
      label.textContent = st.round > st.rounds ? "¡Hecho!" :
        ("Tabata · R" + st.round + "/" + st.rounds + " · " + (st.phase === "work" ? "TRABAJO" : "DESCANSO"));
    }
  }

  function tick() {
    if (mode === "cron") { st.elapsed++; }
    else if (mode === "down") {
      st.remaining--;
      if (st.remaining > 0 && st.remaining <= 3) beep(880, 0.1);
      if (st.remaining <= 0) { beepEnd(); stop(); }
    } else if (mode === "emom") {
      st.remaining--;
      if (st.remaining > 0 && (st.total - st.remaining) % 60 === 0) beep(880, 0.15);
      if (st.remaining <= 0) { beepEnd(); stop(); }
    } else {
      st.left--;
      if (st.left > 0 && st.left <= 3) beep(880, 0.1);
      if (st.left <= 0) {
        if (st.phase === "work") { st.phase = "rest"; st.left = 10; beep(600, 0.22); }
        else {
          st.round++;
          if (st.round > st.rounds) { beepEnd(); stop(); }
          else { st.phase = "work"; st.left = 20; beep(990, 0.22); }
        }
      }
    }
    render();
  }

  function start() {
    if (running) { stop(); return; }
    if (!st) reset();
    if ((mode === "down" || mode === "emom") && st.remaining <= 0) reset();
    if (mode === "tabata" && st.round > st.rounds) reset();
    running = true; startBtn.textContent = "Pausa";
    if (mode === "tabata") beep(990, 0.2); else if (mode === "emom") beep(880, 0.15);
    id = setInterval(tick, 1000);
  }

  function renderPresets() {
    const box = $("#timer-presets"); box.innerHTML = "";
    const list = PRESETS[mode];
    if (!list.length) { box.style.display = "none"; return; }
    box.style.display = "flex";
    list.forEach((v) => {
      const b = document.createElement("button");
      b.className = "chip" + (sel[mode] === v ? " on" : "");
      b.textContent = v + " " + UNIT[mode];
      b.addEventListener("click", () => { sel[mode] = v; renderPresets(); reset(); });
      box.appendChild(b);
    });
  }

  $$("#timer-mode .chip").forEach((ch) => ch.addEventListener("click", () => {
    $$("#timer-mode .chip").forEach((c) => c.classList.remove("on"));
    ch.classList.add("on");
    mode = ch.dataset.m; renderPresets(); reset();
  }));
  startBtn.addEventListener("click", start);
  $("#timer-reset").addEventListener("click", reset);
  $("#timer-fab").addEventListener("click", () => $("#timer").classList.remove("hidden"));
  $("#timer-close").addEventListener("click", () => $("#timer").classList.add("hidden"));
  $("#timer").addEventListener("click", (e) => { if (e.target.id === "timer") $("#timer").classList.add("hidden"); });

  renderPresets();
  reset();
})();
