# Atril · Entrenador de oposiciones y comunicación oral

PWA **local-first** para preparar la oposición de Orientación Educativa: entrenar el **temario** y los **supuestos prácticos** completos o **por partes**, con **repaso espaciado**, **dictado por voz**, lectura de **PDF (también escaneados)** y corrección con IA. Incluye además el ensayo oral (tribunal, defensa de programación, inspección, reuniones…).

Todo se guarda en tu dispositivo. Solo sale el texto que envías a la IA que elijas.

**Instalar en el móvil:** ver [`INSTALAR-MOVIL.md`](INSTALAR-MOVIL.md).

---

## 0. Cómo se entrena (novedades de la versión 2)

### Temario
1. **Temario → + Nuevo tema → Subir archivo** (PDF, Word, foto…). La app extrae el texto; si el PDF es escaneado, lo transcribe con Gemini.
2. Detecta los **apartados** sola (numeración, títulos en mayúsculas, «Introducción», «Conclusión»…) o con **🤖 Dividir con IA**. Puedes corregirlos: cada apartado empieza con `## `. Admite peso y tiempo: `## 3. Marco normativo [20% · 15 min]`.
3. Marca ★ los temas que has seleccionado (máx. los que vayas a llevar al examen).

**Entrenamiento parcial** (marca uno o varios apartados, «los de hoy», «los flojos» o «uno al azar»):
- 📖 **Estudiar**: lectura, lectura en voz alta y modo **primeras letras** (solo la inicial de cada palabra).
- 🧩 **Huecos**: palabras clave y normativa ocultas, con tres niveles.
- 🧠 **Recordar y corregir**: escribes o **dictas** sin mirar; se compara con tu tema (ideas que faltan, errores, normativa olvidada, pista mnemotécnica).
- 🃏 **Preguntas rápidas**: tarjetas generadas por la IA a partir de tu texto.

**Tema entero:**
- 🗂 **Índice** de memoria (con acrónimo de apoyo).
- 🔗 **Encadenar**: qué apartado sigue y cómo enlazas (frases puente).
- ⏱ **Simulacro completo** cronometrado con tu **tiempo adaptado**, plan de minutos por apartado, guardado automático y corrección **por apartados**.
- 🎓 **Defensa oral**: un tribunal te pregunta por voz sobre ese tema.

### Repaso de hoy
Cada apartado tiene su calendario de repaso (Otra vez · Difícil · Bien · Fácil), con tope en la **fecha del examen**. Eliges tu **energía del día** (baja: leer/escuchar · media: huecos · alta: recordar y corregir) y el tamaño del bloque.

### Supuestos
Añádelos a mano, **extráelos de un PDF** (de tu academia o convocatorias) o **genéralos con IA** por etapa y ámbito. Entrenamiento **completo**, **solo las preguntas marcadas**, **por fases** (análisis, normativa, propuesta, agentes, seguimiento), **esquema en 15 min** o **defensa oral**. Corrección con rúbrica de tribunal y comparación con la solución modelo.

### Accesibilidad
Dictado continuo en todos los cuadros (comandos «punto», «coma», «punto y aparte», «nuevo apartado»), lectura en voz alta, tamaño de letra, tiempo extra configurable, avisos con vibración, guardado automático de borradores.

### Copia de seguridad
**Progreso → Descargar copia / Importar copia**: lleva temas, supuestos, documentos y repasos entre ordenador y móvil. La clave de IA nunca se exporta.

---
## 1. Puesta en marcha (3 formas)

**A) Rápida (abrir el archivo).** Abre `index.html` con Chrome o Edge. Funciona todo salvo la instalación offline (el service worker necesita servidor).

**B) Como servidor local (recomendada para desarrollo).**
```bash
cd atril
python3 -m http.server 8000
# abre http://localhost:8000
```

**C) Publicada como PWA instalable (gratis).** Sube la carpeta a **GitHub Pages** o **Netlify** (arrastrar y soltar). Desde el móvil/tablet: *Añadir a pantalla de inicio*. Queda como una app nativa, offline.

> El micrófono y el reconocimiento de voz requieren **HTTPS** o **localhost**. GitHub Pages y Netlify ya sirven en HTTPS.

### Conseguir la IA (paso único)
1. Entra en **[aistudio.google.com](https://aistudio.google.com)** → *Get API key* (gratis). Las claves nuevas empiezan por `AQ.` y son válidas.
2. En Atril → **Ajustes** → proveedor **Gemini** → pega la clave → *Probar conexión*.
3. Si Google retira un modelo, la app elige sola el más reciente disponible.

Listo. Gemini cubre chat **y** embeddings sin coste, así que el RAG funciona completo.

---

## 2. Proveedores de IA

La app es **multiproveedor**: cambiar de motor no toca ningún otro módulo. Notas de conexión desde el navegador:

| Proveedor | Chat | Embeddings (RAG) | Nota |
|---|---|---|---|
| **Gemini** ✅ recomendado | sí | sí (`gemini-embedding-2`) | Clave gratuita; también lee PDF escaneados |
| OpenAI | sí | sí | Consume saldo |
| OpenRouter | sí | — (usa RAG local) | Muchos modelos, algunos gratis |
| Anthropic (Claude) | sí | — (usa RAG local) | Requiere el encabezado de acceso directo (ya incluido) |
| **Ollama** | sí | sí | 100% local y gratis. Arráncalo permitiendo el navegador: `OLLAMA_ORIGINS="*" ollama serve` |

Cuando el proveedor no ofrece embeddings, el RAG cae automáticamente a un método **TF-IDF local** (sin coste, sin red).

---

## 3. Arquitectura

Aplicación de una sola página, sin backend ni proceso de compilación. Todo el estado vive en **IndexedDB** (privado, persistente, offline). Cada módulo de `app.js` es autónomo y se comunica solo a través de `DB` y `State`, de modo que **se pueden añadir módulos nuevos sin modificar los existentes**.

```
atril/
├── index.html            · estructura + sistema de diseño (CSS)
├── app.js                · núcleo: datos, IA, documentos, voz, ensayo oral
├── estudio.js            · temario, repaso espaciado, supuestos, simulacros
├── config.js             · configuración opcional (deja la clave vacía si publicas)
├── libs/                 · lectores de PDF, Word, Excel y ZIP (funcionan sin conexión)
├── manifest.webmanifest  · metadatos PWA
├── service-worker.js     · caché offline
├── icons/                · iconos de la app
└── README.md
```

Mapa de módulos (`app.js`):

| # | Módulo | Responsabilidad |
|---|---|---|
| 1 | `DB` | Capa IndexedDB (perfiles, docs, chunks, sesiones, ajustes) |
| 2 | `State` | Estado en memoria + carga/guardado de ajustes |
| 3 | `Providers` | Conectores de IA. **Añadir proveedor = añadir un objeto aquí** |
| 4 | `Docs` | Ingesta y extracción de texto (PDF, Word, PPT, Excel, EPUB, HTML…) |
| 5 | `RAG` | Troceado, embeddings, recuperación (vectorial o TF-IDF), citas |
| 6 | `Voice` | Reconocimiento (STT), síntesis (TTS), detección de silencios |
| 7 | `Analyzer` | Volumen (Web Audio) + métricas de texto (ritmo, muletillas, léxico) |
| 8 | `Modes` | Los 15 escenarios de entrenamiento |
| 9 | `Session` | Orquesta voz + IA + RAG + análisis |
| 10 | `Feedback` | Evaluación estructurada por IA con respaldo por reglas |
| 11 | `Chart` | Gráficos SVG sin dependencias |
| 12–16 | `UI`, vistas, perfiles, exportación, arranque | Interfaz y ciclo de vida |

### Esquema de datos (IndexedDB)
- **profiles**: `{id, name, goal, created}`
- **docs**: `{id, profileId, name, type, size, chars, tags, indexed, vector, chunkCount}`
- **chunks**: `{id, docId, profileId, docName, text, vec}` — unidades RAG
- **sessions**: `{id, profileId, mode, diff, topic, turns[], metrics, feedback, started, ended}`
- **kv**: ajustes globales y por perfil (proveedor, clave, voz, tema…)
- **texts**: `{docId, text}` — texto completo de cada documento
- **temas**: `{id, profileId, num, title, bloque, selected, text, docIds, sections:[{id, title, weight, minutes, text, srs}]}`
- **supuestos**: `{id, profileId, title, etapa, ambito, enunciado, preguntas[], modelo, lastScore}`
- **attempts**: `{id, profileId, itemId, kind, label, score, answer, eval, durationSec, at}`

### Por qué local-first
Tus requisitos —uso personal, gratis, software libre, datos privados, sin costes de servidor, PWA en tres dispositivos— apuntan a esta arquitectura. Sin servidor no hay nada que mantener ni pagar, y la privacidad es total por construcción: los documentos nunca se suben a ningún sitio.

---

## 4. Plan de desarrollo por fases

- **Fase 1 — Núcleo (esta entrega).** Perfiles, biblioteca con extracción de texto, RAG (vectorial + TF-IDF), conversación por voz con análisis del discurso, 15 modos, feedback por sesión, estadísticas, exportación, PWA instalable.
- **Fase 2 — Profundizar el análisis.** Detección de pausas más fina, entonación (pitch) vía Web Audio, objetivos personalizados y comparativa entre sesiones lado a lado.
- **Fase 3 — Cámara y lenguaje corporal.** Módulo opcional con `getUserMedia` de vídeo y detección de postura/gestos en el dispositivo.
- **Fase 4 — RAG avanzado.** Reranking, resúmenes por documento, colecciones temáticas y citas con fragmento exacto.
- **Fase 5 — Colaboración y respaldo.** Exportar/importar perfil completo, sincronización opcional cifrada, biblioteca compartida entre dispositivos.
- **Fase 6 — Contenido curricular.** Plantillas de programación/UD de Castilla-La Mancha y banco de supuestos por especialidad.

---

## 5. Cómo ampliar

**Añadir un proveedor de IA:** agrega un objeto `_miproveedor` en `Providers` con `chat()` y, opcionalmente, `embed()`, y una entrada en `Providers.defaults` y `Providers.hint`. Añade su `<option>` en el `<select id="provider">`. Nada más.

**Añadir un modo:** añade un objeto al array `Modes` con `id`, `mic`, `name`, `desc` y `role`. Aparece solo en la cuadrícula.

**Añadir un módulo (p. ej. cámara):** créalo como objeto independiente y engánchalo desde `Session`. No necesita tocar `DB`, `Voice` ni `Feedback`.

---

## 6. Privacidad y límites conocidos
- Los datos viven en IndexedDB de **este navegador**. Borrar los datos del sitio los elimina. Usa *Exportar* para respaldo.
- El reconocimiento de voz del navegador (Web Speech API) va mejor en **Chrome/Edge/Android**; Firefox y Safari tienen soporte limitado. Si no hay voz, existe el **modo escrito**.
- La clave de IA se guarda localmente. En un dispositivo compartido, ten en cuenta que es accesible desde el propio navegador.
