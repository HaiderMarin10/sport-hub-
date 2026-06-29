/* Sport Hub — app.js
   Generador editable de entrenos + repositorio agrupado + log a Airtable.
   Vanilla JS, sin dependencias. */
(function () {
  "use strict";

  const EX = (window.EJERCICIOS || []).slice();
  const CFG = window.SPORTHUB_CONFIG || null;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const yt = (n) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(n + " ejercicio técnica");
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (arr, k) => shuffle(arr.slice()).slice(0, k);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  // ---------- favoritos (en este dispositivo; los lee también el coach) ----------
  const FAVS = {
    K: "sh_favs",
    _ids: {}, // nombre -> id de registro Airtable (para borrarlo al desmarcar)
    list() { return LS.get(this.K, []); },
    has(n) { return this.list().indexOf(n) !== -1; },
    _set(a) { LS.set(this.K, a); },
    toggle(n) {
      const a = this.list(), i = a.indexOf(n), add = (i === -1);
      if (add) a.push(n); else a.splice(i, 1);
      this._set(a);
      this._sync(n, add); // espejo en Airtable (no bloquea)
      return add;
    },
    async _sync(n, add) {
      const AT = window.shAirtable;
      if (!AT || !AT.hasToken()) return;
      try {
        if (add) { const rec = await AT.create("favoritos", { ejercicio: n }); if (rec) this._ids[n] = rec.id; }
        else {
          let id = this._ids[n];
          if (!id) { const recs = await AT.list("favoritos"); const r = recs.find((x) => x.fields.ejercicio === n); id = r && r.id; }
          if (id) { await AT.del("favoritos", id); delete this._ids[n]; }
        }
      } catch (e) {}
    },
    async pull() { // cargar favoritos desde Airtable (sobreviven al borrado de caché)
      const AT = window.shAirtable;
      if (!AT || !AT.hasToken()) return false;
      try {
        const recs = await AT.list("favoritos");
        this._ids = {};
        const remote = [];
        recs.forEach((r) => { const n = r.fields.ejercicio; if (n) { remote.push(n); this._ids[n] = r.id; } });
        this._set(Array.from(new Set(this.list().concat(remote))));
        return true;
      } catch (e) { return false; }
    },
  };
  window.SportHubFavs = FAVS;
  function savePlan() {
    LS.set("sh_plan", { plan, durMode, durMin, nMov, nFue, notas: ($("#entreno-notas") || {}).value || "" });
  }

  const RIESGO_LBL = { bajo: "espalda OK", medio: "precaución", alto: "alto riesgo" };
  const BLOQUE_LBL = { movilidad: "Movilidad", activacion: "Activación", fuerza: "Fuerza", estabilidad: "Estabilidad", core: "Core", potencia: "Potencia" };

  // ---------- heros motivadores (fotos verificadas) ----------
  // Para usar tus propias fotos: define SPORTHUB_CONFIG.hero_imgs = ["url1","url2"] en config.js.
  const GRAD = "linear-gradient(180deg,rgba(10,10,11,.12) 0%,rgba(10,10,11,.5) 52%,rgba(10,10,11,.96) 100%)";
  // Generador: fotos que van rotando con fundido. Para meter las TUYAS (p.ej. Wawrinka),
  // añade sus URLs aquí o define SPORTHUB_CONFIG.hero_imgs = ["url1","url2"] en config.js.
  const HERO_IMGS = (CFG && CFG.hero_imgs && CFG.hero_imgs.length) ? CFG.hero_imgs : [
    "https://images.unsplash.com/photo-1576858574144-9ae1ebcf5ae5?auto=format&fit=crop&w=1400&q=80", // triatletas (bici)
    "img/Stan%20Wawrinka.jpg",
    "https://images.unsplash.com/photo-1780398455381-c7c02b7727ec?auto=format&fit=crop&w=1400&q=80", // Hyrox (temporal; cambiar a img/hyrox.jpg cuando Andrés suba su foto Pulse LED)
    "img/Rafa%20Nadal.png",
  ];
  const REPO_IMGS = [
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1400&q=80",
  ];
  function setLayer(el, img) { if (el) el.style.backgroundImage = GRAD + ", url('" + img + "')"; }
  function slideshow(el, imgs, ms) {
    if (!el || !imgs.length) return;
    imgs.forEach((s) => { const im = new Image(); im.src = s; });
    let i = 0;
    setLayer(el, imgs[0]);
    if (imgs.length < 2) return;
    setInterval(() => {
      el.classList.add("hb-fade");
      setTimeout(() => { i = (i + 1) % imgs.length; setLayer(el, imgs[i]); el.classList.remove("hb-fade"); }, 900);
    }, ms || 6500);
  }

  // ---------- pestañas (con sub-pestañas en Generator: gen=Strength&Mobility, wod=WODs&Hyrox) ----------
  const SUBVIEWS = ["gen", "wod"];
  let lastSub = "gen";
  function showView(id) {
    $$(".view").forEach(v => v.classList.remove("active"));
    const el = $("#" + id); if (el) el.classList.add("active");
    const inGen = SUBVIEWS.indexOf(id) !== -1;
    const sub = $("#gen-subtabs"); if (sub) sub.style.display = inGen ? "" : "none";
    $$(".tab").forEach(t => t.classList.remove("active"));
    const mt = document.querySelector('.tab[data-view="' + (inGen ? "gen" : id) + '"]');
    if (mt) mt.classList.add("active");
    if (inGen) {
      lastSub = id;
      $$("#gen-subtabs .subtab").forEach(s => s.classList.toggle("active", s.dataset.sub === id));
    }
  }
  window.shShowView = showView;
  $$(".tab").forEach(tab => tab.addEventListener("click", () => {
    const v = tab.dataset.view;
    showView(v === "gen" ? lastSub : v);
  }));
  $$("#gen-subtabs .subtab").forEach(st => st.addEventListener("click", () => showView(st.dataset.sub)));
  showView("inicio");

  // ---------- duración ----------
  const N = { 60: 4, 90: 6, 120: 8 };
  let durMode = "preset", durMin = 60, nMov = 4, nFue = 4;

  $$("#dur button").forEach(b => b.addEventListener("click", () => {
    $$("#dur button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    if (b.dataset.min === "custom") {
      durMode = "custom";
      $("#custom-panel").classList.remove("hidden");
    } else {
      durMode = "preset";
      durMin = parseInt(b.dataset.min, 10);
      $("#custom-panel").classList.add("hidden");
    }
  }));

  $$("#custom-panel .stepper button").forEach(b => b.addEventListener("click", () => {
    const d = parseInt(b.dataset.d, 10);
    if (b.dataset.t === "mov") { nMov = clamp(nMov + d, 1, 12); $("#n-mov").textContent = nMov; }
    else { nFue = clamp(nFue + d, 1, 12); $("#n-fue").textContent = nFue; }
  }));

  function counts() {
    if (durMode === "custom") return [nMov, nFue];
    const n = N[durMin] || 4;
    return [n, n];
  }

  // ---------- generador ----------
  function pool(blks, safe) {
    return EX.filter(e => blks.indexOf(e.b) !== -1 && (!safe || e.r !== "alto"));
  }

  // estructura de bloques según el modo (completo / simple)
  function estructura() {
    return $("#four").checked ? [
      ["Movilidad dinámica", ["movilidad"]],
      ["Activación glúteo / core", ["activacion"]],
      ["Fuerza específica", ["fuerza"]],
      ["Estabilidad / unilateral", ["estabilidad"]],
      ["Core", ["core"]],
    ] : [
      ["Movilidad dinámica", ["movilidad"]],
      ["Fuerza + estabilidad", ["fuerza", "estabilidad"]],
    ];
  }

  function generar() {
    const safe = $("#safe").checked;
    const [cmov, cfue] = counts();
    const mitad = Math.max(2, Math.round(cfue / 2));
    const tam = $("#four").checked ? [cmov, mitad, cfue, mitad, mitad] : [cmov, cfue];
    const est = estructura();
    const usados = new Set();
    return est.map(([titulo, blks], i) => {
      const disp = pool(blks, safe).filter(e => !usados.has(e.n));
      const elegidos = sample(disp, Math.min(tam[i], disp.length));
      elegidos.forEach(e => usados.add(e.n));
      return { titulo, blks, ejercicios: elegidos.map(e => ({ e, serie: repsPara(blks[0]) })) };
    });
  }

  function repsPara(b) {
    if (b === "movilidad") return "2 × 10 / lado";
    if (b === "activacion") return "3 × 12-15";
    if (b === "fuerza") return "4 × 8-12";
    if (b === "estabilidad") return "3 × 8 / lado";
    if (b === "core") return "3 × 40 s";
    return "3 × 10";
  }

  // ---------- estado del entreno (editable) ----------
  let plan = null;
  const usedNames = () => new Set(plan.flatMap(g => g.ejercicios.map(s => s.e.n)));

  function render() {
    const cont = $("#blocks");
    cont.innerHTML = "";
    let total = 0;
    plan.forEach((g, bi) => {
      const h = document.createElement("div");
      h.className = "block-title";
      h.innerHTML = '<span class="dot"></span>' + esc(g.titulo) +
        '<button class="block-add" data-add="' + bi + '">+ Añadir</button>';
      cont.appendChild(h);
      g.ejercicios.forEach((s, ei) => {
        total++;
        const e = s.e;
        const div = document.createElement("div");
        div.className = "ex" + (s.done ? " done" : "");
        div.innerHTML =
          '<button class="num check" data-done="' + bi + '.' + ei + '">' + (s.done ? "✓" : total) + '</button>' +
          '<div class="body">' +
            '<div class="name">' + esc(e.n) + '</div>' +
            '<div class="desc">' + esc(e.d) + '</div>' +
            '<div class="meta">' +
              '<span class="badge b-cat">' + esc(e.c) + '</span>' +
              '<span class="risk r-' + e.r + '"><i></i>' + RIESGO_LBL[e.r] + '</span>' +
              '<a class="yt" href="' + yt(e.n) + '" target="_blank" rel="noopener">Vídeo</a>' +
            '</div>' +
            '<div class="serie-row"><span class="serie-lbl">Series × reps</span>' +
              '<input class="serie" data-ser="' + bi + '.' + ei + '" value="' + esc(s.serie) + '" /></div>' +
            '<div class="ex-actions">' +
              '<button data-swap="' + bi + '.' + ei + '">Cambiar</button>' +
              '<button data-pick="' + bi + '.' + ei + '">Elegir otro</button>' +
              '<button data-del="' + bi + '.' + ei + '">Quitar</button>' +
            '</div>' +
          '</div>';
        cont.appendChild(div);
      });
    });
    const lbl = durMode === "custom" ? "a medida" : (durMin === 60 ? "1 h" : durMin === 90 ? "1 h 30" : "2 h");
    $("#result-meta").textContent = total + " ejercicios · " + lbl;
    const slots = plan.flatMap(g => g.ejercicios);
    const hechos = slots.filter(s => s.done).length;
    $("#prog-fill").style.width = slots.length ? Math.round(hechos / slots.length * 100) + "%" : "0%";
    $("#prog-text").textContent = slots.length ? (hechos + " / " + slots.length + " hechos") : "";
    $("#result").classList.remove("hidden");
    $("#done").disabled = false;
    if (!$("#done").textContent.startsWith("Guardado")) $("#done").textContent = "He hecho este entreno hoy";
    savePlan();
  }

  function nuevo() {
    plan = generar();
    render();
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#generate").addEventListener("click", nuevo);
  $("#regen").addEventListener("click", nuevo);

  // montar a mano: estructura vacía para rellenar con "+ Añadir"
  $("#manual").addEventListener("click", () => {
    plan = estructura().map(([titulo, blks]) => ({ titulo, blks, ejercicios: [] }));
    render();
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Monta tu entreno: usa “+ Añadir” en cada bloque");
  });

  // editar: delegación de eventos en #blocks
  $("#blocks").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    if (btn.dataset.swap) {
      const [bi, ei] = btn.dataset.swap.split(".").map(Number);
      const safe = $("#safe").checked;
      const used = usedNames();
      const cand = pool(plan[bi].blks, safe).filter(e => !used.has(e.n));
      if (!cand.length) { toast("No quedan ejercicios para cambiar en este bloque", true); return; }
      plan[bi].ejercicios[ei] = { e: sample(cand, 1)[0], serie: plan[bi].ejercicios[ei].serie };
      render();
    } else if (btn.dataset.pick) {
      const [bi, ei] = btn.dataset.pick.split(".").map(Number);
      openPicker(bi, ei);
    } else if (btn.dataset.del) {
      const [bi, ei] = btn.dataset.del.split(".").map(Number);
      plan[bi].ejercicios.splice(ei, 1);
      render();
    } else if (btn.dataset.done) {
      const [bi, ei] = btn.dataset.done.split(".").map(Number);
      plan[bi].ejercicios[ei].done = !plan[bi].ejercicios[ei].done;
      render();
    } else if (btn.dataset.add) {
      openPicker(Number(btn.dataset.add));
    }
  });

  // editar la prescripción series × reps en vivo
  $("#blocks").addEventListener("input", (ev) => {
    const inp = ev.target.closest("input.serie");
    if (!inp) return;
    const [bi, ei] = inp.dataset.ser.split(".").map(Number);
    if (plan[bi] && plan[bi].ejercicios[ei]) { plan[bi].ejercicios[ei].serie = inp.value; savePlan(); }
  });

  // ---------- modal añadir cualquier ejercicio ----------
  let pickerBlock = null, pickerSlot = null;
  function openPicker(bi, ei) {
    pickerBlock = bi;
    pickerSlot = (typeof ei === "number") ? ei : null;
    $("#picker-title").textContent = pickerSlot === null
      ? "Añadir a · " + plan[bi].titulo
      : "Elegir otro ejercicio";
    $("#picker-search").value = "";
    $("#picker-cat").value = "";
    renderPicker("");
    $("#picker").classList.remove("hidden");
    $("#picker-search").focus();
  }
  function closePicker() { $("#picker").classList.add("hidden"); }

  function renderPicker(q) {
    q = (q || "").trim().toLowerCase();
    const cat = $("#picker-cat").value;
    const used = usedNames();
    const list = EX
      .filter(e => (!cat || e.c === cat) &&
        (!q || e.n.toLowerCase().includes(q) || e.c.toLowerCase().includes(q) || (e.s && e.s.toLowerCase().includes(q))))
      .sort((a, b) => a.n.localeCompare(b.n, "es"))
      .slice(0, 80);
    const cont = $("#picker-list");
    cont.innerHTML = "";
    if (!list.length) { cont.innerHTML = '<p class="muted" style="padding:10px">Sin resultados.</p>'; return; }
    list.forEach(e => {
      const ya = used.has(e.n);
      const it = document.createElement("button");
      it.className = "picker-item" + (ya ? " added" : "");
      it.disabled = ya;
      it.innerHTML = '<span><b>' + esc(e.n) + '</b><small>' + esc(e.c) +
        " · " + RIESGO_LBL[e.r] + '</small></span><em>' + (ya ? "añadido" : "+") + '</em>';
      if (!ya) it.addEventListener("click", () => {
        if (pickerSlot === null) {
          plan[pickerBlock].ejercicios.push({ e, serie: repsPara(plan[pickerBlock].blks[0]) });
          toast("Añadido: " + e.n);
        } else {
          const prev = plan[pickerBlock].ejercicios[pickerSlot];
          plan[pickerBlock].ejercicios[pickerSlot] = { e, serie: prev ? prev.serie : repsPara(plan[pickerBlock].blks[0]) };
          toast("Cambiado por: " + e.n);
        }
        closePicker();
        render();
      });
      cont.appendChild(it);
    });
  }
  $("#picker-search").addEventListener("input", (e) => renderPicker(e.target.value));
  $("#picker-cat").addEventListener("change", () => renderPicker($("#picker-search").value));
  $("#picker-close").addEventListener("click", closePicker);
  $("#picker").addEventListener("click", (e) => { if (e.target.id === "picker") closePicker(); });

  // poblar el desplegable de categorías del picker
  (function () {
    const cats = Array.from(new Set(EX.map(e => e.c))).sort((a, b) => a.localeCompare(b, "es"));
    $("#picker-cat").innerHTML = '<option value="">Todas las categorías</option>' +
      cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join("");
  })();

  // ---------- guardar en Airtable ----------
  function toast(msg, isErr) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("err", !!isErr);
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3800);
  }

  function resumenTexto() {
    return plan.filter(g => g.ejercicios.length).map(g =>
      g.titulo.toUpperCase() + "\n" +
      g.ejercicios.map(s => "  • " + s.e.n + "  (" + s.serie + ")").join("\n")
    ).join("\n\n");
  }

  async function guardarEnAirtable() {
    const hoy = new Date();
    const fecha = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0") + "-" + String(hoy.getDate()).padStart(2, "0");
    const nombres = plan.flatMap(g => g.ejercicios.map(s => s.e.n));
    const series = plan.filter(g => g.ejercicios.length).map(g =>
      g.titulo + ": " + g.ejercicios.map(s => s.e.n + " (" + s.serie + ")").join(", ")
    ).join(" | ");
    const dur = durMode === "custom" ? (nMov + nFue) * 7 : durMin;
    const nota = (($("#entreno-notas") || {}).value || "").trim();
    const hechos = plan.flatMap(g => g.ejercicios).filter(s => s.done).length;
    const fields = {
      fecha, tipo: "Mixto", fuente: "Nacho", duracion_min: dur,
      ejercicios: nombres.join(", "),
      series_reps_cargas: series,
      notas: "Sport Hub · " + nombres.length + " ejercicios" +
        (hechos ? " · " + hechos + " marcados hechos" : "") + (nota ? " — " + nota : ""),
    };
    // Cliente BYOK compartido (token en este dispositivo) -> funciona también en el deploy/móvil.
    if (window.shAirtable && window.shAirtable.hasToken()) return window.shAirtable.create("entrenos", fields);
    const url = "https://api.airtable.com/v0/" + CFG.baseId + "/" + encodeURIComponent(CFG.tabla_entrenos || "entrenos");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": "Bearer " + CFG.token, "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    });
    if (!res.ok) throw new Error("Airtable " + res.status + ": " + (await res.text()));
    return res.json();
  }

  $("#done").addEventListener("click", async () => {
    if (!plan || !plan.some(g => g.ejercicios.length)) { toast("El entreno está vacío", true); return; }
    if (!(window.shAirtable && window.shAirtable.hasToken())) {
      try { await navigator.clipboard.writeText(resumenTexto()); } catch (e) {}
      $("#done-note").textContent = "Conecta Airtable en la pestaña Daily Metrics para guardar tus entrenos. De momento te lo he copiado al portapapeles.";
      toast("Conecta Airtable (pestaña Daily Metrics)", true);
      return;
    }
    const btn = $("#done");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      await guardarEnAirtable();
      btn.textContent = "Guardado en tu diario ✓";
      $("#done-note").textContent = "Anotado en la tabla 'entrenos' de Airtable con la fecha de hoy.";
      toast("Entreno guardado como tu entreno de hoy");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "He hecho este entreno hoy";
      $("#done-note").textContent = "No se pudo guardar: " + err.message;
      toast("Error al guardar (ver detalle)", true);
    }
  });

  // ---------- REPOSITORIO ----------
  const selCat = $("#filter-cat");
  const BLOQUES = ["movilidad", "activacion", "fuerza", "estabilidad", "core", "potencia"];
  let filtroBloque = "", filtroRiesgo = "", filtroOrigen = "", agruparPor = "categoria", filtroFav = false;
  const ORIGEN_LBL = { nacho: "Nacho", sportshub: "SportsHub" };

  // selector "agrupar por"
  $$("#group-by button").forEach(b => b.addEventListener("click", () => {
    $$("#group-by button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    agruparPor = b.dataset.g;
    pintarRepo();
  }));

  // chips de bloque con contadores
  const blockChips = $("#filter-block");
  blockChips.innerHTML = '<button class="chip on" data-b="">Todos · ' + EX.length + '</button>' +
    BLOQUES.map(b => '<button class="chip" data-b="' + b + '">' + BLOQUE_LBL[b] + " · " +
      EX.filter(e => e.b === b).length + '</button>').join("");
  $$("#filter-block .chip").forEach(ch => ch.addEventListener("click", () => {
    $$("#filter-block .chip").forEach(c => c.classList.remove("on"));
    ch.classList.add("on");
    filtroBloque = ch.dataset.b;
    rebuildCats();
    pintarRepo();
  }));

  $$("#filter-risk .chip").forEach(ch => ch.addEventListener("click", () => {
    $$("#filter-risk .chip").forEach(c => c.classList.remove("on"));
    ch.classList.add("on");
    filtroRiesgo = ch.dataset.r;
    pintarRepo();
  }));

  // chips de origen (Nacho / SportsHub) con contadores
  const originChips = $("#filter-origin");
  if (originChips) {
    originChips.innerHTML = '<button class="chip on" data-o="">Todos · ' + EX.length + '</button>' +
      '<button class="chip" data-o="nacho">Nacho · ' + EX.filter(e => (e.o || "nacho") === "nacho").length + '</button>' +
      '<button class="chip" data-o="sportshub">Añadidos · ' + EX.filter(e => e.o === "sportshub").length + '</button>';
    $$("#filter-origin .chip").forEach(ch => ch.addEventListener("click", () => {
      $$("#filter-origin .chip").forEach(c => c.classList.remove("on"));
      ch.classList.add("on");
      filtroOrigen = ch.dataset.o;
      pintarRepo();
    }));
  }

  function rebuildCats() {
    const cats = Array.from(new Set(EX.filter(e => !filtroBloque || e.b === filtroBloque).map(e => e.c)))
      .sort((a, b) => a.localeCompare(b, "es"));
    selCat.innerHTML = '<option value="">Todas las categorías</option>' +
      cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join("");
  }
  selCat.addEventListener("change", pintarRepo);
  $("#search").addEventListener("input", pintarRepo);
  $("#fav-filter").addEventListener("click", function () {
    filtroFav = !filtroFav;
    this.classList.toggle("on", filtroFav);
    pintarRepo();
  });
  $("#repo-list").addEventListener("click", (ev) => {
    const b = ev.target.closest(".fav-btn"); if (!b) return;
    const on = FAVS.toggle(b.dataset.fav);
    b.classList.toggle("on", on);
    const fc = $("#fav-count"); if (fc) fc.textContent = FAVS.list().length;
    if (filtroFav && !on) { const ex = b.closest(".ex"); if (ex) ex.remove(); }
  });

  function pintarRepo() {
    const q = $("#search").value.trim().toLowerCase();
    const cat = selCat.value;
    const list = EX.filter(e =>
      (!filtroFav || FAVS.has(e.n)) &&
      (!filtroBloque || e.b === filtroBloque) &&
      (!cat || e.c === cat) &&
      (!filtroRiesgo || e.r === filtroRiesgo) &&
      (!filtroOrigen || (e.o || "nacho") === filtroOrigen) &&
      (!q || e.n.toLowerCase().includes(q) || e.d.toLowerCase().includes(q) ||
        (e.s && e.s.toLowerCase().includes(q)) || e.c.toLowerCase().includes(q))
    );

    $("#repo-count").textContent = list.length + " de " + EX.length + " ejercicios";
    const fc = $("#fav-count"); if (fc) fc.textContent = FAVS.list().length;
    const cont = $("#repo-list");
    cont.innerHTML = "";
    if (!list.length) {
      cont.innerHTML = filtroFav
        ? '<p class="muted">Aún no has marcado favoritos. Pulsa la ★ en cualquier ejercicio.</p>'
        : '<p class="muted">Sin resultados.</p>';
      return;
    }

    // agrupar según la vista elegida (categoría de Nacho / detalle granular / bloque)
    const keyOf = (e) => agruparPor === "bloque" ? BLOQUE_LBL[e.b]
      : agruparPor === "detalle" ? (e.c + (e.s ? " · " + e.s : ""))
      : agruparPor === "origen" ? (e.o === "sportshub" ? "Añadidos por SportsHub" : "Repertorio de Nacho")
      : e.c;
    const groups = {};
    list.forEach(e => { const k = keyOf(e); (groups[k] = groups[k] || []).push(e); });
    const ordenBloque = ["Movilidad", "Activación", "Fuerza", "Estabilidad", "Core", "Potencia"];
    const ordenOrigen = ["Repertorio de Nacho", "Añadidos por SportsHub"];
    const keys = Object.keys(groups).sort((a, b) =>
      agruparPor === "bloque" ? ordenBloque.indexOf(a) - ordenBloque.indexOf(b)
      : agruparPor === "origen" ? ordenOrigen.indexOf(a) - ordenOrigen.indexOf(b)
      : a.localeCompare(b, "es"));

    const frag = document.createDocumentFragment();
    keys.forEach(k => {
      const items = groups[k].sort((a, b) => a.n.localeCompare(b.n, "es"));
      const head = document.createElement("div");
      head.className = "repo-group";
      head.innerHTML = esc(k) + " <span>" + items.length + "</span>";
      frag.appendChild(head);
      items.forEach(e => {
        // dentro de un bloque mostramos la categoría; en otras vistas, la subcategoría
        const badge = agruparPor === "bloque" ? e.c : e.s;
        const div = document.createElement("div");
        div.className = "ex";
        div.innerHTML =
          '<button class="fav-btn' + (FAVS.has(e.n) ? " on" : "") + '" data-fav="' + esc(e.n) + '" aria-label="Marcar favorito" title="Favorito">★</button>' +
          '<div class="body">' +
            '<div class="name">' + esc(e.n) + '</div>' +
            '<div class="desc">' + esc(e.d) + '</div>' +
            '<div class="meta">' +
              (badge ? '<span class="badge b-cat">' + esc(badge) + '</span>' : "") +
              '<span class="badge b-org org-' + (e.o || "nacho") + '">' + ORIGEN_LBL[e.o || "nacho"] + '</span>' +
              '<span class="risk r-' + e.r + '"><i></i>' + RIESGO_LBL[e.r] + '</span>' +
              '<a class="yt" href="' + yt(e.n) + '" target="_blank" rel="noopener">Vídeo</a>' +
            '</div>' +
          '</div>';
        frag.appendChild(div);
      });
    });
    cont.appendChild(frag);
  }

  const heroNum = $("#repo-hero-num"); if (heroNum) heroNum.textContent = EX.length;
  rebuildCats();
  pintarRepo();
  FAVS.pull().then(function (ok) { if (ok) pintarRepo(); }); // trae tus favoritos de Airtable
  slideshow($("#hero-bg-gen"), HERO_IMGS, 6500);
  setLayer($("#hero-bg-repo"), REPO_IMGS[0]);

  // restaurar el último entreno (no se pierde al recargar)
  (function restaurar() {
    const s = LS.get("sh_plan", null);
    if (s && Array.isArray(s.plan) && s.plan.length) {
      plan = s.plan;
      durMode = s.durMode || "preset"; durMin = s.durMin || 60;
      nMov = s.nMov || 4; nFue = s.nFue || 4;
      if (s.notas && $("#entreno-notas")) $("#entreno-notas").value = s.notas;
      render();
    }
  })();
  if ($("#entreno-notas")) $("#entreno-notas").addEventListener("input", savePlan);

  // ---------- API pública: que el Coach pueda cargar un entreno en el Generador ----------
  window.SportHub = {
    cargarPlan(planData) {
      if (!Array.isArray(planData) || !planData.length) return false;
      plan = planData;
      // cambiar a la sub-pestaña Strength & Mobility del Generator
      showView("gen");
      render();
      $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    },
    getPlan() {
      if (!plan || !plan.length) return null;
      return plan.map((g) => ({
        titulo: g.titulo,
        ejercicios: g.ejercicios.map((s) => ({ nombre: s.e.n, series: s.serie })),
      }));
    },
  };

  if (!EX.length) {
    document.body.insertAdjacentHTML("afterbegin",
      '<p style="color:#FF2D55;padding:12px">No se cargaron los ejercicios (data/ejercicios.js).</p>');
  }
})();
