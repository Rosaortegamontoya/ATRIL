/* =====================================================================
   ATRIL · config.js  ·  CONFIGURACIÓN RÁPIDA (opcional)
   ---------------------------------------------------------------------
   ⚠️  Si vas a publicar la app en GitHub Pages (para instalarla en el
   móvil), DEJA apiKey VACÍA. El repositorio es público y cualquiera
   podría copiar tu clave. Escríbela en Ajustes de cada dispositivo:
   se guarda solo en ese dispositivo.

   Solo si usas la app en tu ordenador sin publicarla puedes pegarla aquí.
   Claves de Gemini: aistudio.google.com → «Get API key»
   (las nuevas empiezan por AQ.  y las antiguas por AIza; ambas valen).
   ===================================================================== */
window.ATRIL_CONFIG = {
  provider: 'gemini',
  apiKey: '',                       // ← vacía en la versión publicada
  chatModel: 'gemini-flash-latest', // si deja de existir, la app elige otro sola
  embModel: 'gemini-embedding-2'
};
