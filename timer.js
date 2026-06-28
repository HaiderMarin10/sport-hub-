/* Sport Hub — timer.js
   Timer flotante: Cronómetro · Cuenta atrás (AMRAP) · EMOM · Tabata. Pitidos con Web Audio.
   Con tiempos PERSONALIZABLES (min/seg) además de los presets. Módulo aparte. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  if (!$("#timer-display")) return;

  let actx;
  function beep(freq, dur) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
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
  let mode = "cron", running = false, id = null, st = null;
  let dur = { down: 12 * 60, emom: 12 * 60 };   // segundos totales (cuenta atrás / EMOM)
  let tab = { rounds: 8, work: 20, rest: 10 };   // tabata configurable

  const disp = $("#timer-display"), label = $("#timer-label"), startBtn = $("#timer-start");

  function stop() { running = false; if (id) { clearInterval(id); id = null; } startBtn.textContent = "Empezar"; }

  function reset() {
    stop();
    if (mode === "cron") st = { elapsed: 0 };
    else if (mode === "down") st = { remaining: dur.down, total: dur.down };
    else if (mode === "emom") st = { remaining: dur.emom, total: dur.emom };
    else st = { round: 1, rounds: tab.rounds, phase: "work", left: tab.work };
    render();
  }

  function render() {
    disp.classList.remove("work", "rest");
    if (mode === "cron") { disp.textContent = fmt(st.elapsed); label.textContent = "Cronómetro"; }
    else if (mode === "down") { disp.textContent = fmt(st.remaining); label.textContent = st.remaining <= 0 ? "¡Tiempo!" : "AMRAP · quedan"; }
    else if (mode === "emom") {
      const mins = Math.round(st.total / 60);
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
        if (st.phase === "work" && tab.rest > 0) { st.phase = "rest"; st.left = tab.rest; beep(600, 0.22); }
        else {
          st.round++;
          if (st.round > st.rounds) { beepEnd(); stop(); }
          else { st.phase = "work"; st.left = tab.work; beep(990, 0.22); }
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
      const active = (mode === "tabata") ? (tab.rounds === v) : (dur[mode] === v * 60);
      b.className = "chip" + (active ? " on" : "");
      b.textContent = v + " " + UNIT[mode];
      b.addEventListener("click", () => {
        if (mode === "tabata") tab.rounds = v; else dur[mode] = v * 60;
        renderPresets(); renderCustom(); reset();
      });
      box.appendChild(b);
    });
  }

  function lbl(t) { const s = document.createElement("span"); s.className = "timer-cust-lab"; s.textContent = t; return s; }
  function num(val, mn, mx, w) {
    const i = document.createElement("input");
    i.type = "number"; i.value = val; i.min = mn; i.max = mx; i.inputMode = "numeric";
    i.className = "timer-num"; if (w) i.style.width = w + "px";
    i.addEventListener("focus", () => i.select());
    return i;
  }

  function renderCustom() {
    const box = $("#timer-custom"); if (!box) return;
    box.innerHTML = "";
    if (mode === "cron") { box.style.display = "none"; return; }
    box.style.display = "flex";
    box.appendChild(lbl("A medida:"));
    if (mode === "down") {
      const mi = num(Math.floor(dur.down / 60), 0, 180), si = num(dur.down % 60, 0, 59);
      const apply = () => {
        const m = Math.max(0, parseInt(mi.value, 10) || 0), s = Math.min(59, Math.max(0, parseInt(si.value, 10) || 0));
        dur.down = Math.max(5, m * 60 + s); renderPresets(); reset();
      };
      mi.addEventListener("change", apply); si.addEventListener("change", apply);
      box.appendChild(mi); box.appendChild(lbl("min")); box.appendChild(si); box.appendChild(lbl("seg"));
    } else if (mode === "emom") {
      const mi = num(Math.round(dur.emom / 60), 1, 90);
      mi.addEventListener("change", () => { dur.emom = Math.max(1, parseInt(mi.value, 10) || 1) * 60; renderPresets(); reset(); });
      box.appendChild(mi); box.appendChild(lbl("min"));
    } else {
      const ri = num(tab.rounds, 1, 30), wi = num(tab.work, 5, 600, 52), di = num(tab.rest, 0, 600, 52);
      ri.addEventListener("change", () => { tab.rounds = Math.max(1, parseInt(ri.value, 10) || 1); renderPresets(); reset(); });
      wi.addEventListener("change", () => { tab.work = Math.max(5, parseInt(wi.value, 10) || 20); reset(); });
      di.addEventListener("change", () => { tab.rest = Math.max(0, parseInt(di.value, 10) || 10); reset(); });
      box.appendChild(lbl("rondas")); box.appendChild(ri);
      box.appendChild(lbl("· trabajo")); box.appendChild(wi); box.appendChild(lbl("s"));
      box.appendChild(lbl("· descanso")); box.appendChild(di); box.appendChild(lbl("s"));
    }
  }

  $$("#timer-mode .chip").forEach((ch) => ch.addEventListener("click", () => {
    $$("#timer-mode .chip").forEach((c) => c.classList.remove("on"));
    ch.classList.add("on");
    mode = ch.dataset.m; renderPresets(); renderCustom(); reset();
  }));
  startBtn.addEventListener("click", start);
  $("#timer-reset").addEventListener("click", reset);
  $("#timer-fab").addEventListener("click", () => $("#timer").classList.remove("hidden"));
  $("#timer-close").addEventListener("click", () => $("#timer").classList.add("hidden"));
  $("#timer").addEventListener("click", (e) => { if (e.target.id === "timer") $("#timer").classList.add("hidden"); });

  renderPresets();
  renderCustom();
  reset();
})();
