# Instalar Atril en el móvil (gratis, con GitHub Pages)

Atril es una app web instalable (PWA). Para instalarla en el móvil tiene que estar publicada en una dirección **https**. Se hace una sola vez, desde el ordenador, en unos 10 minutos.

> ⚠️ **Antes de subir nada:** comprueba que en `config.js` la línea `apiKey` está vacía (`apiKey: ''`). El repositorio será público y cualquiera podría copiar tu clave. La clave se pone después en **Ajustes** de cada dispositivo y se queda guardada solo allí.

---

## Paso 1 · Crear el repositorio (en el ordenador)

1. Entra en **github.com** con tu cuenta.
2. Arriba a la derecha, **+ → New repository**.
3. Nombre: `atril` · marca **Public** · pulsa **Create repository**.

## Paso 2 · Subir los archivos

1. En el repositorio recién creado, pulsa **uploading an existing file** (o **Add file → Upload files**).
2. Abre la carpeta `atril` en tu ordenador, **selecciona todo su contenido** (archivos y las carpetas `icons` y `libs`) y arrástralo a la página. Usa Chrome o Edge para que las carpetas se suban con su contenido.
3. Abajo, pulsa **Commit changes**.
4. Comprueba que en el repositorio se ven `index.html`, `app.js`, `estudio.js` y las carpetas `icons` y `libs`, todos en el nivel principal y no dentro de otra carpeta.

## Paso 3 · Activar la web

1. En el repositorio: **Settings → Pages** (menú de la izquierda).
2. En **Branch** elige `main` y carpeta `/ (root)` → **Save**.
3. Espera 1–2 minutos y recarga. Aparecerá tu dirección:
   **`https://TU-USUARIO.github.io/atril/`**

## Paso 4 · Instalar en el teléfono

**Android (Chrome):**
1. Abre la dirección anterior en **Chrome**.
2. Menú **⋮** → **Instalar aplicación** (o **Añadir a pantalla de inicio**). También puedes usar el botón **📲 Instalar app** del menú lateral de Atril.
3. Confirma. El icono del atril aparece en tu pantalla de inicio y se abre a pantalla completa.

**iPhone / iPad (Safari):**
1. Abre la dirección en **Safari**.
2. Botón **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio** → **Añadir**.

## Paso 5 · Configurar la IA en el móvil

1. Abre Atril → **Ajustes** → pega tu clave de Gemini → sal del campo. Debe aparecer «✓ IA conectada».
2. Las claves nuevas de Google empiezan por **AQ.** y son válidas (la versión anterior de la app las rechazaba por error).

## Paso 6 · Pasar tus temas del ordenador al móvil

Cada dispositivo guarda sus propios datos. Para llevar lo que ya tienes:

1. En el ordenador: **Progreso → 💾 Descargar copia**.
2. Envíate ese archivo `.json` al móvil (Google Drive, correo o WhatsApp a ti misma).
3. En el móvil: **Progreso → 📥 Importar copia** y elige el archivo.

También puedes subir los PDF directamente desde el móvil: **Temario → + Nuevo tema → 📄 Subir archivo**.

---

## Actualizar la app más adelante

1. Sube los archivos nuevos al mismo repositorio (sustituyen a los anteriores).
2. En `service-worker.js` cambia el número de `CACHE` (por ejemplo, `atril-v2.0.1`).
3. En el móvil, cierra y vuelve a abrir Atril dos veces: se actualizará sola. Tus datos no se borran.

## Si algo falla

- **No aparece «Instalar aplicación»:** asegúrate de usar la dirección `https://…github.io/atril/` en Chrome, no un archivo descargado.
- **El micrófono no funciona:** acepta el permiso de micrófono; en Android, Ajustes del teléfono → Apps → Chrome → Permisos → Micrófono. Como alternativa, usa el micrófono del teclado del móvil.
- **Se perdieron los datos:** borrar los datos de navegación de Chrome borra los de Atril. Haz copia de seguridad de vez en cuando (la app te lo recuerda en Inicio).
