/* Sport Hub — crossfit.js
   Módulo APARTE: generador de WODs estilo CrossFit/HIIT + repertorio de movimientos.
   La conmutación de pestañas la gestiona app.js (genérico por .tab/.view). */
(function () {
  "use strict";

  const M = (window.WODMOVES || []).slice();
  if (!M.length) return;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const yt = (n) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(n + " crossfit movement");
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  const RIESGO_LBL = { bajo: "espalda OK", medio: "precaución", alto: "alto riesgo" };

  // hero WOD: imágenes Hyrox sled (B/N vía CSS), rotando con fundido cruzado.
  const WOD_IMGS = [
    "https://images.unsplash.com/photo-1743993414654-0be2b73a9620?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1780398455381-c7c02b7727ec?auto=format&fit=crop&w=1400&q=80",
  ];
  const GRADW = "linear-gradient(180deg,rgba(10,10,11,.12) 0%,rgba(10,10,11,.5) 52%,rgba(10,10,11,.96) 100%)";
  (function slideshowWod() {
    const el = $("#hero-bg-wod");
    if (!el) return;
    WOD_IMGS.forEach((s) => { const im = new Image(); im.src = s; });
    let i = 0;
    const set = (idx) => { el.style.backgroundImage = GRADW + ", url('" + WOD_IMGS[idx] + "')"; };
    set(0);
    if (WOD_IMGS.length < 2) return;
    setInterval(() => {
      el.classList.add("hb-fade");
      setTimeout(() => { i = (i + 1) % WOD_IMGS.length; set(i); el.classList.remove("hb-fade"); }, 900);
    }, 7000);
  })();

  // ---------- reps por movimiento ----------
  function reps(m) {
    if (m.c === "Cardio") {
      if (/Run|Shuttle/.test(m.n)) return pickOne([200, 400]) + " m";
      if (/Unders/.test(m.n)) return pickOne([30, 40, 50]);
      return pickOne([12, 15, 20]) + " cal";
    }
    if (m.c === "Core") return pickOne([15, 20, 25]);
    if (m.c === "Levantamiento") return pickOne([5, 8, 10, 12]);
    if (/Handstand Push|Muscle-up|Rope Climb/.test(m.n)) return pickOne([3, 5, 8]);
    return pickOne([8, 10, 12, 15]);
  }

  // selección con variedad de categorías (no más de la mitad de la misma)
  function pickMoves(safe, k) {
    const p = shuffle(M.filter(m => !safe || m.r !== "alto"));
    const out = [], cuenta = {};
    for (const m of p) {
      if (out.length >= k) break;
      if ((cuenta[m.c] || 0) >= Math.ceil(k / 2)) continue;
      cuenta[m.c] = (cuenta[m.c] || 0) + 1;
      out.push(m);
    }
    while (out.length < k && p.length) { const m = p.pop(); if (!out.includes(m)) out.push(m); }
    return out;
  }

  // ---------- construir WOD ----------
  function buildWOD(format, safe) {
    const fmt = format || pickOne(["AMRAP", "EMOM", "RFT", "FORTIME", "TABATA", "CHIPPER"]);
    let titulo = "", desc = "", lineas = [], nota = "Rx / Scaled — ajusta carga y repeticiones a tu nivel.";

    if (fmt === "AMRAP") {
      const dur = pickOne([10, 12, 15, 20]);
      const ms = pickMoves(safe, 3);
      titulo = "AMRAP " + dur + "'";
      desc = "Tantas rondas como puedas en " + dur + " minutos";
      lineas = ms.map(m => ({ rep: reps(m), n: m.n, r: m.r }));
    } else if (fmt === "EMOM") {
      const dur = pickOne([10, 12, 16, 20]);
      const ms = pickMoves(safe, pickOne([2, 3]));
      titulo = "EMOM " + dur + "'";
      desc = "Cada minuto, en rotación:";
      lineas = ms.map((m, i) => ({ rep: "Min " + (i + 1) + " · " + reps(m), n: m.n, r: m.r }));
    } else if (fmt === "RFT") {
      const rounds = pickOne([3, 4, 5]);
      const ms = pickMoves(safe, 3);
      titulo = rounds + " RFT";
      desc = rounds + " rondas por tiempo";
      lineas = ms.map(m => ({ rep: reps(m), n: m.n, r: m.r }));
    } else if (fmt === "FORTIME") {
      const scheme = pickOne(["21-15-9", "15-12-9", "27-21-15"]);
      const ms = pickMoves(safe, 2);
      titulo = scheme;
      desc = "Repeticiones " + scheme + " por tiempo de:";
      lineas = ms.map(m => ({ rep: "", n: m.n, r: m.r }));
    } else if (fmt === "TABATA") {
      const ms = pickMoves(safe, pickOne([1, 2]));
      titulo = "TABATA";
      desc = "8 rondas · 20 s trabajo / 10 s descanso";
      lineas = ms.map(m => ({ rep: "máx reps", n: m.n, r: m.r }));
    } else { // CHIPPER
      const ms = pickMoves(safe, pickOne([4, 5]));
      titulo = "CHIPPER";
      desc = "Una vuelta, por tiempo:";
      lineas = ms.map(m => ({ rep: (m.c === "Cardio" ? reps(m) : pickOne([20, 30, 40])), n: m.n, r: m.r }));
    }
    return { titulo, desc, lineas, nota };
  }

  // ---------- HYROX ----------
  // Estaciones oficiales (referencia para el Mock; las 8 también están en el repertorio).
  const HYROX = [
    { n: "SkiErg", rep: "1000 m", half: "500 m", r: "bajo" },
    { n: "Sled Push", rep: "50 m", half: "25 m", r: "medio" },
    { n: "Sled Pull", rep: "50 m", half: "25 m", r: "medio" },
    { n: "Burpee Broad Jump", rep: "80 m", half: "40 m", r: "alto" },
    { n: "Rowing", rep: "1000 m", half: "500 m", r: "bajo" },
    { n: "Farmers Carry", rep: "200 m", half: "100 m", r: "medio" },
    { n: "Sandbag Lunges", rep: "100 m", half: "50 m", r: "alto" },
    { n: "Wall Balls", rep: "100 reps", half: "50 reps", r: "medio" },
  ];

  // Pool de PREPARACIÓN para Hyrox (lo que se entrena para preparar, no la competición literal).
  const PREP_FUERZA = [
    { n: "Goblet Squat", rep: "4 × 10", r: "bajo" },
    { n: "Romanian Deadlift", rep: "4 × 8", r: "medio" },
    { n: "Walking Lunge", rep: "4 × 20 pasos", r: "bajo" },
    { n: "Box Step-up", rep: "4 × 12 / pierna", r: "bajo" },
    { n: "Kettlebell Swing", rep: "4 × 15", r: "medio" },
    { n: "Front Rack Lunge", rep: "4 × 10 / pierna", r: "medio" },
    { n: "Dumbbell Thruster", rep: "4 × 12", r: "medio" },
  ];
  const PREP_COND = [
    { n: "Wall Balls", rep: "15", r: "medio" }, { n: "Burpees", rep: "10", r: "medio" },
    { n: "Farmers Carry", rep: "40 m", r: "medio" }, { n: "Sled Push", rep: "20 m", r: "medio" },
    { n: "Walking Lunge", rep: "20 m", r: "bajo" }, { n: "Kettlebell Swing", rep: "20", r: "medio" },
    { n: "Sandbag Lunges", rep: "20 m", r: "alto" }, { n: "Box Step-up", rep: "20", r: "bajo" },
  ];
  const PREP_RUN = [
    { n: "Run", rep: "400 m" }, { n: "Run", rep: "600 m" }, { n: "Run", rep: "800 m" },
    { n: "Row", rep: "500 m" }, { n: "Ski Erg", rep: "500 m" }, { n: "Echo Bike", rep: "15 cal" },
  ];
  const PREP_CORE = [
    { n: "Plank Hold", rep: "45 s" }, { n: "Hollow Hold", rep: "40 s" },
    { n: "Russian Twist", rep: "30" }, { n: "Flutter Kicks", rep: "40" },
  ];

  // ENTRENO Hyrox: sesión de preparación original (fuerza específica + carrera comprometida).
  function buildHyroxTraining(safe) {
    const fpool = safe ? PREP_FUERZA.filter(x => x.r !== "alto") : PREP_FUERZA;
    const cpool = safe ? PREP_COND.filter(x => x.r !== "alto") : PREP_COND;
    const fuerza = shuffle(fpool.slice()).slice(0, 2);
    const cond = shuffle(cpool.slice()).slice(0, 2);
    const run = pickOne(PREP_RUN), core = pickOne(PREP_CORE), rondas = pickOne([4, 5, 6]);
    const lineas = [
      { head: "Calentamiento · 8-10'" },
      { rep: "10'", n: "400 m row + movilidad cadera/tobillo + 2×(10 air squats · 10 swings ligeros)", r: "bajo" },
      { head: "Fuerza específica" },
    ];
    fuerza.forEach(f => lineas.push({ rep: f.rep, n: f.n, r: f.r }));
    lineas.push({ head: "Acondicionamiento · " + rondas + " rondas (carrera comprometida)" });
    lineas.push({ rep: run.rep, n: run.n, r: "bajo" });
    cond.forEach(c => lineas.push({ rep: c.rep, n: c.n, r: c.r }));
    lineas.push({ head: "Finisher core · 3 rondas" });
    lineas.push({ rep: core.rep, n: core.n, r: "bajo" });
    return {
      titulo: "HYROX · ENTRENO", desc: "Preparación tipo Hyrox · original, no la competición",
      lineas,
      nota: "Sesión de prep: fuerza específica + carrera comprometida. Escala cargas/distancias a tu nivel y a tu espalda.",
    };
  }

  // MOCK Hyrox: réplica corta y adaptable de la competición.
  function buildHyroxMock(safe) {
    let sts = HYROX.filter(s => !safe || s.r !== "alto");
    sts = shuffle(sts.slice()).slice(0, 4).sort((a, b) => HYROX.indexOf(a) - HYROX.indexOf(b));
    const lineas = [{ head: "Mini HYROX · réplica corta (adáptala)" }];
    sts.forEach(st => {
      lineas.push({ rep: "500 m", n: "Run", r: "bajo" });
      lineas.push({ rep: st.half, n: st.n, r: st.r });
    });
    return {
      titulo: "HYROX · MOCK", desc: "Réplica corta · 4 estaciones a media distancia",
      lineas,
      nota: "Versión corta y adaptable: sube/baja rondas, distancia y peso a tu nivel. La competición real es 8×(1 km + estación).",
    };
  }

  // ---------- pintar el WOD (pizarra) ----------
  let formato = "";
  function renderBoard(w, scroll) {
    const board = $("#wod-board");
    board.innerHTML =
      '<div class="wod-tag">WOD</div>' +
      '<div class="wod-format">' + esc(w.titulo) + '</div>' +
      '<div class="wod-desc">' + esc(w.desc) + '</div>' +
      '<ul class="wod-moves">' +
      w.lineas.map(l =>
        l.head
          ? '<li class="wod-head">' + esc(l.head) + '</li>'
          : '<li>' + (l.rep ? '<span class="reps">' + esc(String(l.rep)) + '</span>' : "") +
            '<span class="mv">' + esc(l.n) + '</span>' +
            (l.r === "alto" ? '<span class="wod-flag">espalda ⚠</span>' : "") + '</li>'
      ).join("") +
      '</ul>' +
      '<div class="wod-note">' + esc(w.nota) + '</div>';
    $("#wod-result").classList.remove("hidden");
    if (scroll) $("#wod-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function pintarWOD() {
    const safe = $("#wod-safe").checked;
    const w = formato === "HYROXT" ? buildHyroxTraining(safe)
      : formato === "HYROXM" ? buildHyroxMock(safe)
      : buildWOD(formato, safe);
    try { localStorage.setItem("sh_wod", JSON.stringify(w)); } catch (e) {}
    renderBoard(w, true);
  }
  // restaurar el último WOD generado
  (function () { try { const v = localStorage.getItem("sh_wod"); if (v) renderBoard(JSON.parse(v), false); } catch (e) {} })();

  $$("#wod-format .chip").forEach(ch => ch.addEventListener("click", () => {
    $$("#wod-format .chip").forEach(c => c.classList.remove("on"));
    ch.classList.add("on");
    formato = ch.dataset.f;
  }));
  $("#wod-generate").addEventListener("click", pintarWOD);
  $("#wod-regen").addEventListener("click", pintarWOD);

  // ---------- repertorio de movimientos ----------
  const cats = Array.from(new Set(M.map(m => m.c)));
  let filtroCat = "";
  const catBox = $("#wod-cat");
  catBox.innerHTML = '<button class="chip on" data-c="">Todos · ' + M.length + '</button>' +
    cats.map(c => '<button class="chip" data-c="' + c + '">' + c + " · " + M.filter(m => m.c === c).length + '</button>').join("");
  $$("#wod-cat .chip").forEach(ch => ch.addEventListener("click", () => {
    $$("#wod-cat .chip").forEach(c => c.classList.remove("on"));
    ch.classList.add("on");
    filtroCat = ch.dataset.c;
    pintarLista();
  }));
  $("#wod-search").addEventListener("input", pintarLista);

  function pintarLista() {
    const q = $("#wod-search").value.trim().toLowerCase();
    const list = M.filter(m =>
      (!filtroCat || m.c === filtroCat) &&
      (!q || m.n.toLowerCase().includes(q) || m.d.toLowerCase().includes(q))
    ).sort((a, b) => a.n.localeCompare(b.n, "es"));
    $("#wod-count").textContent = list.length + " de " + M.length + " movimientos";
    const cont = $("#wod-list");
    cont.innerHTML = "";
    if (!list.length) { cont.innerHTML = '<p class="muted">Sin resultados.</p>'; return; }
    const frag = document.createDocumentFragment();
    list.forEach(m => {
      const div = document.createElement("div");
      div.className = "ex";
      div.innerHTML =
        '<div class="body">' +
          '<div class="name">' + esc(m.n) + '</div>' +
          '<div class="desc">' + esc(m.d) + '</div>' +
          '<div class="meta">' +
            '<span class="badge b-cat">' + esc(m.c) + '</span>' +
            '<span class="risk r-' + m.r + '"><i></i>' + RIESGO_LBL[m.r] + '</span>' +
            '<a class="yt" href="' + yt(m.n) + '" target="_blank" rel="noopener">Vídeo</a>' +
          '</div>' +
        '</div>';
      frag.appendChild(div);
    });
    cont.appendChild(frag);
  }
  pintarLista();
})();
