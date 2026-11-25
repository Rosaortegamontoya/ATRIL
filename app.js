/* =====================================================================
   ATRIL · app.js
   Entrenador de comunicación oral docente — PWA local-first
   Arquitectura modular. Cada módulo es un objeto independiente y no
   guarda estado global salvo a través de DB y State. Añadir un módulo
   nuevo (p. ej. cámara / lenguaje corporal) no obliga a tocar los demás.
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   0 · UTILIDADES
   --------------------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, attrs = {}, html) => { const n = document.createElement(tag); for (const k in attrs) { if (k === 'class') n.className = attrs[k]; else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]); else if (k === 'html') n.innerHTML = attrs[k]; else n.setAttribute(k, attrs[k]); } if (html != null) n.innerHTML = html; return n; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = t => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const bytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function toast(msg, kind = '') {
  const t = el('div', { class: 'toast ' + kind }, esc(msg));
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
}
function modal(title, bodyHTML, actions = []) {
  return new Promise(resolve => {
    const m = $('#modal');
    m.innerHTML = `<h3>${esc(title)}</h3><div>${bodyHTML}</div>`;
    const row = el('div', { class: 'row' });
    actions.forEach(a => {
      const b = el('button', { class: 'btn ' + (a.cls || '') }, esc(a.label));
      b.onclick = () => { close(); resolve(a.value); };
      row.appendChild(b);
    });
    m.appendChild(row);
    const bg = $('#modalBg'); bg.classList.add('open');
    function close() { bg.classList.remove('open'); }
    bg.onclick = e => { if (e.target === bg) { close(); resolve(null); } };
  });
}
async function loadScript(src) {
  if ([...document.scripts].some(s => s.src === src)) return;
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
}

/* ---------------------------------------------------------------------
   1 · BASE DE DATOS (IndexedDB) — privada, en el dispositivo
   --------------------------------------------------------------------- */
const DB = {
  _db: null,
  stores: ['profiles', 'docs', 'chunks', 'sessions', 'kv', 'texts', 'temas', 'supuestos', 'attempts'],
  async open() {
    if (this._db) return this._db;
    this._db = await new Promise((res, rej) => {
      const r = indexedDB.open('atril', 2);
      r.onupgradeneeded = e => {
        const db = e.target.result, old = e.oldVersion;
        if (old < 1) {
          db.createObjectStore('profiles', { keyPath: 'id' });
          const docs = db.createObjectStore('docs', { keyPath: 'id' }); docs.createIndex('profile', 'profileId');
          const chunks = db.createObjectStore('chunks', { keyPath: 'id' }); chunks.createIndex('doc', 'docId'); chunks.createIndex('profile', 'profileId');
          const sess = db.createObjectStore('sessions', { keyPath: 'id' }); sess.createIndex('profile', 'profileId');
          db.createObjectStore('kv', { keyPath: 'k' }); // ajustes globales y por perfil
        }
        if (old < 2) {
          db.createObjectStore('texts', { keyPath: 'docId' });            // texto completo de cada documento
          const t = db.createObjectStore('temas', { keyPath: 'id' }); t.createIndex('profile', 'profileId');
          const su = db.createObjectStore('supuestos', { keyPath: 'id' }); su.createIndex('profile', 'profileId');
          const at = db.createObjectStore('attempts', { keyPath: 'id' }); at.createIndex('profile', 'profileId'); at.createIndex('item', 'itemId');
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._db;
  },
  _tx(store, mode = 'readonly') { return this._db.transaction(store, mode).objectStore(store); },
  _req(rq) { return new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); },
  async put(store, val) { await this.open(); return this._req(this._tx(store, 'readwrite').put(val)); },
  async get(store, key) { await this.open(); return this._req(this._tx(store).get(key)); },
  async del(store, key) { await this.open(); return this._req(this._tx(store, 'readwrite').delete(key)); },
  async all(store) { await this.open(); return this._req(this._tx(store).getAll()); },
  async byIndex(store, idx, key) { await this.open(); return this._req(this._tx(store).index(idx).getAll(key)); },
  async clearAll() { await this.open(); for (const s of DB.stores) await this._req(this._tx(s, 'readwrite').clear()); }
};

/* ---------------------------------------------------------------------
   2 · ESTADO + AJUSTES
   --------------------------------------------------------------------- */
// Lista editable en Ajustes (revísala y complétala con la de tu convocatoria)
const NORMATIVA_DEF = `Ley Orgánica 2/2006, de Educación, modificada por la LO 3/2020 (LOMLOE)
Real Decreto 95/2022 (enseñanzas mínimas de Educación Infantil)
Real Decreto 157/2022 (enseñanzas mínimas de Educación Primaria)
Real Decreto 217/2022 (enseñanzas mínimas de ESO)
Decreto 80/2022 (currículo de Educación Infantil en Castilla-La Mancha)
Decreto 81/2022 (currículo de Educación Primaria en Castilla-La Mancha)
Decreto 82/2022 (currículo de ESO en Castilla-La Mancha)
Decreto 85/2018 (inclusión educativa del alumnado en Castilla-La Mancha)
Decreto 92/2022 (orientación académica, educativa y profesional en Castilla-La Mancha)`;
const State = {
  profile: null,          // perfil activo
  settings: null,         // ajustes del perfil activo
  docs: [],               // documentos del perfil
  session: null,          // sesión en curso
  async loadSettings() {
    const g = (await DB.get('kv', 'global'))?.v || {};
    const p = this.profile ? (await DB.get('kv', 'p:' + this.profile.id))?.v || {} : {};
    const cfg = window.ATRIL_CONFIG || {};   // clave preconfigurada en config.js (opcional)
    // Orden de prioridad: valores por defecto ← config.js ← ajustes globales ← ajustes del perfil
    this.settings = Object.assign({
      provider: 'gemini', apiKey: '', chatModel: 'gemini-flash-latest', embModel: 'gemini-embedding-2',
      ollamaUrl: 'http://localhost:11434', autoSpeak: true, voiceRate: 1, voiceName: '', theme: 'dark',
      fontScale: 1, examMinutes: 120, extraTime: 0, ocr: true, examDate: '2027-06-20', supMinutes: 120,
      normativaRef: NORMATIVA_DEF
    }, cfg, g, p);
    // Migración: modelos de Gemini ya retirados por Google → modelos vigentes
    if (this.settings.provider === 'gemini') {
      if (/^gemini-(1\.|2\.0)/.test(this.settings.chatModel || '')) this.settings.chatModel = 'gemini-flash-latest';
      if (/^(text-embedding-00|embedding-001)/.test(this.settings.embModel || '')) this.settings.embModel = 'gemini-embedding-2';
    }
    // Si config.js trae clave y el perfil aún no guardó ninguna, usa la de config
    if (cfg.apiKey && !p.apiKey) this.settings.apiKey = cfg.apiKey;
    return this.settings;
  },
  async saveSettings() {
    const s = this.settings;
    // El tema es global; el resto por perfil (permite distintas claves por usuario)
    await DB.put('kv', { k: 'global', v: { theme: s.theme, fontScale: s.fontScale } });
    if (this.profile) await DB.put('kv', { k: 'p:' + this.profile.id, v: s });
  }
};

/* ---------------------------------------------------------------------
   3 · CONECTORES DE IA (multiproveedor)
   Interfaz común: chat({system, messages}) → texto · embed([textos]) → vectores
   Añadir un proveedor = añadir una entrada aquí. Nada más cambia.
   --------------------------------------------------------------------- */
const Providers = {
  hint: {
    gemini: 'Consigue una clave gratuita en aistudio.google.com → «Get API key» (empieza por AQ. o AIza). Cubre chat, embeddings y lectura de PDF escaneados.',
    openai: 'Clave de platform.openai.com. Consume saldo de tu cuenta.',
    openrouter: 'Clave de openrouter.ai. Acceso a muchos modelos, algunos gratuitos.',
    anthropic: 'Clave de console.anthropic.com. Sin embeddings propios: el RAG usará el método local.',
    ollama: 'Ejecuta Ollama en tu equipo. Gratis y privado. Arráncalo con OLLAMA_ORIGINS="*" para permitir el navegador.'
  },
  defaults: {
    gemini: { chat: 'gemini-flash-latest', emb: 'gemini-embedding-2' },
    openai: { chat: 'gpt-4o-mini', emb: 'text-embedding-3-small' },
    openrouter: { chat: 'openrouter/auto', emb: '' },
    anthropic: { chat: 'claude-haiku-5-5', emb: '' },
    ollama: { chat: 'llama3.1', emb: 'nomic-embed-text' }
  },
  get(name) { return this['_' + name]; },
  canReadFiles() { return State.settings?.provider === 'gemini' && !!State.settings.apiKey; },
  // Pide JSON y lo interpreta con tolerancia
  async json(opts) {
    const raw = await this.chat({ ...opts, json: true });
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}'), a2 = raw.indexOf('['), b2 = raw.lastIndexOf(']');
    const useArr = a2 !== -1 && (a === -1 || a2 < a);
    return JSON.parse(useArr ? raw.slice(a2, b2 + 1) : raw.slice(a, b + 1));
  },

  async chat(opts) {
    const s = State.settings;
    const fn = this['_' + s.provider];
    if (!fn) throw new Error('Proveedor no disponible');
    return fn.chat.call(fn, opts, s);
  },
  async embed(texts) {
    const s = State.settings;
    const fn = this['_' + s.provider];
    if (s.provider !== 'ollama' && !s.apiKey) return null;   // sin clave: RAG local
    if (fn && fn.embed && s.embModel) { try { return await fn.embed.call(fn, texts, s); } catch (e) { console.warn('Embed falló, uso método local', e); } }
    return null; // → RAG usará TF-IDF local
  },

  _gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta/',
    // La clave va en cabecera (funciona con claves antiguas «AIza…» y nuevas «AQ.…»)
    async _post(path, body, s) {
      return fetch(this.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey }, body: JSON.stringify(body) });
    },
    // Si un modelo ha sido retirado, busca automáticamente el mejor disponible
    async resolveModel(kind, s) {
      const r = await fetch(this.base + 'models?pageSize=200', { headers: { 'x-goog-api-key': s.apiKey } });
      if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + (await r.text()).slice(0, 160));
      const list = (await r.json()).models || [];
      const ver = n => parseFloat((n.match(/(\d+(\.\d+)?)/) || [0, 0])[1]);
      if (kind === 'chat') {
        const ok = list.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => m.name.replace('models/', ''))
          .filter(n => /flash/.test(n) && !/(tts|image|live|audio|thinking|exp|embedding|robotics|computer)/.test(n));
        ok.sort((a, b) => (/preview/.test(a) - /preview/.test(b)) || (/lite/.test(a) - /lite/.test(b)) || ver(b) - ver(a));
        return ok[0];
      }
      const emb = list.filter(m => (m.supportedGenerationMethods || []).some(x => /embed/i.test(x))).map(m => m.name.replace('models/', ''));
      emb.sort((a, b) => (/preview|exp/.test(a) - /preview|exp/.test(b)) || ver(b) - ver(a));
      return emb[0];
    },
    async chat({ system, messages, files, json }, s) {
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      if (files && files.length) contents[contents.length - 1].parts.unshift(...files.map(f => ({ inlineData: { mimeType: f.mime, data: f.b64 } })));
      const body = { contents, generationConfig: { temperature: json ? 0.3 : 0.8 } };
      if (json) body.generationConfig.responseMimeType = 'application/json';
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      let r = await this._post('models/' + s.chatModel + ':generateContent', body, s);
      if (r.status === 404) {                         // modelo retirado → elegir otro y reintentar
        const alt = await this.resolveModel('chat', s);
        if (alt && alt !== s.chatModel) { s.chatModel = alt; State.saveSettings(); toast('Modelo actualizado a ' + alt, 'ok'); r = await this._post('models/' + alt + ':generateContent', body, s); }
      }
      if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    },
    async embed(texts, s) {
      const out = [];
      for (let i = 0; i < texts.length; i += 90) {
        const part = texts.slice(i, i + 90);
        const mk = m => ({ requests: part.map(t => ({ model: 'models/' + m, content: { parts: [{ text: t }] } })) });
        let r = await this._post('models/' + s.embModel + ':batchEmbedContents', mk(s.embModel), s);
        if (r.status === 404) {
          const alt = await this.resolveModel('emb', s);
          if (alt && alt !== s.embModel) { s.embModel = alt; State.saveSettings(); r = await this._post('models/' + alt + ':batchEmbedContents', mk(alt), s); }
        }
        if (!r.ok) throw new Error('embed ' + r.status);
        out.push(...(await r.json()).embeddings.map(e => e.values));
      }
      return out;
    }
  },
  _openai: {
    async chat({ system, messages }, s) {
      const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey }, body: JSON.stringify({ model: s.chatModel, messages: msgs, temperature: 0.8 }) });
      if (!r.ok) throw new Error('OpenAI ' + r.status + ': ' + (await r.text()).slice(0, 200));
      return (await r.json()).choices[0].message.content;
    },
    async embed(texts, s) {
      const r = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey }, body: JSON.stringify({ model: s.embModel, input: texts }) });
      if (!r.ok) throw new Error('embed ' + r.status);
      return (await r.json()).data.map(d => d.embedding);
    }
  },
  _openrouter: {
    async chat({ system, messages }, s) {
      const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey, 'HTTP-Referer': location.origin, 'X-Title': 'Atril' }, body: JSON.stringify({ model: s.chatModel, messages: msgs, temperature: 0.8 }) });
      if (!r.ok) throw new Error('OpenRouter ' + r.status + ': ' + (await r.text()).slice(0, 200));
      return (await r.json()).choices[0].message.content;
    }
  },
  _anthropic: {
    async chat({ system, messages }, s) {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: s.chatModel, max_tokens: 1024, system: system || undefined, messages }) });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      return (await r.json()).content.map(c => c.text || '').join('');
    }
  },
  _ollama: {
    async chat({ system, messages }, s) {
      const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
      const r = await fetch(s.ollamaUrl.replace(/\/$/, '') + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: s.chatModel, messages: msgs, stream: false }) });
      if (!r.ok) throw new Error('Ollama ' + r.status);
      return (await r.json()).message.content;
    },
    async embed(texts, s) {
      const out = [];
      for (const t of texts) {
        const r = await fetch(s.ollamaUrl.replace(/\/$/, '') + '/api/embeddings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: s.embModel, prompt: t }) });
        if (!r.ok) throw new Error('embed ' + r.status); out.push((await r.json()).embedding);
      }
      return out;
    }
  }
};

/* ---------------------------------------------------------------------
   4 · INGESTA DOCUMENTAL — extracción de texto por tipo
   --------------------------------------------------------------------- */
const Docs = {
  async extract(file) {
    const name = file.name.toLowerCase();
    const ext = name.split('.').pop();
    try {
      if (['txt', 'md', 'csv'].includes(ext)) return await file.text();
      if (['html', 'htm'].includes(ext)) { const d = new DOMParser().parseFromString(await file.text(), 'text/html'); return d.body.innerText; }
      if (ext === 'pdf') return await this._pdf(file);
      if (ext === 'docx') return await this._docx(file);
      if (['xlsx', 'xls'].includes(ext)) return await this._xlsx(file);
      if (ext === 'pptx') return await this._pptx(file);
      if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return (await this.ocr(file, file.type || 'image/jpeg')) || '[Imagen sin texto: configura Gemini en Ajustes para leer fotos de apuntes.]';
      if (ext === 'doc') return '[Los .doc antiguos no se leen en el navegador. Guárdalo como .docx o PDF.]';
      if (ext === 'epub') return await this._epub(file);
      return await file.text();
    } catch (e) { console.warn(e); return '[No se pudo extraer el texto de ' + file.name + ': ' + e.message + ']'; }
  },
  async _pdf(file) {
    await loadScript(window.__LIBS__.pdf);
    pdfjsLib.GlobalWorkerOptions.workerSrc = window.__LIBS__.pdfWorker;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i); const c = await pg.getTextContent();
      // Reconstruye líneas por posición vertical para conservar títulos y párrafos
      let line = '', lastY = null;
      for (const it of c.items) {
        const y = it.transform ? Math.round(it.transform[5]) : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { out += line.trimEnd() + '\n'; line = ''; }
        line += it.str; if (it.hasEOL) { out += line.trimEnd() + '\n'; line = ''; lastY = null; } else lastY = y;
      }
      out += line.trimEnd() + '\n\n';
    }
    out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    // PDF escaneado (sin capa de texto) → transcripción con IA
    if (out.replace(/\s/g, '').length < 80 * pdf.numPages) {
      const ocr = await this.ocr(file, 'application/pdf');
      if (ocr) return ocr;
      return out.trim() ? out : '[PDF escaneado sin texto. Configura Gemini en Ajustes para que la app pueda leerlo (OCR).]';
    }
    return out;
  },
  async ocr(file, mime) {
    if (!State.settings?.ocr || !Providers.canReadFiles()) return null;
    if (file.size > 18 * 1048576) { toast('Archivo demasiado grande para leerlo con IA (máx. 18 MB). Divídelo.', 'bad'); return null; }
    toast('Leyendo ' + file.name + ' con IA (escaneado)…');
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.onerror = rej; fr.readAsDataURL(file); });
    try {
      return await Providers.chat({ system: 'Eres un transcriptor exacto. Devuelve SOLO el texto del documento, literal, en su idioma original, respetando títulos, numeración de apartados y párrafos (un título por línea). No resumas ni comentes.', messages: [{ role: 'user', content: 'Transcribe el documento completo.' }], files: [{ mime, b64 }] });
    } catch (e) { console.warn(e); toast('No se pudo leer con IA: ' + e.message.slice(0, 80), 'bad'); return null; }
  },
  async _docx(file) { await loadScript(window.__LIBS__.mammoth); return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value; },
  async _xlsx(file) {
    await loadScript(window.__LIBS__.xlsx);
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return wb.SheetNames.map(n => '# ' + n + '\n' + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n\n');
  },
  async _pptx(file) {
    await loadScript(window.__LIBS__.jszip);
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slides = Object.keys(zip.files).filter(f => /ppt\/slides\/slide\d+\.xml$/.test(f)).sort();
    let out = '';
    for (const s of slides) { const xml = await zip.files[s].async('string'); const txt = (xml.match(/<a:t>(.*?)<\/a:t>/g) || []).map(m => m.replace(/<\/?a:t>/g, '')).join(' '); out += txt + '\n\n'; }
    return out || '[Presentación sin texto legible]';
  },
  async _epub(file) {
    await loadScript(window.__LIBS__.jszip);
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const html = Object.keys(zip.files).filter(f => /\.x?html?$/.test(f)).sort();
    let out = '';
    for (const h of html) { const d = new DOMParser().parseFromString(await zip.files[h].async('string'), 'text/html'); out += d.body.innerText + '\n\n'; }
    return out;
  },
  chunk(text, size = 900, overlap = 150) {
    const clean = text.replace(/\s+/g, ' ').trim();  // los fragmentos RAG no necesitan saltos de línea
    const out = []; let i = 0;
    while (i < clean.length) { out.push(clean.slice(i, i + size)); i += size - overlap; }
    return out.filter(c => c.trim().length > 40);
  },
  async ingest(file) {
    const text = await this.extract(file);
    const doc = { id: uid(), profileId: State.profile.id, name: file.name, type: file.name.split('.').pop().toLowerCase(), size: file.size, added: Date.now(), chars: text.length, tags: [], indexed: false, chunkCount: 0 };
    await DB.put('docs', doc);
    await DB.put('texts', { docId: doc.id, text });
    // Indexación RAG en segundo plano
    RAG.index(doc, text).then(() => renderDocs()).catch(e => { console.warn(e); toast('No se pudo indexar ' + file.name, 'bad'); });
    return doc;
  },
  async text(docId) { return (await DB.get('texts', docId))?.text || ''; }
};

/* ---------------------------------------------------------------------
   5 · RAG — vectorial con respaldo TF-IDF local
   --------------------------------------------------------------------- */
const RAG = {
  async index(doc, text) {
    const parts = Docs.chunk(text);
    if (!parts.length) { doc.indexed = true; doc.chunkCount = 0; await DB.put('docs', doc); return; }
    let vecs = null;
    try { vecs = await Providers.embed(parts); } catch (e) { vecs = null; }
    const chunks = parts.map((c, i) => ({ id: doc.id + ':' + i, docId: doc.id, profileId: doc.profileId, docName: doc.name, text: c, vec: vecs ? vecs[i] : null }));
    for (const ch of chunks) await DB.put('chunks', ch);
    doc.indexed = true; doc.chunkCount = chunks.length; doc.vector = !!vecs;
    await DB.put('docs', doc);
  },
  _cos(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9); },
  _tokens(s) { return (s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9áéíóúñ]{3,}/g) || []); },
  _tfidfScore(query, chunks) {
    const qt = this._tokens(query); const qset = {}; qt.forEach(t => qset[t] = (qset[t] || 0) + 1);
    const df = {}; chunks.forEach(c => { const seen = new Set(this._tokens(c.text)); seen.forEach(t => df[t] = (df[t] || 0) + 1); });
    const N = chunks.length;
    return chunks.map(c => { const ct = this._tokens(c.text); const tf = {}; ct.forEach(t => tf[t] = (tf[t] || 0) + 1); let score = 0; for (const t in qset) { if (tf[t]) score += (tf[t] / ct.length) * Math.log(1 + N / (df[t] || 1)); } return { c, score }; });
  },
  async retrieve(query, docIds, k = 4) {
    if (!docIds || !docIds.length) return [];
    let chunks = [];
    for (const id of docIds) chunks = chunks.concat(await DB.byIndex('chunks', 'doc', id));
    if (!chunks.length) return [];
    const withVec = chunks.filter(c => c.vec);
    if (withVec.length && withVec.length === chunks.length) {
      const qv = (await Providers.embed([query]))?.[0];
      if (qv && qv.length === chunks[0].vec.length) return chunks.map(c => ({ c, score: this._cos(qv, c.vec) })).sort((a, b) => b.score - a.score).slice(0, k).map(x => x.c);
    }
    return this._tfidfScore(query, chunks).sort((a, b) => b.score - a.score).slice(0, k).filter(x => x.score > 0).map(x => x.c);
  },
  buildContext(chunks) {
    if (!chunks.length) return { text: '', sources: [] };
    const sources = [...new Set(chunks.map(c => c.docName))];
    const text = chunks.map((c, i) => `[Fuente ${i + 1}: ${c.docName}]\n${c.text}`).join('\n\n');
    return { text, sources };
  }
};

/* ---------------------------------------------------------------------
   6 · VOZ — reconocimiento (STT), síntesis (TTS), silencios
   --------------------------------------------------------------------- */
const Voice = {
  rec: null, listening: false, onFinal: null, onInterim: null, onSilence: null,
  silenceTimer: null, lastText: '', voices: [],
  supported() { return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window; },
  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    this.rec = new SR();
    this.rec.lang = 'es-ES'; this.rec.continuous = true; this.rec.interimResults = true;
    this.rec.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript; }
      if (interim && this.onInterim) this.onInterim(interim);
      if (final) { this.lastText += final + ' '; this._resetSilence(); }
      else if (interim) this._resetSilence();
    };
    this.rec.onend = () => { if (this.listening) { try { this.rec.start(); } catch (e) {} } };
    this.rec.onerror = e => { if (e.error === 'not-allowed') toast('Permiso de micrófono denegado', 'bad'); };
    return true;
  },
  _resetSilence() { clearTimeout(this.silenceTimer); this.silenceTimer = setTimeout(() => { const t = this.lastText.trim(); if (t && this.onFinal) { this.lastText = ''; this.onFinal(t); } }, 1600); },
  start() { if (!this.rec && !this.init()) return false; this.listening = true; this.lastText = ''; try { this.rec.start(); } catch (e) {} return true; },
  stop() { this.listening = false; clearTimeout(this.silenceTimer); try { this.rec && this.rec.stop(); } catch (e) {} },
  loadVoices() { this.voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('es')); return this.voices; },
  speak(text, onEnd) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES'; u.rate = State.settings.voiceRate || 1;
    const v = this.voices.find(v => v.name === State.settings.voiceName); if (v) u.voice = v;
    u.onend = onEnd; speechSynthesis.speak(u);
  },
  shutUp() { speechSynthesis.cancel(); }
};

/* ---------------------------------------------------------------------
   7 · ANÁLISIS DEL DISCURSO — volumen (Web Audio) + métricas de texto
   --------------------------------------------------------------------- */
const Analyzer = {
  ctx: null, analyser: null, data: null, stream: null, levels: [], raf: null,
  fillers: ['eh', 'em', 'ehm', 'mmm', 'este', 'osea', 'o sea', 'pues', 'bueno', 'digamos', 'entonces', 'vale', 'a ver', 'como que', 'en plan'],
  async startAudio(onLevel) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 512;
      src.connect(this.analyser); this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.levels = [];
      const loop = () => {
        this.analyser.getByteFrequencyData(this.data);
        let sum = 0; for (const v of this.data) sum += v; const lvl = sum / this.data.length / 255;
        this.levels.push(lvl); onLevel && onLevel(lvl);
        this.raf = requestAnimationFrame(loop);
      };
      loop(); return true;
    } catch (e) { console.warn('Sin acceso a audio para volumen', e); return false; }
  },
  stopAudio() { cancelAnimationFrame(this.raf); if (this.stream) this.stream.getTracks().forEach(t => t.stop()); if (this.ctx) this.ctx.close(); this.stream = this.ctx = null; },
  volumeStats() {
    const l = this.levels.filter(x => x > 0.01); if (!l.length) return { avg: 0, variability: 0 };
    const avg = l.reduce((a, b) => a + b, 0) / l.length;
    const varr = Math.sqrt(l.reduce((a, b) => a + (b - avg) ** 2, 0) / l.length);
    return { avg: +(avg * 100).toFixed(0), variability: +(varr * 100).toFixed(1) };
  },
  textMetrics(userTurns) {
    const all = userTurns.join(' ');
    const words = (all.match(/\S+/g) || []).length;
    const lower = ' ' + all.toLowerCase().replace(/[.,;:¡!¿?()]/g, ' ') + ' ';
    let fillerCount = 0; const detail = {};
    for (const f of this.fillers) { const m = lower.match(new RegExp('\\s' + f.replace(/ /g, '\\s') + '\\s', 'g')); if (m) { fillerCount += m.length; detail[f] = m.length; } }
    const sentences = (all.match(/[.!?]+/g) || []).length || 1;
    const uniqueWords = new Set((all.toLowerCase().match(/[a-záéíóúñ]{3,}/g) || [])).size;
    const lexRichness = words ? +(uniqueWords / words * 100).toFixed(1) : 0;
    return { words, fillerCount, fillerDetail: detail, sentences, avgSentenceLen: +(words / sentences).toFixed(1), lexRichness };
  }
};

/* ---------------------------------------------------------------------
   8 · MODOS DE ENTRENAMIENTO
   --------------------------------------------------------------------- */
const Modes = [
  { id: 'oposicion', mic: '🎓', name: 'Oposición', desc: 'Tribunal de oposición docente. Preguntas exigentes y repreguntas.', role: 'un tribunal de oposiciones al cuerpo de maestros/profesores' },
  { id: 'defprog', mic: '📘', name: 'Defensa de programación', desc: 'Defiendes tu programación didáctica ante el tribunal.', role: 'un tribunal que evalúa la defensa de una programación didáctica' },
  { id: 'defud', mic: '📗', name: 'Defensa de unidad', desc: 'Expones y defiendes una unidad didáctica.', role: 'un tribunal que evalúa la exposición de una unidad didáctica' },
  { id: 'supuesto', mic: '🧩', name: 'Supuesto práctico', desc: 'Resuelves en voz alta un caso práctico de aula.', role: 'un examinador que plantea un supuesto práctico y evalúa tu resolución oral' },
  { id: 'tribunal', mic: '⚖️', name: 'Simulación de tribunal', desc: 'Tribunal completo con varios miembros y turnos.', role: 'un tribunal formado por tres miembros con estilos distintos (rigurosa, cercana, técnico)' },
  { id: 'inspector', mic: '🔎', name: 'Inspector educativo', desc: 'Visita de inspección: justificas tu práctica y normativa.', role: 'un inspector de educación que revisa tu práctica docente y su encaje normativo' },
  { id: 'entrevista', mic: '💼', name: 'Entrevista', desc: 'Entrevista para un puesto o proyecto educativo.', role: 'un entrevistador para un puesto docente o de coordinación' },
  { id: 'reunion', mic: '👥', name: 'Reunión docente', desc: 'Reunión de equipo: defiendes propuestas y acuerdos.', role: 'un compañero de claustro en una reunión de equipo docente' },
  { id: 'claustro', mic: '🏫', name: 'Claustro', desc: 'Intervienes ante el claustro con una propuesta.', role: 'el claustro de un centro que escucha y cuestiona tu propuesta' },
  { id: 'debate', mic: '💬', name: 'Debate', desc: 'Defiendes una postura frente a objeciones.', role: 'un contertulio que debate contigo y rebate tus argumentos con respeto' },
  { id: 'conferencia', mic: '🎤', name: 'Conferencia', desc: 'Das una charla y respondes al turno de preguntas.', role: 'el público de una conferencia que hace preguntas al final' },
  { id: 'exposicion', mic: '📊', name: 'Exposición', desc: 'Presentación estructurada de un tema.', role: 'un oyente que evalúa la claridad y estructura de tu exposición' },
  { id: 'formacion', mic: '🧑‍🏫', name: 'Formación del profesorado', desc: 'Impartes formación a otros docentes.', role: 'un grupo de docentes en una sesión de formación que tú impartes' },
  { id: 'aleatorio', mic: '🎲', name: 'Preguntas aleatorias', desc: 'Ráfaga de preguntas imprevisibles para improvisar.', role: 'un examinador que lanza preguntas variadas e imprevisibles para entrenar la improvisación' },
  { id: 'libre', mic: '🕊️', name: 'Modo libre', desc: 'Conversación abierta sobre lo que quieras practicar.', role: 'un interlocutor profesional flexible que se adapta a lo que quieras practicar' }
];

/* ---------------------------------------------------------------------
   9 · SESIÓN — orquesta voz + IA + RAG + análisis
   --------------------------------------------------------------------- */
const Session = {
  data: null,
  buildSystemPrompt(mode, diff, topic, ragSources) {
    const level = { suave: 'Sé amable y alentador; guía con pistas cuando dude.', medio: 'Mantén un tono realista y profesional.', alto: 'Sé exigente y riguroso, como un tribunal duro, pero justo.' }[diff];
    return `Eres ${mode.role}. Hablas SIEMPRE en español de España, con lenguaje natural y oral, en turnos BREVES (2-4 frases) como en una conversación hablada real. Tu objetivo es entrenar la comunicación oral de un/a docente y aumentar su seguridad al hablar.

Contexto educativo: metodologías activas, inclusión, DUA, evaluación, organización escolar, liderazgo pedagógico, innovación y legislación educativa (LOMLOE y normativa de Castilla-La Mancha cuando proceda).

Reglas:
- Haz UNA pregunta o intervención cada vez y espera la respuesta.
- Repregunta cuando detectes vaguedad, falta de fundamentación o errores.
- Adapta la dificultad. ${level}
- No des sermones ni listas largas: es una conversación por voz.
- ${topic ? 'Tema de la sesión: ' + topic + '.' : 'Empieza pidiendo brevemente sobre qué quiere que le examines/converses.'}
${ragSources.length ? '- Cuando uses la documentación aportada, cita la fuente entre paréntesis, p. ej. (según ' + ragSources[0] + ').' : ''}
Empieza tú con una primera intervención breve para abrir la sesión.`;
  },
  async begin({ mode, diff, topic, docIds, voice }) {
    this.data = { id: uid(), profileId: State.profile.id, mode: mode.id, modeName: mode.name, diff, topic, docIds, voice, started: Date.now(), turns: [], history: [] };
    State.session = this.data;
    UI.showLive();
    // audio para volumen (solo modo voz)
    if (voice && Voice.supported()) { await Analyzer.startAudio(lvl => UI.vu(lvl)); Voice.init(); }
    let sys = this.buildSystemPrompt(mode, diff, topic, []);
    if (State.sessionExtra) { sys += '\n\n' + State.sessionExtra; State.sessionExtra = null; }
    this.data.system = sys;
    UI.status('Pensando…');
    let opening;
    try { opening = await Providers.chat({ system: sys, messages: [{ role: 'user', content: '(Abre la sesión ahora)' }] }); }
    catch (e) { opening = this._noKeyMsg(e); }
    this.data.history.push({ role: 'user', content: '(Abre la sesión ahora)' }, { role: 'assistant', content: opening });
    this.addTurn('ai', opening);
    this.aiSpeak(opening, () => this.listen());
  },
  _noKeyMsg(e) {
    return State.settings.apiKey || State.settings.provider === 'ollama'
      ? 'Hubo un problema al contactar con la IA (' + (e?.message || '') + '). Puedes seguir practicando: te escucho y analizaré tu discurso igualmente.'
      : 'Aún no has configurado una clave de IA en Ajustes, así que hoy haré de oyente silencioso: habla con normalidad y al terminar analizaré tu discurso (ritmo, muletillas, claridad…). Cuando añadas una clave, además te repreguntaré.';
  },
  aiSpeak(text, done) {
    if (this.data.voice && State.settings.autoSpeak) { UI.orb('speaking'); UI.status('Hablando…'); Voice.shutUp(); Voice.speak(text, () => { UI.orb('idle'); done && done(); }); }
    else { done && done(); }
  },
  listen() {
    if (!this.data.voice) { UI.status('Escribe tu intervención abajo.'); return; }
    UI.orb('listening'); UI.status('Te escucho…'); UI.ring(true);
    Voice.onInterim = t => UI.interim(t);
    Voice.onFinal = t => { UI.ring(false); this.userSaid(t); };
    Voice.start();
  },
  async userSaid(text) {
    Voice.stop(); UI.clearInterim();
    this.data.turns.push({ role: 'user', text, at: Date.now() });
    this.data.history.push({ role: 'user', content: text });
    this.addTurn('user', text);
    UI.orb('idle'); UI.status('Pensando…');
    // RAG
    let ragNote = '';
    if (this.data.docIds?.length) {
      const chunks = await RAG.retrieve(text, this.data.docIds, 4);
      const ctx = RAG.buildContext(chunks);
      if (ctx.text) ragNote = `\n\n[Documentación de apoyo para responder/repreguntar — cita la fuente si la usas]\n${ctx.text}`;
    }
    let reply;
    try {
      const msgs = [...this.data.history];
      if (ragNote) msgs[msgs.length - 1] = { role: 'user', content: text + ragNote };
      reply = await Providers.chat({ system: this.data.system, messages: msgs });
    } catch (e) { reply = 'Sigo escuchándote. (' + (e?.message || 'sin IA') + ')'; }
    this.data.history.push({ role: 'assistant', content: reply });
    this.data.turns.push({ role: 'ai', text: reply, at: Date.now() });
    this.addTurn('ai', reply);
    this.aiSpeak(reply, () => this.listen());
  },
  addTurn(who, text) { UI.addTurn(who, text); },
  pause() { Voice.stop(); Voice.shutUp(); UI.orb('idle'); UI.ring(false); UI.status('En pausa. Pulsa reanudar.'); },
  async end() {
    Voice.stop(); Voice.shutUp(); Analyzer.stopAudio();
    UI.status('Analizando tu intervención…');
    const userTurns = this.data.turns.filter(t => t.role === 'user').map(t => t.text);
    const durationMin = (Date.now() - this.data.started) / 60000;
    const tm = Analyzer.textMetrics(userTurns);
    const vol = Analyzer.volumeStats();
    const wpm = durationMin > 0.1 && tm.words ? Math.round(tm.words / durationMin) : 0;
    const metrics = { durationMin: +durationMin.toFixed(1), wpm, ...tm, volume: vol };
    const feedback = await Feedback.analyze(this.data, metrics);
    const record = { ...this.data, ended: Date.now(), metrics, feedback };
    delete record.system; delete record.history;
    await DB.put('sessions', record);
    UI.showReport(record);
    State.session = null;
  }
};

/* ---------------------------------------------------------------------
   10 · RETROALIMENTACIÓN — IA estructurada + respaldo por reglas
   --------------------------------------------------------------------- */
const Feedback = {
  dims: ['claridad', 'estructura', 'argumentacion', 'ritmo', 'seguridad', 'precision_tecnica', 'riqueza_lexica', 'uso_normativa'],
  async analyze(session, metrics) {
    const transcript = session.turns.map(t => (t.role === 'user' ? 'DOCENTE: ' : 'INTERLOCUTOR: ') + t.text).join('\n');
    const objMetrics = `Métricas objetivas medidas: ${metrics.words} palabras, ritmo ${metrics.wpm} ppm (ideal 110-160), ${metrics.fillerCount} muletillas, riqueza léxica ${metrics.lexRichness}%, frases de ${metrics.avgSentenceLen} palabras de media, volumen medio ${metrics.volume.avg}/100.`;
    if (State.settings.apiKey || State.settings.provider === 'ollama') {
      try {
        const sys = `Eres un evaluador experto en comunicación oral docente y oposiciones en España. Analiza la intervención del DOCENTE (ignora la calidad del interlocutor). Devuelve EXCLUSIVAMENTE un JSON válido, sin texto alrededor, con esta forma exacta:
{"global":0-100,"scores":{"claridad":0-100,"estructura":0-100,"argumentacion":0-100,"ritmo":0-100,"seguridad":0-100,"precision_tecnica":0-100,"riqueza_lexica":0-100,"uso_normativa":0-100},"fortalezas":["..."],"mejoras":["..."],"errores":["..."],"ejercicios":["..."],"resumen":"2-3 frases"}
Usa las métricas objetivas para ritmo, riqueza y (parcialmente) seguridad. Sé concreto y accionable, en español de España.`;
        const raw = await Providers.chat({ system: sys, messages: [{ role: 'user', content: objMetrics + '\n\nTRANSCRIPCIÓN:\n' + transcript }] });
        const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
        const fb = JSON.parse(json);
        fb.source = 'ia'; return fb;
      } catch (e) { console.warn('Feedback IA falló, uso reglas', e); }
    }
    return this._rules(metrics);
  },
  _rules(m) {
    const ritmo = m.wpm === 0 ? 60 : clamp(100 - Math.abs(135 - m.wpm) * 1.2, 20, 100);
    const fillerPenalty = m.words ? clamp(m.fillerCount / m.words * 100, 0, 40) : 0;
    const seguridad = clamp(80 - fillerPenalty * 1.5, 20, 95);
    const riqueza = clamp(m.lexRichness * 1.4, 20, 100);
    const scores = { claridad: clamp(75 - fillerPenalty, 30, 95), estructura: 70, argumentacion: 70, ritmo, seguridad, precision_tecnica: 70, riqueza_lexica: riqueza, uso_normativa: 65 };
    const global = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / this.dims.length);
    const mejoras = [], fortalezas = [], errores = [], ejercicios = [];
    if (m.wpm && m.wpm > 165) mejoras.push('Hablas rápido (' + m.wpm + ' ppm). Marca pausas al cambiar de idea.');
    else if (m.wpm && m.wpm < 105) mejoras.push('Ritmo algo lento (' + m.wpm + ' ppm). Gana algo de energía.');
    else if (m.wpm) fortalezas.push('Buen ritmo de habla (' + m.wpm + ' ppm).');
    if (m.fillerCount > 3) { errores.push('Muletillas detectadas: ' + m.fillerCount + '. Las más frecuentes conviene sustituirlas por una pausa breve.'); ejercicios.push('Repite la intervención grabándote y cuenta cada muletilla; intenta bajarla a la mitad.'); }
    else fortalezas.push('Pocas muletillas: discurso limpio.');
    if (m.lexRichness > 55) fortalezas.push('Vocabulario variado (riqueza ' + m.lexRichness + '%).');
    else mejoras.push('Amplía el vocabulario técnico-pedagógico para sonar más preciso.');
    ejercicios.push('Prepara un guion de 3 puntos y defiéndelo en 90 segundos sin notas.');
    return { global, scores, fortalezas, mejoras, errores, ejercicios, resumen: 'Análisis basado en métricas objetivas de tu discurso. Configura una clave de IA en Ajustes para obtener además una valoración cualitativa del contenido.', source: 'reglas' };
  }
};

/* ---------------------------------------------------------------------
   11 · GRÁFICOS (SVG a mano, sin dependencias)
   --------------------------------------------------------------------- */
const Chart = {
  line(data, { color = 'var(--brass)', h = 160, fmt = v => v } = {}) {
    if (!data.length) return '<div class="empty">Sin datos todavía</div>';
    const w = 640, pad = 30; const max = Math.max(...data, 1), min = Math.min(...data, 0);
    const rng = max - min || 1;
    const pts = data.map((v, i) => [pad + i * (w - pad * 2) / Math.max(data.length - 1, 1), h - pad - (v - min) / rng * (h - pad * 2)]);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = path + ` L${pts.at(-1)[0].toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`;
    const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${color}"/>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px" preserveAspectRatio="none">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--line)"/>
      <path d="${area}" fill="${color}" opacity=".12"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}
      <text x="${pad}" y="16" fill="var(--text-mute)" font-size="12" font-family="var(--font-mono)">${fmt(max)}</text>
      <text x="${pad}" y="${h - pad + 18}" fill="var(--text-mute)" font-size="12" font-family="var(--font-mono)">${fmt(min)}</text>
    </svg>`;
  },
  bars(data, { color = 'var(--signal)', h = 160 } = {}) {
    if (!data.length) return '<div class="empty">Sin datos todavía</div>';
    const w = 640, pad = 30, max = Math.max(...data, 1);
    const bw = (w - pad * 2) / data.length * 0.6, gap = (w - pad * 2) / data.length;
    const bars = data.map((v, i) => { const bh = v / max * (h - pad * 2); return `<rect x="${(pad + i * gap + gap * 0.2).toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${color}"/>`; }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px"><line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--line)"/>${bars}<text x="${pad}" y="16" fill="var(--text-mute)" font-size="12" font-family="var(--font-mono)">${max}</text></svg>`;
  }
};

/* ---------------------------------------------------------------------
   12 · UI / ROUTER / VISTAS
   --------------------------------------------------------------------- */
const UI = {
  selectedMode: null,
  init() {
    // navegación
    $$('.nav-item[data-view], [data-view]').forEach(b => b.addEventListener('click', () => this.go(b.dataset.view)));
    $('#ham')?.addEventListener('click', () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('on'); });
    $('#installBtn')?.addEventListener('click', doInstall);
    $('#scrim')?.addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('on'); });
    this.bindSettings(); this.bindLibrary(); this.bindSession(); this.bindStats(); this.bindProfiles();
    speechSynthesis.onvoiceschanged = () => { Voice.loadVoices(); this.fillVoices(); };
  },
  go(view) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-' + view)?.classList.add('active');
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('on');
    $('#main').scrollTop = 0;
    if (view === 'inicio') renderHome();
    if (view === 'biblioteca') renderDocs();
    if (view === 'stats') renderStats();
    if (view === 'sesion') { this.resetSession(); renderModes(); renderRagPicker(); }
    if (window.Estudio) Estudio.onView(view);
  },
  /* --- sesión --- */
  bindSession() {
    $('#startBtn').onclick = () => this.launch(true);
    $('#startTextBtn').onclick = () => this.launch(false);
    $('#endBtn').onclick = () => Session.end();
    $('#pauseBtn').onclick = () => { if (Voice.listening) { Session.pause(); $('#pauseBtn').textContent = '▶ Reanudar'; } else { Session.listen(); $('#pauseBtn').textContent = '⏸ Pausar escucha'; } };
    $('#sendText').onclick = () => this.sendText();
    $('#textInput').addEventListener('keydown', e => { if (e.key === 'Enter') this.sendText(); });
  },
  sendText() { const v = $('#textInput').value.trim(); if (!v) return; $('#textInput').value = ''; Session.userSaid(v); },
  async launch(voice) {
    if (!this.selectedMode) { toast('Elige primero un modo', 'bad'); return; }
    if (voice && !Voice.supported()) { toast('Este navegador no reconoce voz. Usa Chrome/Edge o el modo escrito.', 'bad'); voice = false; }
    const docIds = $$('#ragPicker input:checked').map(c => c.value);
    const mode = Modes.find(m => m.id === this.selectedMode);
    $('#textInputWrap').style.display = voice ? 'none' : 'flex';
    $('#pauseBtn').style.display = voice ? '' : 'none';
    await Session.begin({ mode, diff: $('#difficulty').value, topic: $('#sessionTopic').value.trim(), docIds, voice });
  },
  resetSession() { $('#sesionSetup').style.display = ''; $('#sesionLive').style.display = 'none'; $('#sesionReport').style.display = 'none'; $('#transcript').innerHTML = ''; },
  showLive() { $('#sesionSetup').style.display = 'none'; $('#sesionReport').style.display = 'none'; $('#sesionLive').style.display = ''; $('#vu').innerHTML = Array(9).fill('<i></i>').join(''); },
  orb(state) { const o = $('#orb'); o.className = 'orb ' + (state === 'speaking' ? 'speaking' : state === 'listening' ? '' : 'idle'); },
  ring(on) { $('#orbRing').classList.toggle('pulse', on); },
  status(t) { $('#sessionStatus').textContent = t; },
  vu(lvl) { const bars = $$('#vu i'); const n = bars.length; bars.forEach((b, i) => { const d = 1 - Math.abs(i - (n - 1) / 2) / n; b.style.height = (6 + lvl * 90 * (0.5 + d)) + 'px'; }); },
  interim(t) { let n = $('#interimTurn'); if (!n) { n = el('div', { class: 'turn user', id: 'interimTurn' }, '<div class="who">Tú</div><div class="bubble interim"></div>'); $('#transcript').appendChild(n); } n.querySelector('.bubble').textContent = t; this._scroll(); },
  clearInterim() { $('#interimTurn')?.remove(); },
  addTurn(who, text) { this.clearInterim(); const t = el('div', { class: 'turn ' + who }, `<div class="who">${who === 'ai' ? 'IA' : 'Tú'}</div><div class="bubble">${esc(text)}</div>`); $('#transcript').appendChild(t); this._scroll(); },
  _scroll() { const t = $('#transcript'); t.scrollTop = t.scrollHeight; },
  showReport(rec) {
    $('#sesionLive').style.display = 'none';
    const fb = rec.feedback, m = rec.metrics;
    const dimName = { claridad: 'Claridad', estructura: 'Estructura', argumentacion: 'Argumentación', ritmo: 'Ritmo', seguridad: 'Seguridad', precision_tecnica: 'Precisión técnica', riqueza_lexica: 'Riqueza léxica', uso_normativa: 'Uso de normativa' };
    const gauges = Object.entries(fb.scores || {}).map(([k, v]) => `<div class="gauge"><div class="top"><span>${dimName[k] || k}</span><b>${v}</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`).join('');
    const list = (arr, color) => (arr && arr.length) ? `<ul class="fb-list">${arr.map(x => `<li><span class="dot" style="background:${color}"></span><span>${esc(x)}</span></li>`).join('')}</ul>` : '<p class="muted" style="font-size:13px">—</p>';
    $('#sesionReport').style.display = '';
    $('#sesionReport').innerHTML = `
      <div class="view-head"><div class="eyebrow">${esc(rec.modeName)} · ${fmtDate(rec.started)}</div><h1>Informe de la sesión</h1></div>
      <div class="grid cols-4">
        <div class="card stat"><div class="n" style="color:var(--brass)">${fb.global}</div><div class="l">Puntuación global</div></div>
        <div class="card stat"><div class="n">${m.wpm || '—'}</div><div class="l">Palabras / min</div></div>
        <div class="card stat"><div class="n">${m.fillerCount}</div><div class="l">Muletillas</div></div>
        <div class="card stat"><div class="n">${m.durationMin}′</div><div class="l">Duración</div></div>
      </div>
      <div class="card" style="margin-top:16px"><p style="font-size:15px">${esc(fb.resumen || '')}</p>${fb.source === 'reglas' ? '<p class="hint" style="margin-top:10px">💡 Configura una clave de IA en Ajustes para una valoración cualitativa del contenido, además de estas métricas.</p>' : ''}</div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card"><h3 style="margin-bottom:16px">Dimensiones</h3><div style="display:flex;flex-direction:column;gap:14px">${gauges || '<p class="muted">—</p>'}</div></div>
        <div class="card"><h3 style="margin-bottom:10px" style="color:var(--ok)">Fortalezas</h3>${list(fb.fortalezas, 'var(--ok)')}
          <h3 style="margin:18px 0 10px">Aspectos a mejorar</h3>${list(fb.mejoras, 'var(--warn)')}</div>
      </div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card"><h3 style="margin-bottom:10px">Errores detectados</h3>${list(fb.errores, 'var(--bad)')}</div>
        <div class="card"><h3 style="margin-bottom:10px">Ejercicios propuestos</h3>${list(fb.ejercicios, 'var(--signal)')}</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px"><button class="btn primary" onclick="UI.go('sesion')">Nueva sesión</button><button class="btn" onclick="UI.go('stats')">Ver progreso</button></div>`;
    $('#main').scrollTop = 0;
  },
  /* --- ajustes --- */
  bindSettings() {
    const s = () => State.settings;
    $('#provider').onchange = e => { const p = e.target.value; s().provider = p; s().chatModel = Providers.defaults[p].chat; s().embModel = Providers.defaults[p].emb; this.fillSettings(); State.saveSettings(); };
    $('#apiKey').onchange = e => { s().apiKey = e.target.value.trim(); State.saveSettings(); toast('Clave guardada', 'ok'); Health.check(); };
    $('#chatModel').onchange = e => { s().chatModel = e.target.value.trim(); State.saveSettings(); };
    $('#embModel').onchange = e => { s().embModel = e.target.value.trim(); State.saveSettings(); };
    $('#ollamaUrl').onchange = e => { s().ollamaUrl = e.target.value.trim(); State.saveSettings(); };
    $('#voiceSel').onchange = e => { s().voiceName = e.target.value; State.saveSettings(); };
    $('#voiceRate').onchange = e => { s().voiceRate = +e.target.value; State.saveSettings(); };
    $('#autoSpeak').onchange = e => { s().autoSpeak = e.target.checked; State.saveSettings(); };
    $('#fontScale') && ($('#fontScale').onchange = e => { s().fontScale = +e.target.value; applyTheme(); State.saveSettings(); });
    $('#examMinutes') && ($('#examMinutes').onchange = e => { s().examMinutes = +e.target.value || 120; State.saveSettings(); });
    $('#extraTime') && ($('#extraTime').onchange = e => { s().extraTime = +e.target.value || 0; State.saveSettings(); });
    $('#ocrToggle') && ($('#ocrToggle').onchange = e => { s().ocr = e.target.checked; State.saveSettings(); });
    $('#themeToggle').onclick = () => { s().theme = s().theme === 'dark' ? 'light' : 'dark'; applyTheme(); State.saveSettings(); };
    $('#wipeBtn').onclick = async () => { if (await modal('Borrar todos los datos', '<p style="font-size:14px">Se eliminarán todos los perfiles, documentos, sesiones y ajustes de este dispositivo. No se puede deshacer.</p>', [{ label: 'Cancelar', value: false }, { label: 'Borrar todo', cls: 'danger', value: true }])) { await DB.clearAll(); location.reload(); } };
    $('#testProvider').onclick = async () => { $('#testProvider').textContent = 'Probando…'; $('#testProvider').disabled = true; try { const r = await Providers.chat({ system: 'Responde solo: OK', messages: [{ role: 'user', content: 'di OK' }] }); toast('Conexión correcta: ' + r.slice(0, 40), 'ok'); } catch (e) { toast('Falló: ' + e.message, 'bad'); } $('#testProvider').textContent = 'Probar conexión'; $('#testProvider').disabled = false; };
  },
  fillSettings() {
    const s = State.settings;
    $('#provider').value = s.provider; $('#apiKey').value = s.apiKey; $('#chatModel').value = s.chatModel;
    $('#embModel').value = s.embModel; $('#ollamaUrl').value = s.ollamaUrl; $('#voiceRate').value = s.voiceRate;
    $('#autoSpeak').checked = s.autoSpeak; $('#providerHint').textContent = Providers.hint[s.provider] || '';
    $('#keyField').style.display = s.provider === 'ollama' ? 'none' : '';
    $('#ollamaUrlField').style.display = s.provider === 'ollama' ? '' : 'none';
    $('#themeToggle').textContent = s.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    if ($('#fontScale')) $('#fontScale').value = s.fontScale || 1;
    if ($('#examMinutes')) $('#examMinutes').value = s.examMinutes || 120;
    if ($('#extraTime')) $('#extraTime').value = s.extraTime || 0;
    if ($('#ocrToggle')) $('#ocrToggle').checked = s.ocr !== false;
    this.fillVoices();
  },
  fillVoices() {
    const vs = Voice.loadVoices(); const sel = $('#voiceSel'); if (!sel) return;
    sel.innerHTML = '<option value="">Voz por defecto del sistema</option>' + vs.map(v => `<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('');
    if (State.settings) sel.value = State.settings.voiceName || '';
  },
  /* --- biblioteca --- */
  bindLibrary() {
    const dz = $('#dropzone'), fi = $('#fileInput');
    dz.onclick = () => fi.click();
    fi.onchange = () => this.handleFiles(fi.files);
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => this.handleFiles(e.dataTransfer.files));
    $('#docSearch').oninput = () => renderDocs();
  },
  async handleFiles(files) {
    if (!State.profile) { toast('Crea un perfil primero', 'bad'); return; }
    for (const f of files) { toast('Procesando ' + f.name + '…'); try { await Docs.ingest(f); } catch (e) { toast('Error con ' + f.name, 'bad'); } }
    renderDocs();
  },
  /* --- stats --- */
  bindStats() {
    $('#exportJson').onclick = () => exportData();
    $('#importJson') && ($('#importJson').onchange = e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });
    $('#exportReport').onclick = () => window.print();
  },
  /* --- perfiles --- */
  bindProfiles() { $('#newProfileBtn').onclick = () => createProfile(); }
};

/* ---------------------------------------------------------------------
   13 · RENDERIZADO DE VISTAS
   --------------------------------------------------------------------- */
function applyTheme() { document.documentElement.dataset.theme = State.settings.theme === 'light' ? 'light' : 'dark'; document.documentElement.style.setProperty('--fs', State.settings.fontScale || 1); UI.fillSettings && $('#themeToggle') && ($('#themeToggle').textContent = State.settings.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'); }

async function renderHome() {
  if (!State.profile) return;
  const sessions = (await DB.byIndex('sessions', 'profile', State.profile.id)).sort((a, b) => b.started - a.started);
  const docs = await DB.byIndex('docs', 'profile', State.profile.id);
  const totalMin = sessions.reduce((a, s) => a + (s.metrics?.durationMin || 0), 0);
  const avg = sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.feedback?.global || 0), 0) / sessions.length) : 0;
  $('#greet').textContent = saludo() + ', ' + State.profile.name.split(' ')[0];
  $('#homeStats').innerHTML = [
    ['Sesiones', sessions.length], ['Puntuación media', avg || '—'], ['Minutos hablando', Math.round(totalMin)], ['Documentos', docs.length]
  ].map(([l, n]) => `<div class="card stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  $('#recentSessions').innerHTML = sessions.length ? sessions.slice(0, 5).map(s => `
    <div class="doc-row"><div class="ic">${s.feedback?.global ?? '·'}</div>
    <div class="info"><b>${esc(s.modeName)}</b><span>${fmtDate(s.started)} · ${s.metrics?.wpm || 0} ppm · ${s.metrics?.fillerCount || 0} muletillas</span></div></div>`).join('')
    : '<div class="empty">Aún no has entrenado. Tu historial aparecerá aquí.</div>';
}
function saludo() { const h = new Date().getHours(); return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'; }

function renderModes() {
  const g = $('#modeGrid');
  g.innerHTML = Modes.map(m => `<button class="mode-card ${UI.selectedMode === m.id ? 'sel' : ''}" data-mode="${m.id}"><span class="mic">${m.mic}</span><b>${m.name}</b><span>${m.desc}</span></button>`).join('');
  $$('#modeGrid .mode-card').forEach(c => c.onclick = () => { UI.selectedMode = c.dataset.mode; renderModes(); });
}
async function renderRagPicker() {
  const docs = State.profile ? await DB.byIndex('docs', 'profile', State.profile.id) : [];
  const ready = docs.filter(d => d.indexed);
  $('#ragPicker').innerHTML = ready.length
    ? ready.map(d => `<label class="tag" style="cursor:pointer;margin:0 6px 6px 0"><input type="checkbox" value="${d.id}" style="width:auto;margin-right:6px"/>${esc(d.name)}</label>`).join('')
    : '<span class="muted" style="font-size:13px">No hay documentos indexados. Súbelos en la Biblioteca para usarlos como apoyo.</span>';
}
async function renderDocs() {
  if (!State.profile) { $('#docList').innerHTML = '<div class="empty">Crea un perfil para tener biblioteca.</div>'; return; }
  const q = ($('#docSearch').value || '').toLowerCase();
  let docs = (await DB.byIndex('docs', 'profile', State.profile.id)).sort((a, b) => b.added - a.added);
  if (q) docs = docs.filter(d => d.name.toLowerCase().includes(q));
  $('#docCount').textContent = docs.length ? '· ' + docs.length : '';
  $('#docList').innerHTML = docs.length ? docs.map(d => {
    const color = d.indexed ? (d.vector ? 'var(--ok)' : 'var(--warn)') : 'var(--text-mute)';
    const title = d.indexed ? (d.vector ? 'Indexado (vectorial) · ' + d.chunkCount + ' fragmentos' : 'Indexado (local) · ' + d.chunkCount + ' fragmentos') : 'Indexando…';
    return `<div class="doc-row"><div class="ic">${d.type.slice(0, 4).toUpperCase()}</div>
      <div class="info"><b>${esc(d.name)}</b><span>${bytes(d.size)} · ${d.chars.toLocaleString('es')} caracteres · ${title}</span></div>
      <span class="rag-dot" style="background:${color}" title="${title}"></span>
      <button class="btn ghost" style="padding:8px 12px" onclick="delDoc('${d.id}')">Eliminar</button></div>`;
  }).join('') : '<div class="empty">Biblioteca vacía. Sube tus documentos arriba.</div>';
}
async function delDoc(id) {
  if (!await modal('Eliminar documento', '<p style="font-size:14px">Se borrará el documento y su texto. Los temas que lo usen conservarán su copia.</p>', [{ label: 'Cancelar', value: false }, { label: 'Eliminar', cls: 'danger', value: true }])) return;
  await DB.del('docs', id); await DB.del('texts', id);
  const chunks = await DB.byIndex('chunks', 'doc', id);
  for (const c of chunks) await DB.del('chunks', c.id);
  renderDocs(); toast('Documento eliminado');
}
async function renderStats() {
  if (!State.profile) return;
  const sessions = (await DB.byIndex('sessions', 'profile', State.profile.id)).sort((a, b) => a.started - b.started);
  const scores = sessions.map(s => s.feedback?.global || 0);
  const wpm = sessions.map(s => s.metrics?.wpm || 0);
  const fillers = sessions.map(s => s.metrics?.fillerCount || 0);
  const best = scores.length ? Math.max(...scores) : 0;
  const trend = scores.length > 1 ? scores.at(-1) - scores[0] : 0;
  $('#statCards').innerHTML = [
    ['Sesiones', sessions.length], ['Mejor puntuación', best || '—'], ['Última', scores.at(-1) || '—'], ['Evolución', (trend > 0 ? '+' : '') + trend]
  ].map(([l, n]) => `<div class="card stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  $('#chartScore').innerHTML = Chart.line(scores, { color: 'var(--brass)' });
  $('#chartWpm').innerHTML = Chart.line(wpm, { color: 'var(--signal)' });
  $('#chartFillers').innerHTML = Chart.bars(fillers, { color: 'var(--warn)' });
}

/* ---------------------------------------------------------------------
   14 · PERFILES
   --------------------------------------------------------------------- */
async function renderProfiles() {
  const profiles = await DB.all('profiles');
  $('#profileList').innerHTML = profiles.map(p => `
    <div class="card" style="cursor:pointer;${p.id === State.profile?.id ? 'border-color:var(--brass)' : ''}" onclick="switchProfile('${p.id}')">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><span class="avatar">${esc(p.name[0].toUpperCase())}</span><div><b style="font-family:var(--font-display)">${esc(p.name)}</b><div class="muted" style="font-size:12px">${p.id === State.profile?.id ? 'Activo' : 'Pulsa para activar'}</div></div></div>
      ${p.goal ? `<p class="muted" style="font-size:13px">🎯 ${esc(p.goal)}</p>` : ''}
      <button class="btn ghost danger" style="padding:6px 10px;font-size:12px;margin-top:10px" onclick="event.stopPropagation();delProfile('${p.id}')">Eliminar</button>
    </div>`).join('');
}
async function createProfile() {
  const html = `<div class="field"><label>Nombre</label><input type="text" id="pfName" placeholder="Tu nombre"/></div>
    <div class="field"><label>Objetivo principal (opcional)</label><input type="text" id="pfGoal" placeholder="p. ej. Aprobar la oposición de Primaria"/></div>`;
  const ok = await modal('Nuevo perfil', html, [{ label: 'Cancelar', value: false }, { label: 'Crear', cls: 'primary', value: true }]);
  if (!ok) return;
  const name = $('#pfName')?.value.trim(); if (!name) { toast('Pon un nombre', 'bad'); return; }
  const p = { id: uid(), name, goal: $('#pfGoal')?.value.trim() || '', created: Date.now() };
  await DB.put('profiles', p);
  await DB.put('kv', { k: 'lastProfile', v: p.id });
  await activateProfile(p);
  renderProfiles(); toast('Perfil creado', 'ok');
}
async function switchProfile(id) { const p = await DB.get('profiles', id); if (p) { await DB.put('kv', { k: 'lastProfile', v: id }); await activateProfile(p); renderProfiles(); UI.go('inicio'); } }
async function delProfile(id) {
  if (!await modal('Eliminar perfil', '<p style="font-size:14px">Se borrarán sus sesiones y documentos. ¿Seguro?</p>', [{ label: 'Cancelar', value: false }, { label: 'Eliminar', cls: 'danger', value: true }])) return;
  await DB.del('profiles', id);
  for (const s of await DB.byIndex('sessions', 'profile', id)) await DB.del('sessions', s.id);
  for (const d of await DB.byIndex('docs', 'profile', id)) await DB.del('docs', d.id);
  for (const c of await DB.byIndex('chunks', 'profile', id)) await DB.del('chunks', c.id);
  for (const st of ['temas', 'supuestos', 'attempts']) for (const x of await DB.byIndex(st, 'profile', id)) await DB.del(st, x.id);
  await DB.del('kv', 'p:' + id);
  if (State.profile?.id === id) { State.profile = null; const rest = await DB.all('profiles'); if (rest[0]) await activateProfile(rest[0]); }
  renderProfiles(); toast('Perfil eliminado');
}
async function activateProfile(p) {
  State.profile = p;
  await State.loadSettings();
  applyTheme();
  $('#sbAvatar').textContent = p.name[0].toUpperCase();
  $('#sbName').textContent = p.name;
  $('#sbProvider').textContent = 'IA: ' + State.settings.provider;
  UI.fillSettings();
}

/* ---------------------------------------------------------------------
   15 · EXPORTACIÓN
   --------------------------------------------------------------------- */
async function exportData() {
  // Copia de seguridad completa del perfil (para pasar del ordenador al móvil y viceversa)
  const pid = State.profile.id, data = { app: 'atril', version: 2, exported: new Date().toISOString(), profile: State.profile };
  for (const st of ['docs', 'sessions', 'temas', 'supuestos', 'attempts']) data[st] = await DB.byIndex(st, 'profile', pid);
  data.texts = []; for (const d of data.docs) { const t = await DB.get('texts', d.id); if (t) data.texts.push(t); }
  data.chunks = await DB.byIndex('chunks', 'profile', pid);
  const s = { ...State.settings }; delete s.apiKey; data.settings = s;   // la clave NO se exporta
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'atril-copia-' + State.profile.name.replace(/\s+/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
  await DB.put('kv', { k: 'lastBackup:' + pid, v: Date.now() });
  toast('Copia de seguridad descargada', 'ok');
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'atril' || !d.profile) throw new Error('No es una copia de Atril');
    const exists = await DB.get('profiles', d.profile.id);
    if (exists && !await modal('Importar copia', '<p style="font-size:14px">Ya existe el perfil «' + esc(d.profile.name) + '» en este dispositivo. Se combinarán los datos (lo importado sustituye a lo que tenga el mismo identificador).</p>', [{ label: 'Cancelar', value: false }, { label: 'Importar', cls: 'primary', value: true }])) return;
    await DB.put('profiles', d.profile);
    for (const st of ['docs', 'sessions', 'temas', 'supuestos', 'attempts', 'texts', 'chunks']) for (const x of (d[st] || [])) await DB.put(st, x);
    if (d.settings) { const cur = (await DB.get('kv', 'p:' + d.profile.id))?.v || {}; await DB.put('kv', { k: 'p:' + d.profile.id, v: { ...d.settings, apiKey: cur.apiKey || State.settings?.apiKey || '' } }); }
    await DB.put('kv', { k: 'lastProfile', v: d.profile.id });
    toast('Copia importada ✓', 'ok'); setTimeout(() => location.reload(), 800);
  } catch (e) { toast('No se pudo importar: ' + e.message, 'bad'); }
}

/* ---------------------------------------------------------------------
   15b · SALUD / AUTODIAGNÓSTICO DE LA IA
   Comprueba al arrancar si la IA está lista y lo comunica con claridad.
   La app siempre es operativa: sin IA válida funciona el «modo ensayo».
   --------------------------------------------------------------------- */
const Health = {
  show(kind, html, btnLabel, btnFn) {
    const b = $('#aiBanner'); if (!b) return;
    b.className = 'ai-banner ' + kind; b.style.display = 'flex';
    b.innerHTML = '<span>' + html + '</span>';
    if (btnLabel) { const x = el('button', { class: 'btn' }, esc(btnLabel)); x.onclick = btnFn; b.appendChild(x); }
    const c = el('button', { class: 'x' }, '✕'); c.onclick = () => b.style.display = 'none'; b.appendChild(c);
  },
  hide() { const b = $('#aiBanner'); if (b) b.style.display = 'none'; },
  async check() {
    const s = State.settings; if (!s) return;
    const goAjustes = () => UI.go('ajustes');
    // 1) Ollama: no necesita clave
    if (s.provider === 'ollama') {
      this.show('info', 'Comprobando tu servidor Ollama local…');
      try { await Providers.chat({ system: 'Responde solo: OK', messages: [{ role: 'user', content: 'OK' }] }); this.ok(s); }
      catch (e) { this.show('bad', 'No se encontró Ollama en <code>' + esc(s.ollamaUrl) + '</code>. Arráncalo con <code>OLLAMA_ORIGINS="*" ollama serve</code>. Mientras tanto puedes usar el <b>modo ensayo</b>.', 'Ajustes', goAjustes); }
      return;
    }
    // 2) Falta clave
    if (!s.apiKey) {
      this.show('warn', 'La IA aún no está configurada. Ya puedes entrenar en <b>modo ensayo</b> (te escucho y analizo ritmo, muletillas y claridad). Añade una clave para que además te repregunte.', 'Configurar IA', goAjustes);
      return;
    }
    // 3) La clave no parece de Gemini
    if (s.provider === 'gemini' && !/^(AIza|AQ\.)/.test(s.apiKey)) {
      this.show('warn', 'La clave no empieza por <code>AQ.</code> ni <code>AIza</code>: puede que no sea una clave de Gemini. Compruebo de todos modos…');
    }
    // 4) Probar de verdad
    this.show('info', 'Comprobando conexión con la IA…');
    try { await Providers.chat({ system: 'Responde solo: OK', messages: [{ role: 'user', content: 'OK' }] }); this.ok(s); }
    catch (e) {
      const msg = (e.message || '').slice(0, 140);
      this.show('bad', 'No se pudo conectar con la IA: <code>' + esc(msg) + '</code>. Revisa la clave o el modelo. Puedes seguir en <b>modo ensayo</b>.', 'Revisar Ajustes', goAjustes);
    }
  },
  ok(s) { this.show('ok', '✓ IA conectada (' + esc(s.provider) + ' · ' + esc(s.chatModel) + '). Todo listo para entrenar.'); setTimeout(() => { const b = $('#aiBanner'); if (b && b.classList.contains('ok')) b.style.display = 'none'; }, 4500); }
};


// Instalación como app (Android/escritorio): captura el evento del navegador
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = $('#installBtn'); if (b) b.style.display = ''; });
window.addEventListener('appinstalled', () => { deferredInstall = null; const b = $('#installBtn'); if (b) b.style.display = 'none'; toast('App instalada ✓', 'ok'); });
async function doInstall() {
  if (!deferredInstall) { toast('Abre el menú del navegador (⋮) y pulsa «Instalar app» o «Añadir a pantalla de inicio»'); return; }
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null; const b = $('#installBtn'); if (b) b.style.display = 'none';
}

async function boot() {
  await DB.open();
  UI.init();
  Voice.loadVoices();
  const profiles = await DB.all('profiles');
  if (!profiles.length) {
    State.settings = null; await State.loadSettings();  // ajustes por defecto para el arranque
    applyTheme();
    await createProfile();
    if (!State.profile) { // por si cancela
      const p = { id: uid(), name: 'Docente', goal: '', created: Date.now() };
      await DB.put('profiles', p); await activateProfile(p);
    }
  } else {
    const last = (await DB.get('kv', 'lastProfile'))?.v;
    const p = profiles.find(x => x.id === last) || profiles[0];
    await activateProfile(p);
  }
  renderProfiles(); renderHome();
  Health.check();   // autodiagnóstico de la IA (no bloquea)
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});   // que el navegador no borre los datos
  if (window.Estudio) Estudio.init();
  const h = location.hash.slice(1); if (h && document.getElementById('view-' + h)) UI.go(h);
  // Service worker (solo si se sirve por http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}
window.addEventListener('DOMContentLoaded', boot);
// exponer funciones usadas desde HTML inline
Object.assign(window, { UI, State, DB, Docs, RAG, Providers, Voice, Analyzer, Modes, Session, toast, modal, esc, el, uid, $, $$, fmtDate, clamp, exportData, importData, delDoc, delProfile, switchProfile, createProfile });
