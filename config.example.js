// Copia este archivo como config.js y rellena tus credenciales de Airtable.
// config.js está en .gitignore (no se sube a git).
//
// ⚠️ SEGURIDAD: este token va en el navegador. Es ACEPTABLE para uso local en
// tu ordenador/móvil, pero NO subas config.js a un hosting público (Vercel) tal
// cual: ahí el token quedaría expuesto. Para el deploy usaremos una función
// serverless que guarde el token en el servidor.
window.SPORTHUB_CONFIG = {
  baseId: "appXXXXXXXXXXXXXX",
  token: "patXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  tabla_entrenos: "entrenos",
};
