/* Sport Hub — airtable.js
   Cliente Airtable BYOK (Bring Your Own Key).
   El token (Personal Access Token) vive SOLO en este dispositivo (localStorage),
   igual que la clave del coach. El baseId no es secreto: sin token no sirve de nada.
   Probado: Airtable responde con cabeceras CORS, así que esto funciona desde el móvil
   sin necesidad de ningún servidor. */
(function () {
  "use strict";
  const BASE = "app8BZqLNYB4A5Lx1";
  const LS_TOKEN = "sh_airtable_token";
  const TABLES = {
    entrenos: "entrenos",
    sensaciones: "sensaciones_diarias",
    metricas: "metricas_diarias",
    objetivos: "objetivos",
    competiciones: "competiciones",
    repositorio: "repositorio_ejercicios",
    favoritos: "favoritos",
    mensual: "resumen_mensual",
  };
  const CFG = window.SPORTHUB_CONFIG || {};
  function cfgToken() {
    const t = CFG.token || "";
    return (t && t.indexOf("XXXX") === -1) ? t : ""; // ignora el placeholder del deploy
  }
  function getToken() { return (localStorage.getItem(LS_TOKEN) || cfgToken() || "").trim(); }
  function setToken(t) { if (t && t.trim()) localStorage.setItem(LS_TOKEN, t.trim()); else localStorage.removeItem(LS_TOKEN); }
  function hasToken() { return !!getToken(); }

  async function req(method, table, qs, body) {
    const tok = getToken();
    if (!tok) throw new Error("NO_TOKEN");
    const url = "https://api.airtable.com/v0/" + BASE + "/" +
      encodeURIComponent(TABLES[table] || table) + (qs || "");
    const res = await fetch(url, {
      method: method,
      headers: Object.assign({ "Authorization": "Bearer " + tok }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const tag = res.status === 401 ? " (token inválido o sin permisos)" : "";
      throw new Error("Airtable " + res.status + tag + ": " + txt.slice(0, 180));
    }
    return res.json();
  }

  async function create(table, fields) {
    const j = await req("POST", table, "", { records: [{ fields: fields }], typecast: true });
    return j.records[0];
  }

  async function del(table, id) {
    const tok = getToken();
    if (!tok) throw new Error("NO_TOKEN");
    const url = "https://api.airtable.com/v0/" + BASE + "/" + encodeURIComponent(TABLES[table] || table) + "/" + id;
    const res = await fetch(url, { method: "DELETE", headers: { "Authorization": "Bearer " + tok } });
    if (!res.ok) throw new Error("Airtable " + res.status);
    return res.json();
  }

  async function list(table, opts) {
    opts = opts || {};
    const p = new URLSearchParams();
    if (opts.maxRecords) p.set("maxRecords", String(opts.maxRecords));
    if (opts.pageSize) p.set("pageSize", String(opts.pageSize));
    (opts.fields || []).forEach((f) => p.append("fields[]", f));
    (opts.sort || []).forEach((s, i) => {
      p.set("sort[" + i + "][field]", s.field);
      p.set("sort[" + i + "][direction]", s.direction || "asc");
    });
    const q = p.toString();
    const j = await req("GET", table, q ? "?" + q : "");
    return j.records || [];
  }

  async function test() {
    try { await list("entrenos", { maxRecords: 1, fields: ["fecha"] }); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  }

  window.shAirtable = { BASE: BASE, TABLES: TABLES, getToken: getToken, setToken: setToken, hasToken: hasToken, create: create, del: del, list: list, test: test };
})();
