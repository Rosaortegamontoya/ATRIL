/* =====================================================================
   ATRIL · estudio.js
   Temario · Repaso espaciado · Supuestos prácticos
   Entrenamiento COMPLETO y PARCIAL (por apartados, índice, huecos,
   encadenar, tarjetas, simulacro cronometrado y defensa oral).
   Se apoya en DB, State, Providers, Docs y Session de app.js.
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   A · UTILIDADES DE TEXTO Y FECHAS
   --------------------------------------------------------------------- */
const U = {
  today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  daysTo(iso) { if (!iso) return null; const a = new Date(U.today() + 'T00:00'), b = new Date(iso + 'T00:00'); return Math.round((b - a) / 86400000); },
  fdate(iso) { return iso ? new Date(iso + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'; },
  norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); },
  stop: new Set('para porque como cuando donde desde hasta entre sobre sino tambien pero esta este estos estas ese esos esas aquel cual cuales quien quienes cuyo todo todos toda todas otro otros otra otras mismo misma muy mas menos tiene tienen puede pueden debe deben sera seran siendo sido habia hacer hace segun mediante durante tras ante bajo cada cualquier dicho dicha dichos dichas asi solo sola tanto tanta tales donde alumnado alumno alumna alumnos alumnas'.split(' ')),
  words(s) { return (U.norm(s).match(/[a-z0-9ñ]+/g) || []); },
  stem(w) { return w.slice(0, 6); },
  stems(s) { return U.words(s).filter(w => w.length >= 4 && !U.stop.has(w)).map(U.stem); },
  upperRatio(s) { const l = s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, ''); if (!l) return 0; return l.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '').length / l.length; },
  // Términos clave de un texto (por frecuencia y longitud)
  keyTerms(text, n = 40) {
    const cnt = {}, shown = {};
    for (const w of (text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g) || [])) {
      const nw = U.norm(w); if (nw.length < 5 || U.stop.has(nw)) continue;
      const st = U.stem(nw); cnt[st] = (cnt[st] || 0) + 1 + Math.min(nw.length - 5, 6) * 0.15; shown[st] = shown[st] || w;
    }
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, n).map(([st]) => ({ st, w: shown[st] }));
  },
  // Referencias normativas: Ley 3/2020, Decreto 85/2018, LOMLOE…
  lawRefs(text) {
    const out = new Map();
    const re = /\b(Ley Org[aá]nica|Real Decreto|Real Decreto-ley|Decreto|Orden|Resoluci[oó]n|Instrucci[oó]n(?:es)?|Ley|LO|RD)\s+(\d{1,4}\/\d{4})/gi;
    let m; while ((m = re.exec(text))) out.set(m[2], m[1] + ' ' + m[2]);
    for (const a of (text.match(/\b(LOMLOE|LOMCE|LOE|LODE|LOGSE|LOPDGDD|LOPIVI|DUA)\b/g) || [])) out.set(a, a);
    return [...out.entries()].map(([k, v]) => ({ k, label: v }));
  },
  // Une las líneas cortadas por el PDF dentro de un mismo párrafo (respeta listas y párrafos)
  reflow(t) { return t.replace(/[ \t]+\n/g, '\n').replace(/([^\n.:;!?])\n(?!\n|\s*[-•·*▪]|\s*\(?[a-z0-9]{1,2}[.)]\s)/gi, '$1 ').trim(); },
  overlap(a, b) { const A = new Set(U.stems(a)), B = new Set(U.stems(b)); if (!A.size) return 0; let n = 0; A.forEach(x => B.has(x) && n++); return n / A.size; },
  sentences(t) { return (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [t]).map(x => x.trim()).filter(Boolean); },
  hash(s) { let h = 0; for (const c of U.norm(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return 's' + (h >>> 0).toString(36); },
  mins(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); },
  shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  draft: {
    get(k) { try { return localStorage.getItem('atril-draft:' + k) || ''; } catch (e) { return ''; } },
    set(k, v) { try { localStorage.setItem('atril-draft:' + k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem('atril-draft:' + k); } catch (e) {} }
  }
};

/* ---------------------------------------------------------------------
   B · REPASO ESPACIADO (SM-2 simplificado, con tope en la fecha del examen)
   Calificación: 0 Otra vez · 1 Difícil · 2 Bien · 3 Fácil
   --------------------------------------------------------------------- */
const SRS = {
  grade(item, g, score) {
    const r = item.srs || { ease: 2.3, interval: 0, reps: 0 };
    if (g === 0) { r.reps = 0; r.interval = 0; r.ease = Math.max(1.3, r.ease - 0.2); }
    else {
      r.reps++;
      r.interval = r.reps === 1 ? (g === 3 ? 3 : 1) : r.reps === 2 ? (g === 1 ? 2 : g === 3 ? 6 : 4) : Math.round(r.interval * r.ease * (g === 1 ? 0.6 : g === 3 ? 1.3 : 1));
      r.ease = clamp(r.ease + (g - 2) * 0.12, 1.3, 2.8);
    }
    const left = U.daysTo(State.settings.examDate);
    if (left != null && left > 0) r.interval = Math.min(r.interval, Math.max(1, Math.floor(left / 2)));  // repasar de nuevo antes del examen
    r.due = U.addDays(r.interval); r.last = U.today();
    if (score != null) r.score = +score;
    r.history = [...(r.history || []), { d: U.today(), g, s: score ?? null }].slice(-20);
    item.srs = r; return r;
  },
  isDue(item) { return item.srs && item.srs.due && item.srs.due <= U.today(); },
  status(item) {
    const r = item.srs; if (!r) return { c: 'var(--text-mute)', t: 'Nuevo' };
    const s = r.score; const due = r.due <= U.today();
    const c = s == null ? (r.reps > 1 ? 'var(--ok)' : 'var(--warn)') : s < 5 ? 'var(--bad)' : s < 7.5 ? 'var(--warn)' : 'var(--ok)';
    return { c, t: (s != null ? s.toFixed(1) + ' · ' : '') + (due ? 'toca hoy' : 'repaso ' + U.fdate(r.due)) };
  },
  suggest(score) { return score == null ? 2 : score < 5 ? 0 : score < 7 ? 1 : score < 9 ? 2 : 3; }
};

/* ---------------------------------------------------------------------
   C · DICTADO CONTINUO (escribe en un cuadro de texto) y LECTOR (TTS)
   Pensado para no tener que escribir a mano.
   --------------------------------------------------------------------- */
const Dictado = {
  rec: null, ta: null, btn: null, on: false,
  supported() { return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window; },
  toggle(ta, btn) { if (this.on && this.ta === ta) this.stop(); else { this.stop(); this.start(ta, btn); } },
  start(ta, btn) {
    if (!this.supported()) { toast('Este navegador no permite dictado. Usa Chrome en Android o el teclado con micrófono del móvil.', 'bad'); return; }
    Voice.stop(); Voice.shutUp(); Lector.stop();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new SR(); this.rec.lang = 'es-ES'; this.rec.continuous = true; this.rec.interimResults = true;
    this.ta = ta; this.btn = btn; this.on = true; this._base = ta.value;
    btn && (btn.classList.add('rec'), btn.textContent = '■ Parar dictado');
    this.rec.onresult = e => {
      let fin = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else inter += r[0].transcript; }
      if (fin) { this._base = this._join(this._base, this._fmt(fin)); }
      ta.value = this._join(this._base, inter); ta.dispatchEvent(new Event('input')); ta.scrollTop = ta.scrollHeight;
    };
    this.rec.onend = () => { if (this.on) { try { this.rec.start(); } catch (e) {} } };
    this.rec.onerror = e => { if (e.error === 'not-allowed') { toast('Permiso de micrófono denegado', 'bad'); this.stop(); } };
    try { this.rec.start(); } catch (e) {}
  },
  // Comandos hablados: «punto», «coma», «punto y aparte», «nuevo apartado»
  _fmt(t) {
    return t.replace(/\s*punto y aparte\s*/gi, '.\n').replace(/\s*nuevo apartado\s*/gi, '\n\n').replace(/\s*punto y seguido\s*/gi, '. ')
      .replace(/\s+punto\b\s*/gi, '. ').replace(/\s+coma\b\s*/gi, ', ').replace(/\s+dos puntos\b\s*/gi, ': ').replace(/(^|[.\n]\s*)([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());
  },
  _join(a, b) { if (!b) return a; if (!a) return b.replace(/^\s+/, ''); return a + (/[\s\n]$/.test(a) ? '' : ' ') + b.replace(/^\s+/, ''); },
  stop() {
    this.on = false; try { this.rec && this.rec.stop(); } catch (e) {}
    if (this.btn) { this.btn.classList.remove('rec'); this.btn.textContent = '🎙 Dictar'; }
    this.rec = null; this.btn = null;
  }
};
const Lector = {
  q: [], playing: false, onDone: null,
  read(text, onDone) {
    this.stop(); Dictado.stop();
    this.q = []; for (const s of U.sentences(text)) { if (s.length > 220) this.q.push(...(s.match(/.{1,200}(\s|$)/g) || [s])); else this.q.push(s); }
    this.playing = true; this.onDone = onDone; this._next();
  },
  _next() {
    if (!this.playing) return;
    const t = this.q.shift(); if (!t) { this.playing = false; this.onDone && this.onDone(); return; }
    const u = new SpeechSynthesisUtterance(t); u.lang = 'es-ES'; u.rate = State.settings.voiceRate || 1;
    const v = Voice.voices.find(v => v.name === State.settings.voiceName); if (v) u.voice = v;
    u.onend = () => this._next(); u.onerror = () => this._next(); speechSynthesis.speak(u);
  },
  stop() { this.playing = false; this.q = []; try { speechSynthesis.cancel(); } catch (e) {} }
};

/* ---------------------------------------------------------------------
   D · CRONÓMETRO con tiempo adaptado y avisos
   --------------------------------------------------------------------- */
const Timer = {
  t: null, left: 0, total: 0, paused: false, onTick: null, warned: {},
  start(minutes, onTick) {
    this.stop(); this.total = this.left = Math.round(minutes * 60); this.onTick = onTick; this.paused = false; this.warned = {};
    this.t = setInterval(() => {
      if (this.paused) return; this.left--; onTick && onTick(this.left, this.total);
      const pct = 1 - this.left / this.total;
      if (pct >= 0.5 && !this.warned.h) { this.warned.h = 1; toast('Ecuador del tiempo'); navigator.vibrate?.(200); }
      if (this.left === 600 && this.total > 1200) { toast('Quedan 10 minutos: ve cerrando con la conclusión', 'bad'); navigator.vibrate?.([200, 100, 200]); }
      if (this.left <= 0) { this.stop(); toast('⏰ Tiempo terminado', 'bad'); navigator.vibrate?.([300, 100, 300]); }
    }, 1000);
    onTick && onTick(this.left, this.total);
  },
  elapsed() { return this.total - this.left; },
  stop() { clearInterval(this.t); this.t = null; },
  adapted(min) { return Math.round(min * (1 + (+State.settings.extraTime || 0) / 100)); }
};

/* ---------------------------------------------------------------------
   E · TEMAS — almacenamiento y estructura por apartados
   El texto del tema se guarda con marcas «## » al inicio de cada apartado.
   En el título se pueden indicar peso y tiempo: ## 3. Marco normativo [20% · 15 min]
   --------------------------------------------------------------------- */
const Temas = {
  async list() { return State.profile ? (await DB.byIndex('temas', 'profile', State.profile.id)).sort((a, b) => (a.num || 999) - (b.num || 999)) : []; },
  async get(id) { return DB.get('temas', id); },
  async save(t) { t.updated = Date.now(); await DB.put('temas', t); return t; },
  parse(text, prev = []) {
    const lines = (text || '').replace(/\r/g, '').split('\n');
    const secs = []; let cur = null; const pre = [];
    for (const l of lines) {
      const m = l.match(/^##\s+(.+)$/);
      if (m) { cur = { title: m[1].trim(), body: [] }; secs.push(cur); }
      else (cur ? cur.body : pre).push(l);
    }
    const preText = pre.join('\n').replace(/^\s*TEMA\s*\d+[^\n]*(\n(?!\s*\n)[^\n]*)?/i, '').trim();   // quita la cabecera «TEMA N…»
    if (preText.length > 120) secs.unshift({ title: 'Presentación', body: [preText] });
    const prevBy = Object.fromEntries(prev.map(s => [s.id, s]));
    return secs.map((s, i) => {
      let title = s.title, weight = null, minutes = null;
      const meta = title.match(/\[([^\]]+)\]\s*$/);
      if (meta) { title = title.slice(0, meta.index).trim(); const w = meta[1].match(/(\d+(?:[.,]\d+)?)\s*%/); const mi = meta[1].match(/(\d+)\s*min/); if (w) weight = +w[1].replace(',', '.'); if (mi) minutes = +mi[1]; }
      const id = U.hash(title.replace(/^[\d.\s)]+/, '')) + '_' + i;
      const keep = prevBy[id] || prev.find(p => U.norm(p.title) === U.norm(title));
      return { id, title, weight, minutes, text: U.reflow(s.body.join('\n')), srs: keep?.srs || null };
    }).filter(s => s.title);
  },
  // Detección automática de apartados en un texto (numeración, mayúsculas, palabras clave)
  autoMark(text, depth = 1) {
    const raw = (text || '').replace(/\r/g, '').split('\n').map(l => l.replace(/^##\s+/, ''));
    const freq = {}; raw.forEach(l => { const k = l.trim(); if (k) freq[k] = (freq[k] || 0) + 1; });
    const kw = /^(introducci[oó]n|conclusi[oó]n(es)?|bibliograf[ií]a|webgraf[ií]a|referencias( bibliogr[aá]ficas)?|legislaci[oó]n|normativa|marco (legal|normativo)|justificaci[oó]n|intervenci[oó]n( pr[aá]ctica)?|aplicaci[oó]n pr[aá]ctica)\b/i;
    let last = 0, numMarked = [], prevHead = -1;
    const out = raw.map((line, i) => {
      const l = line.trim();
      if (!l) return line;
      if (l.length > 120 || freq[l] >= 3) { prevHead = -1; return line; }
      const m = l.match(/^(\d{1,2})((?:\.\d{1,2})*)\.?[)\-.]?\s+(\S.*)$/);
      if (m) {
        const n = +m[1], sub = m[2] ? m[2].split('.').filter(Boolean).length : 0, head = m[3];
        const titleLike = !/[;,]$/.test(head) && (head.length < 90) && (!/\.$/.test(head) || U.upperRatio(head) > 0.6);
        // Índice al principio: si la numeración vuelve a empezar por 1, lo anterior era el índice → se desmarca
        if (sub === 0 && titleLike && n === 1 && last >= 2) {
          // solo es un índice si los títulos marcados estaban seguidos (casi sin texto entre ellos)
          const dense = numMarked.every((j, k) => k === 0 || raw.slice(numMarked[k - 1] + 1, j).filter(x => x.trim()).length <= 4);
          if (dense) { numMarked.forEach(j => { raw[j] = '\u0000' + raw[j]; }); numMarked = []; last = 0; }
        }
        if (sub === 0 && titleLike && (n === last + 1 || (last === 0 && n <= 1))) { last = n; numMarked.push(i); prevHead = i; return '## ' + l; }
        if (sub > 0 && depth >= 2 && n === last && titleLike) { prevHead = i; return '## ' + l; }
        prevHead = -1; return line;
      }
      // Título en MAYÚSCULAS cortado en dos líneas por el PDF → se une al título anterior
      if (prevHead >= 0 && i === prevHead + 1 && U.upperRatio(l) > 0.85 && l.length < 60 && !/[.;:,]$/.test(l)) return '\u0001' + l;
      prevHead = -1;
      if (kw.test(l) && l.length < 70 && !/[.;,]$/.test(l)) { prevHead = i; return '## ' + l; }
      if (U.upperRatio(l) > 0.85 && l.replace(/[^A-Za-zÁÉÍÓÚÑ]/g, '').length >= 6 && l.length < 90 && !/^TEMA\s*\d+/i.test(l)) { prevHead = i; return '## ' + l; }
      return line;
    });
    // aplica los desmarcados del índice y une las continuaciones de título
    return out.map((x, i) => raw[i].startsWith('\u0000') ? raw[i].slice(1) : x)
      .join('\n').replace(/\n\u0001/g, ' ');
  },
  async aiMark(text) {
    const res = await Providers.json({
      system: 'Divides temas de oposición en apartados. Devuelve SOLO JSON: {"apartados":[{"titulo":"…","inicio":"primeras 8-12 palabras EXACTAS del título o del primer párrafo del apartado, copiadas literalmente del texto"}]}. Incluye los apartados principales en orden (introducción, desarrollo, intervención/aplicación práctica, conclusión, bibliografía/legislación si existen). Entre 4 y 14 apartados.',
      messages: [{ role: 'user', content: text.slice(0, 180000) }]
    });
    const out = text.replace(/^##\s+/gm, '');
    const flat = U.norm(out).replace(/\s/g, ' ');           // misma longitud que «out»
    const ins = []; let pos = 0;
    for (const ap of (res.apartados || [])) {
      const probe = U.norm(ap.inicio || ap.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 50); if (!probe) continue;
      let i = flat.indexOf(probe, pos); if (i < 0) i = flat.indexOf(probe.slice(0, 22), pos); if (i < 0) continue;
      const ls = out.lastIndexOf('\n', i - 1) + 1; const le = out.indexOf('\n', ls);
      const lineText = out.slice(ls, le === -1 ? out.length : le).trim();
      ins.push([ls, U.overlap(ap.titulo || '', lineText) > 0.6 ? '## ' : '## ' + (ap.titulo || '').trim() + '\n']); pos = i + probe.length;
    }
    let res2 = out; for (const [at, txt] of ins.sort((x, y) => y[0] - x[0])) res2 = res2.slice(0, at) + txt + res2.slice(at);
    return res2;
  },
  clean(title) { return title.replace(/^\s*(\d{1,2}(\.\d{1,2})*|[IVX]{1,4})[.)\-]?\s+/, ''); },
  index(t) { return t.sections.map((s, i) => (i + 1) + '. ' + Temas.clean(s.title)).join('\n'); },
  fullText(t, ids) { return t.sections.filter(s => !ids || ids.includes(s.id)).map(s => '## ' + s.title + '\n' + s.text).join('\n\n'); },
  budget(t, totalMin) {
    // minutos por apartado: los indicados, o reparto por peso, o por longitud
    const secs = t.sections; const tot = secs.reduce((a, s) => a + (s.minutes || 0), 0);
    if (tot > 0) return secs.map(s => s.minutes || 0);
    const w = secs.map(s => s.weight || 0); const wt = w.reduce((a, b) => a + b, 0);
    const base = wt > 0 ? w : secs.map(s => Math.max(200, s.text.length)); const bt = base.reduce((a, b) => a + b, 0);
    return base.map(x => Math.round(x / bt * totalMin));
  }
};

/* ---------------------------------------------------------------------
   F · EVALUACIÓN (IA con respaldo local sin conexión)
   --------------------------------------------------------------------- */
const Eval = {
  hasAI() { return !!(State.settings.apiKey || State.settings.provider === 'ollama'); },
  normativa() { return State.settings.normativaRef || ''; },
  local(source, answer) {
    const keys = U.keyTerms(source, 40); const ans = new Set(U.words(answer).map(U.stem));
    const present = keys.filter(k => ans.has(k.st)), missing = keys.filter(k => !ans.has(k.st));
    const laws = U.lawRefs(source), lawsA = U.lawRefs(answer).map(x => x.k);
    const lawMiss = laws.filter(l => !lawsA.includes(l.k));
    const cov = keys.length ? present.length / keys.length : 0;
    const lenRatio = answer.length / Math.max(1, source.length);
    const nota = +clamp(cov * 10 * (lenRatio < 0.15 ? 0.8 : 1), 0, 10).toFixed(1);
    return {
      nota, cobertura: Math.round(cov * 100), source: 'local',
      ideas_presentes: present.slice(0, 15).map(k => k.w), ideas_ausentes: missing.slice(0, 15).map(k => k.w),
      errores: [], normativa_olvidada: lawMiss.map(l => l.label), normativa_bien: laws.filter(l => lawsA.includes(l.k)).map(l => l.label),
      consejo: 'Corrección aproximada por palabras clave (sin IA). Revisa las ideas ausentes con el texto delante y vuelve a intentarlo.'
    };
  },
  async recall(source, answer, ctx) {
    if (!answer.trim()) return { nota: 0, cobertura: 0, ideas_presentes: [], ideas_ausentes: ['No hay respuesta'], errores: [], source: 'local' };
    if (!this.hasAI()) return this.local(source, answer);
    try {
      const r = await Providers.json({
        system: `Eres miembro de un tribunal de oposiciones de Orientación Educativa (Cuerpo de Profesores de Enseñanza Secundaria, Castilla-La Mancha). Corriges el RECUERDO que hace la opositora de ${ctx} comparándolo con su TEXTO DE REFERENCIA (su propio tema). Valora el contenido y la estructura, no la literalidad: una idea expresada con otras palabras cuenta como presente. Sé exigente pero justo y concreto. Español de España.
Devuelve SOLO JSON con esta forma:
{"nota":0-10,"cobertura":0-100,"ideas_presentes":["…"],"ideas_ausentes":["ideas clave del texto que faltan, ordenadas por importancia"],"errores":["afirmaciones incorrectas o imprecisas"],"normativa_bien":["normas citadas correctamente"],"normativa_olvidada":["normas del texto que no aparecen"],"normativa_errores":["citas normativas erróneas: número, año o contenido"],"estructura":"1 frase sobre orden y enlaces","consejo":"1-2 frases: qué repasar y una pista mnemotécnica breve para lo que ha olvidado"${ctx.includes('tema completo') ? ',"apartados":[{"titulo":"…","cobertura":0-100,"comentario":"…"}]' : ''}}`,
        messages: [{ role: 'user', content: 'TEXTO DE REFERENCIA:\n' + source.slice(0, 150000) + '\n\n=====\nRECUERDO DE LA OPOSITORA:\n' + answer }]
      });
      r.source = 'ia'; r.nota = +r.nota || 0; return r;
    } catch (e) { console.warn(e); showAIError(e, 'La IA no ha podido corregir · se usa la corrección local'); return this.local(source, answer); }
  },
  html(r) {
    const li = (arr, col) => (arr && arr.length) ? `<ul class="fb-list">${arr.map(x => `<li><span class="dot" style="background:${col}"></span><span>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</span></li>`).join('')}</ul>` : '<p class="muted small">—</p>';
    const col = r.nota < 5 ? 'var(--bad)' : r.nota < 7.5 ? 'var(--warn)' : 'var(--ok)';
    return `<div class="grid cols-3">
      <div class="card stat"><div class="n" style="color:${col}">${(+r.nota).toFixed(1)}</div><div class="l">Nota /10</div></div>
      <div class="card stat"><div class="n">${r.cobertura ?? '—'}%</div><div class="l">Contenido recordado</div></div>
      <div class="card stat"><div class="n" style="font-size:20px">${r.source === 'ia' ? 'IA' : 'Local'}</div><div class="l">Corrección</div></div></div>
      ${r.consejo ? `<div class="card callout">💡 ${esc(r.consejo)}</div>` : ''}
      ${r.estructura ? `<p class="muted small" style="margin:8px 2px">Estructura: ${esc(r.estructura)}</p>` : ''}
      ${r.apartados ? `<div class="card"><h3>Por apartados</h3>${r.apartados.map(a => `<div class="gauge"><div class="top"><span>${esc(a.titulo)}</span><b>${a.cobertura}%</b></div><div class="bar"><i style="width:${a.cobertura}%"></i></div>${a.comentario ? `<p class="muted small">${esc(a.comentario)}</p>` : ''}</div>`).join('')}</div>` : ''}
      <div class="grid cols-2">
        <div class="card"><h3>Lo que falta</h3>${li(r.ideas_ausentes, 'var(--warn)')}</div>
        <div class="card"><h3>Lo que has recordado</h3>${li(r.ideas_presentes, 'var(--ok)')}</div>
        <div class="card"><h3>Errores</h3>${li([...(r.errores || []), ...(r.normativa_errores || [])], 'var(--bad)')}</div>
        <div class="card"><h3>Normativa</h3><p class="small muted">Olvidada:</p>${li(r.normativa_olvidada, 'var(--warn)')}<p class="small muted">Bien citada:</p>${li(r.normativa_bien, 'var(--ok)')}</div>
      </div>`;
  }
};

/* ---------------------------------------------------------------------
   G · PANTALLAS DEL TEMARIO
   --------------------------------------------------------------------- */
const TemarioUI = {
  root() { return $('#temarioRoot'); },
  async renderList() {
    const temas = await this.allCached(); const r = this.root();
    const q = U.norm($('#temaSearch')?.value || '');
    const only = $('#temaOnlySel')?.checked;
    let list = temas.filter(t => !q || U.norm((t.num || '') + ' ' + t.title + ' ' + (t.bloque || '')).includes(q));
    if (only) list = list.filter(t => t.selected);
    const nSel = temas.filter(t => t.selected).length;
    r.innerHTML = `
      <div class="toolbar">
        <input id="temaSearch" placeholder="Buscar tema…" value="${esc($('#temaSearch')?.value || '')}"/>
        <label class="chk"><input type="checkbox" id="temaOnlySel" ${only ? 'checked' : ''}/> Solo mis temas (${nSel})</label>
        <button class="btn primary" id="newTema">+ Nuevo tema</button>
      </div>
      ${list.length ? `<div class="tema-grid">${list.map(t => {
        const secs = t.sections || []; const due = secs.filter(SRS.isDue).length;
        const sc = secs.filter(s => s.srs?.score != null); const avg = sc.length ? sc.reduce((a, s) => a + s.srs.score, 0) / sc.length : null;
        const dots = secs.map(s => `<i style="background:${SRS.status(s).c}" title="${esc(s.title)}"></i>`).join('');
        return `<button class="tema-card ${t.selected ? 'sel' : ''}" data-id="${t.id}">
          <div class="tn">${t.num ? 'Tema ' + esc(t.num) : 'Tema'}${t.selected ? ' ★' : ''}</div><b>${esc(t.title)}</b>
          <div class="dots">${dots || '<span class="muted small">Sin apartados</span>'}</div>
          <div class="small muted">${secs.length} apartados${avg != null ? ' · media ' + avg.toFixed(1) : ''}${due ? ' · <span style="color:var(--brass)">' + due + ' para hoy</span>' : ''}</div></button>`;
      }).join('')}</div>` : `<div class="empty">Aún no hay temas. Pulsa <b>+ Nuevo tema</b> y sube el PDF o Word de tu tema: la app lo leerá y lo dividirá en apartados.</div>`}`;
    $('#temaSearch').oninput = () => { clearTimeout(this._q); this._q = setTimeout(() => this.renderList().then(() => { const i = $('#temaSearch'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
    $('#temaOnlySel').onchange = () => this.renderList();
    $('#newTema').onclick = () => this.edit(null);
    $$('.tema-card', r).forEach(b => b.onclick = () => this.detail(b.dataset.id));
  },
  async allCached() { return Temas.list(); },

  /* --- Crear / editar tema --- */
  async edit(id) {
    const t = id ? await Temas.get(id) : { id: uid(), profileId: State.profile.id, num: '', title: '', bloque: '', text: '', sections: [], docIds: [], selected: true, created: Date.now() };
    const docs = await DB.byIndex('docs', 'profile', State.profile.id);
    const r = this.root();
    r.innerHTML = `
      <button class="btn ghost back" id="bk">← Volver</button>
      <div class="card">
        <div class="grid cols-3 tight">
          <div class="field"><label>Número</label><input id="tNum" value="${esc(t.num)}" placeholder="59" inputmode="numeric"/></div>
          <div class="field" style="grid-column:span 2"><label>Título</label><input id="tTitle" value="${esc(t.title)}" placeholder="Título del tema"/></div>
        </div>
        <div class="grid cols-2 tight">
          <div class="field"><label>Bloque (opcional)</label><input id="tBloque" value="${esc(t.bloque || '')}"/></div>
          <label class="chk" style="align-self:end;margin-bottom:14px"><input type="checkbox" id="tSel" ${t.selected ? 'checked' : ''}/> Es uno de mis temas seleccionados</label>
        </div>
        <h3>1 · Texto del tema</h3>
        <p class="hint">Sube tu tema (PDF, Word, foto…) o elige uno de la Biblioteca. Los PDF escaneados se leen con IA.</p>
        <div class="row wrap">
          <label class="btn">📄 Subir archivo<input type="file" id="tFile" hidden accept=".pdf,.docx,.txt,.md,.html,.epub,.png,.jpg,.jpeg,.pptx"/></label>
          <select id="tDoc" style="max-width:280px"><option value="">— o tomar de la Biblioteca —</option>${docs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
        </div>
        <h3 style="margin-top:18px">2 · Apartados</h3>
        <p class="hint">Cada apartado empieza en una línea con <code>## </code>. Puedes añadir peso y tiempo: <code>## 3. Marco normativo [20% · 15 min]</code></p>
        <div class="row wrap">
          <button class="btn" id="tAuto">✨ Detectar apartados</button>
          <button class="btn" id="tAuto2">Detectar incluyendo subapartados</button>
          <button class="btn" id="tAI">🤖 Dividir con IA</button>
          <button class="btn ghost" id="tClear">Quitar marcas</button>
        </div>
        <textarea id="tText" class="editor" placeholder="Aquí aparecerá el texto del tema…">${esc(t.text || '')}</textarea>
        <div id="tPreview" class="sec-preview"></div>
        <div class="row" style="margin-top:14px"><button class="btn primary" id="tSave">Guardar tema</button>${id ? '<button class="btn ghost danger" id="tDel">Eliminar tema</button>' : ''}</div>
      </div>`;
    const ta = $('#tText');
    const preview = () => { const secs = Temas.parse(ta.value); $('#tPreview').innerHTML = secs.length ? '<b>' + secs.length + ' apartados:</b> ' + secs.map(s => `<span class="tag">${esc(s.title.slice(0, 50))}${s.weight ? ' · ' + s.weight + '%' : ''}${s.minutes ? ' · ' + s.minutes + '′' : ''}</span>`).join('') : '<span class="muted small">Sin apartados todavía.</span>'; };
    ta.oninput = () => { clearTimeout(this._p); this._p = setTimeout(preview, 300); }; preview();
    $('#bk').onclick = () => id ? this.detail(id) : this.renderList();
    const load = async text => {
      ta.value = Temas.autoMark(text); preview();
      if (!$('#tTitle').value) {
        const head = text.split(/\n\s*\n|\n(?=\s*(?:\d{1,2}[.)]\s|[A-ZÁÉÍÓÚÑ ]{8,}$))/m)[0].replace(/\s*\n\s*/g, ' ');   // título aunque ocupe dos líneas
        const m = head.match(/TEMA\s*(\d+)[\s.:\-–]*(.{5,220})/i); if (m) { $('#tNum').value ||= m[1]; $('#tTitle').value = m[2].trim(); }
      }
      toast('Texto cargado. Revisa los apartados detectados.', 'ok');
    };
    $('#tFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return; toast('Leyendo ' + f.name + '…');
      const doc = await Docs.ingest(f); t.docIds = [...new Set([...(t.docIds || []), doc.id])];
      await load(await Docs.text(doc.id));
    };
    $('#tDoc').onchange = async e => { const v = e.target.value; if (!v) return; t.docIds = [...new Set([...(t.docIds || []), v])]; await load(await Docs.text(v)); };
    $('#tAuto').onclick = () => { ta.value = Temas.autoMark(ta.value, 1); preview(); };
    $('#tAuto2').onclick = () => { ta.value = Temas.autoMark(ta.value, 2); preview(); };
    $('#tClear').onclick = () => { ta.value = ta.value.replace(/^##\s+/gm, ''); preview(); };
    $('#tAI').onclick = async () => {
      if (!Eval.hasAI()) return toast('Configura la IA en Ajustes', 'bad');
      const b = $('#tAI'); b.disabled = true; b.textContent = 'Dividiendo…';
      try { ta.value = await Temas.aiMark(ta.value); preview(); toast('Apartados propuestos por la IA. Revísalos.', 'ok'); } catch (e) { showAIError(e, 'No se pudo dividir con IA'); }
      b.disabled = false; b.textContent = '🤖 Dividir con IA';
    };
    $('#tSave').onclick = async () => {
      t.num = $('#tNum').value.trim(); t.title = $('#tTitle').value.trim() || 'Tema sin título'; t.bloque = $('#tBloque').value.trim(); t.selected = $('#tSel').checked;
      t.text = ta.value; t.sections = Temas.parse(ta.value, t.sections || []);
      if (!t.sections.length && t.text.trim()) t.sections = [{ id: 's_all_0', title: 'Tema completo', text: t.text.trim(), srs: null }];
      await Temas.save(t); toast('Tema guardado ✓', 'ok'); this.detail(t.id);
    };
    $('#tDel') && ($('#tDel').onclick = async () => {
      if (!await modal('Eliminar tema', '<p>Se borrará el tema y su historial de repaso. Los documentos de la Biblioteca se conservan.</p>', [{ label: 'Cancelar', value: false }, { label: 'Eliminar', cls: 'danger', value: true }])) return;
      await DB.del('temas', t.id); for (const a of await DB.byIndex('attempts', 'item', t.id)) await DB.del('attempts', a.id);
      toast('Tema eliminado'); this.renderList();
    });
  },

  /* --- Ficha del tema: elegir qué y cómo entrenar --- */
  async detail(id) {
    const t = await Temas.get(id); if (!t) return this.renderList();
    const attempts = (await DB.byIndex('attempts', 'item', id)).sort((a, b) => b.at - a.at);
    const r = this.root(); const total = Timer.adapted(State.settings.examMinutes || 120);
    r.innerHTML = `
      <button class="btn ghost back" id="bk">← Temario</button>
      <div class="view-head"><div class="eyebrow">${t.num ? 'Tema ' + esc(t.num) : 'Tema'}${t.bloque ? ' · ' + esc(t.bloque) : ''}</div><h1 style="font-size:clamp(22px,4vw,30px)">${esc(t.title)}</h1></div>
      <div class="card">
        <div class="row between"><h3>Apartados</h3><div class="row"><button class="btn ghost sm" id="selAll">Todos</button><button class="btn ghost sm" id="selDue">Los de hoy</button><button class="btn ghost sm" id="selWeak">Los flojos</button><button class="btn ghost sm" id="selRnd">🎲 Uno al azar</button><button class="btn ghost sm" id="selNone">Ninguno</button></div></div>
        <div class="sec-list">${t.sections.map((s, i) => { const st = SRS.status(s); return `
          <label class="sec-row"><input type="checkbox" value="${s.id}"/>
            <span class="num">${i + 1}</span><span class="tt">${esc(Temas.clean(s.title))}<small class="muted"> ${s.weight ? s.weight + '% · ' : ''}${s.minutes ? s.minutes + '′ · ' : ''}${(s.text.match(/\S+/g) || []).length} palabras</small></span>
            <span class="pill" style="border-color:${st.c};color:${st.c}">${st.t}</span></label>`; }).join('')}</div>
      </div>

      <h3 class="sect">Entrenar lo seleccionado (parcial)</h3>
      <div class="train-grid">
        <button class="train" data-m="estudiar"><b>📖 Estudiar</b><span>Leer y escuchar el apartado, con modo «primeras letras».</span></button>
        <button class="train" data-m="huecos"><b>🧩 Huecos</b><span>Texto con palabras clave ocultas para rellenar de memoria.</span></button>
        <button class="train" data-m="recordar"><b>🧠 Recordar y corregir</b><span>Lo escribes o dictas sin mirar y se compara con tu tema.</span></button>
        <button class="train" data-m="tarjetas"><b>🃏 Preguntas rápidas</b><span>La IA crea preguntas cortas de los apartados elegidos.</span></button>
      </div>
      <h3 class="sect">Entrenar el tema entero</h3>
      <div class="train-grid">
        <button class="train" data-m="indice"><b>🗂 Índice</b><span>Escribe o dicta la estructura del tema de memoria.</span></button>
        <button class="train" data-m="encadenar"><b>🔗 Encadenar</b><span>Qué apartado sigue y con qué frase puente enlazas.</span></button>
        <button class="train" data-m="completo"><b>⏱ Simulacro completo</b><span>Tema entero cronometrado (${total} min con tu adaptación) y corrección por apartados.</span></button>
        <button class="train" data-m="tribunal"><b>🎓 Defensa oral</b><span>Un tribunal te pregunta por voz sobre este tema.</span></button>
      </div>

      <div class="card"><h3>Historial</h3>${attempts.length ? attempts.slice(0, 8).map(a => `<div class="doc-row"><div class="ic">${a.score != null ? (+a.score).toFixed(1) : '·'}</div><div class="info"><b>${esc(a.label)}</b><span>${fmtDate(a.at)}${a.durationSec ? ' · ' + U.mins(a.durationSec) : ''}</span></div></div>`).join('') : '<p class="muted small">Aún sin intentos.</p>'}</div>
      <div class="row" style="margin-top:12px"><button class="btn" id="edit">✏️ Editar tema y apartados</button><button class="btn ghost" id="listen">🔊 Escuchar el tema entero</button></div>`;
    $('#bk').onclick = () => this.renderList();
    $('#edit').onclick = () => this.edit(id);
    $('#listen').onclick = () => { if (Lector.playing) { Lector.stop(); $('#listen').textContent = '🔊 Escuchar el tema entero'; } else { Lector.read(t.sections.map(s => s.title + '. ' + s.text).join('\n'), () => $('#listen') && ($('#listen').textContent = '🔊 Escuchar el tema entero')); $('#listen').textContent = '⏹ Parar lectura'; } };
    const boxes = () => $$('.sec-list input', r);
    const set = f => boxes().forEach((b, i) => b.checked = f(t.sections[i], i));
    $('#selAll').onclick = () => set(() => true); $('#selNone').onclick = () => set(() => false);
    $('#selDue').onclick = () => { set(s => SRS.isDue(s) || !s.srs); if (!boxes().some(b => b.checked)) toast('Nada pendiente hoy en este tema 🎉'); };
    $('#selWeak').onclick = () => set(s => s.srs?.score != null && s.srs.score < 7);
    $('#selRnd').onclick = () => { const k = Math.floor(Math.random() * t.sections.length); set((s, i) => i === k); };
    $$('.train', r).forEach(b => b.onclick = () => {
      const m = b.dataset.m; const ids = boxes().filter(x => x.checked).map(x => x.value);
      if (['estudiar', 'huecos', 'recordar', 'tarjetas'].includes(m) && !ids.length) return toast('Marca uno o varios apartados (o pulsa «Uno al azar»)', 'bad');
      Entreno.start(t, m, ids);
    });
  }
};

/* ---------------------------------------------------------------------
   H · ENTRENAMIENTOS DEL TEMA
   --------------------------------------------------------------------- */
const Entreno = {
  ctx: null,
  root() { return this._host || $('#temarioRoot'); },
  async start(t, mode, ids, queue) {
    Lector.stop(); Dictado.stop(); Timer.stop();
    this.ctx = { t, mode, ids, queue, started: Date.now() };
    Estudio._skipList = true; UI.go(queue ? 'repaso' : 'temario'); Estudio._skipList = false;
    const host = queue ? $('#repasoRoot') : $('#temarioRoot'); this._host = host;
    const fn = this['_' + mode]; if (fn) await fn.call(this, t, ids); window.scrollTo(0, 0); $('#main').scrollTop = 0;
  },
  back() { Lector.stop(); Dictado.stop(); Timer.stop(); if (this.ctx?.queue) return UI.go('repaso'); TemarioUI.detail(this.ctx.t.id); },
  secs(t, ids) { return t.sections.filter(s => !ids || !ids.length || ids.includes(s.id)); },
  head(title, sub) { return `<button class="btn ghost back" id="bk">← ${this.ctx?.queue ? 'Repaso de hoy' : 'Volver al tema'}</button><div class="view-head"><div class="eyebrow">${esc(sub)}</div><h1 style="font-size:clamp(20px,3.6vw,28px)">${esc(title)}</h1></div>`; },
  bindBack() { $('#bk').onclick = () => this.back(); },
  async saveAttempt(t, label, score, extra = {}) {
    await DB.put('attempts', { id: uid(), profileId: State.profile.id, itemId: t.id, kind: 'tema', label, score, durationSec: Math.round((Date.now() - this.ctx.started) / 1000), at: Date.now(), ...extra });
  },
  // Botones de autoevaluación → repaso espaciado
  gradeBar(t, secIds, score, after) {
    const sug = SRS.suggest(score);
    const labels = ['Otra vez', 'Difícil', 'Bien', 'Fácil'];
    return { html: `<div class="card grade"><p class="small muted">¿Cómo te ha ido? (decide cuándo vuelve a salir)</p><div class="row wrap">${labels.map((l, g) => `<button class="btn ${g === sug ? 'primary' : ''}" data-g="${g}">${l}</button>`).join('')}</div></div>`,
      bind: () => $$('.grade [data-g]').forEach(b => b.onclick = async () => {
        const g = +b.dataset.g; const fresh = await Temas.get(t.id);
        fresh.sections.forEach(s => { if (secIds.includes(s.id)) SRS.grade(s, g, score); });
        await Temas.save(fresh); this.ctx.t = fresh;
        const r = fresh.sections.find(s => secIds.includes(s.id))?.srs;
        toast('Próximo repaso: ' + (r ? U.fdate(r.due) : '—'), 'ok');
        if (after) after(); else if (this.ctx.queue) Repaso.next(); else this.back();
      }) };
  },

  /* 📖 Estudiar: leer, escuchar, primeras letras */
  async _estudiar(t, ids) {
    const secs = this.secs(t, ids); let i = 0, mode = 'texto';
    const draw = () => {
      const s = secs[i];
      const body = mode === 'letras' ? this.firstLetters(s.text) : esc(s.text);
      this.root().innerHTML = this.head(s.title, 'Estudiar · ' + (i + 1) + ' de ' + secs.length) + `
        <div class="row wrap sticky-tools"><div class="seg"><button data-v="texto" class="${mode === 'texto' ? 'on' : ''}">Texto</button><button data-v="letras" class="${mode === 'letras' ? 'on' : ''}">Primeras letras</button></div>
          <button class="btn" id="play">${Lector.playing ? '⏹ Parar' : '🔊 Escuchar'}</button></div>
        <div class="card reading">${body}</div>
        <div class="row between"><button class="btn" id="prev" ${i === 0 ? 'disabled' : ''}>← Anterior</button>
          ${i < secs.length - 1 ? '<button class="btn primary" id="next">Siguiente →</button>' : '<button class="btn primary" id="toRec">🧠 Ahora recuérdalo</button>'}</div>
        <div id="gb"></div>`;
      this.bindBack();
      $$('.seg button').forEach(b => b.onclick = () => { mode = b.dataset.v; draw(); });
      $('#play').onclick = () => { if (Lector.playing) { Lector.stop(); draw(); } else { Lector.read(s.title + '. ' + s.text, () => { const p = $('#play'); if (p) p.textContent = '🔊 Escuchar'; }); $('#play').textContent = '⏹ Parar'; } };
      $('#prev').onclick = () => { Lector.stop(); i--; draw(); };
      $('#next') && ($('#next').onclick = () => { Lector.stop(); i++; draw(); });
      $('#toRec') && ($('#toRec').onclick = () => this.start(t, 'recordar', secs.map(x => x.id), this.ctx.queue));
      $$('.reading .fl').forEach(w => w.onclick = () => w.classList.toggle('show'));
      if (this.ctx.queue && i === secs.length - 1) { const g = this.gradeBar(t, secs.map(x => x.id), null); $('#gb').innerHTML = g.html; g.bind(); }
    };
    draw();
  },
  firstLetters(text) {
    return text.split(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,})/).map((p, i) => i % 2 ? `<span class="fl"><b>${p[0]}</b><span class="rest">${p.slice(1)}</span><span class="dots-r">${'·'.repeat(Math.min(p.length - 1, 6))}</span></span>` : esc(p)).join('');
  },

  /* 🧩 Huecos */
  async _huecos(t, ids) {
    const secs = this.secs(t, ids); let ratio = 0.25;
    const draw = () => {
      const src = secs.map(s => s.text).join('\n\n');
      const keys = new Set(U.keyTerms(src, 400).map(k => k.st));
      let n = 0, hidden = 0;
      const html = src.split(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\/]{4,})/).map((w, i) => {
        if (i % 2 === 0) return esc(w);
        const nw = U.norm(w); const isKey = keys.has(U.stem(nw)) || /\d/.test(w);
        if (isKey && !U.stop.has(nw) && Math.random() < ratio * 1.6) { hidden++; return `<input class="gap" data-a="${esc(w)}" size="${Math.max(3, w.length)}" autocomplete="off" autocapitalize="off" spellcheck="false"/>`; }
        n++; return esc(w);
      }).join('');
      // reparte el HTML por apartados con su título visible
      const parts = html.split(/\n\n/); let k = 0;
      const lens = secs.map(x => x.text.split(/\n\n/).length);
      const blocks = secs.map((x, j) => '<h3 style="margin:14px 0 6px">' + esc(Temas.clean(x.title)) + '</h3>' + parts.slice(k, k += lens[j]).join('\n\n')).join('');
      this.root().innerHTML = this.head(secs.length === 1 ? secs[0].title : secs.length + ' apartados', 'Huecos · ' + hidden + ' palabras ocultas') + `
        <div class="row wrap sticky-tools"><div class="seg">${[['Suave', .15], ['Medio', .25], ['Intenso', .45]].map(([l, v]) => `<button data-r="${v}" class="${v === ratio ? 'on' : ''}">${l}</button>`).join('')}</div>
          <button class="btn" id="chk">Comprobar</button><button class="btn ghost" id="show">Ver solución</button></div>
        <p class="hint">Escribe cada palabra; también puedes tocar un hueco dos veces para ver la pista (primera letra).</p>
        <div class="card reading">${blocks}</div><div id="res"></div>`;
      this.bindBack();
      $$('.seg button').forEach(b => b.onclick = () => { ratio = +b.dataset.r; draw(); });
      $$('.gap').forEach(g => g.ondblclick = () => { if (!g.value) g.placeholder = g.dataset.a[0] + '…'; });
      const check = () => {
        let ok = 0; const gaps = $$('.gap');
        gaps.forEach(g => { const good = U.norm(g.value.trim()) === U.norm(g.dataset.a) || (g.value.trim().length >= 4 && U.stem(U.norm(g.value.trim())) === U.stem(U.norm(g.dataset.a))); g.classList.toggle('ok', good); g.classList.toggle('ko', !good); if (good) ok++; });
        const score = gaps.length ? +(ok / gaps.length * 10).toFixed(1) : 0;
        this.saveAttempt(t, 'Huecos · ' + secs.map(s => s.title).join(', ').slice(0, 80), score);
        const g = this.gradeBar(t, secs.map(s => s.id), score);
        $('#res').innerHTML = `<div class="card callout">Aciertos: <b>${ok}/${gaps.length}</b> → ${score}/10</div>` + g.html; g.bind();
      };
      $('#chk').onclick = check;
      $('#show').onclick = () => $$('.gap').forEach(g => { if (!g.classList.contains('ok')) { g.value = g.dataset.a; g.classList.add('ko'); } });
    };
    draw();
  },

  /* 🧠 Recordar y corregir (uno o varios apartados) */
  async _recordar(t, ids) {
    const secs = this.secs(t, ids);
    const mins = secs.reduce((a, s) => a + (s.minutes || Math.max(3, Math.round((s.text.match(/\S+/g) || []).length / 25))), 0);
    const key = 'rec:' + t.id + ':' + secs.map(s => s.id).join(',');
    this.root().innerHTML = this.head(secs.length === 1 ? secs[0].title : secs.length + ' apartados', 'Recordar · sin mirar') + `
      <div class="card"><b>Escribe o dicta todo lo que recuerdes de:</b><ol class="small" style="margin:8px 0 0 18px">${secs.map(s => `<li>${esc(s.title)}</li>`).join('')}</ol></div>
      <div class="row wrap sticky-tools"><button class="btn" id="dict">🎙 Dictar</button><button class="btn ghost" id="tmr">⏱ Cronometrar ${Timer.adapted(mins)} min</button><span class="clock" id="clk"></span><button class="btn ghost" id="peek">👀 Pista</button></div>
      <textarea id="ans" class="editor answer" placeholder="Empieza por el título del apartado y desarrolla las ideas en orden…">${esc(U.draft.get(key))}</textarea>
      <div class="row"><button class="btn primary" id="corr">Corregir</button><span class="muted small" id="saved"></span></div>
      <div id="res"></div>`;
    this.bindBack();
    const ta = $('#ans');
    ta.oninput = () => { U.draft.set(key, ta.value); $('#saved').textContent = 'Guardado automático · ' + (ta.value.match(/\S+/g) || []).length + ' palabras'; };
    $('#dict').onclick = () => Dictado.toggle(ta, $('#dict'));
    $('#tmr').onclick = () => Timer.start(Timer.adapted(mins), l => { const c = $('#clk'); if (c) c.textContent = U.mins(l); });
    let hint = 0; $('#peek').onclick = () => {
      const all = secs.flatMap(s => U.keyTerms(s.text, 12).map(k => k.w)); const w = all[hint++];
      toast(w ? 'Pista: ' + w : 'No hay más pistas');
    };
    $('#corr').onclick = async () => {
      Dictado.stop(); Timer.stop();
      const b = $('#corr'); b.disabled = true; b.textContent = 'Corrigiendo…';
      const r = await Eval.recall(secs.map(s => '## ' + s.title + '\n' + s.text).join('\n\n'), ta.value, secs.length === 1 ? 'un apartado de su tema' : 'varios apartados de su tema');
      b.disabled = false; b.textContent = 'Corregir de nuevo';
      await this.saveAttempt(t, 'Recordar · ' + secs.map(s => s.title).join(', ').slice(0, 90), r.nota, { answer: ta.value, eval: r });
      U.draft.del(key);
      const g = this.gradeBar(t, secs.map(s => s.id), r.nota);
      $('#res').innerHTML = Eval.html(r) + `<details class="card"><summary>Ver tu texto de referencia</summary><div class="reading">${esc(secs.map(s => '■ ' + s.title + '\n' + s.text).join('\n\n'))}</div></details>` + g.html;
      g.bind(); $('#res').scrollIntoView({ behavior: 'smooth' });
    };
  },

  /* 🗂 Índice */
  async _indice(t) {
    const key = 'idx:' + t.id;
    this.root().innerHTML = this.head(t.title, 'Índice de memoria · ' + t.sections.length + ' apartados') + `
      <p class="hint">Escribe o dicta los títulos de los apartados, uno por línea, en orden.</p>
      <div class="row wrap"><button class="btn" id="dict">🎙 Dictar</button></div>
      <textarea id="ans" class="editor answer" style="min-height:220px">${esc(U.draft.get(key))}</textarea>
      <button class="btn primary" id="corr">Comprobar</button><div id="res"></div>`;
    this.bindBack();
    const ta = $('#ans'); ta.oninput = () => U.draft.set(key, ta.value);
    $('#dict').onclick = () => Dictado.toggle(ta, $('#dict'));
    $('#corr').onclick = async () => {
      Dictado.stop();
      const lines = ta.value.split(/\n|(?<=\.)\s+(?=\d)/).map(x => x.trim()).filter(Boolean);
      let lastPos = -1, inOrder = 0;
      const rows = t.sections.map(s => {
        let best = -1, bs = 0; lines.forEach((l, i) => { const o = U.overlap(s.title.replace(/^[\d.\s)]+/, ''), l); if (o > bs) { bs = o; best = i; } });
        const found = bs >= 0.5; if (found && best > lastPos) { inOrder++; lastPos = best; }
        return { s, found };
      });
      const ok = rows.filter(r => r.found).length, score = +(ok / t.sections.length * 10 * (0.8 + 0.2 * inOrder / Math.max(1, ok))).toFixed(1);
      await this.saveAttempt(t, 'Índice', score);
      U.draft.del(key);
      $('#res').innerHTML = `<div class="card callout">Recordados <b>${ok} de ${t.sections.length}</b> apartados · nota ${score}/10${ok && inOrder < ok ? ' · alguno fuera de orden' : ''}</div>
        <div class="card">${rows.map((r, i) => `<div class="idx-row ${r.found ? 'ok' : 'ko'}"><span>${r.found ? '✓' : '✗'}</span><span>${i + 1}. ${esc(Temas.clean(r.s.title))}</span></div>`).join('')}</div>
        <div class="card callout">💡 Truco: crea un acrónimo con la primera letra de cada apartado: <b>${t.sections.map(s => (s.title.replace(/^[\d.\s)]+/, '').trim()[0] || '').toUpperCase()).join('')}</b></div>`;
    };
  },

  /* 🔗 Encadenar apartados (frases puente) */
  async _encadenar(t) {
    if (t.sections.length < 2) return toast('El tema necesita al menos 2 apartados', 'bad');
    const order = U.shuffle(t.sections.slice(0, -1).map((_, i) => i)); let k = 0, hits = 0;
    const draw = () => {
      if (k >= order.length) {
        const score = +(hits / order.length * 10).toFixed(1); this.saveAttempt(t, 'Encadenar apartados', score);
        this.root().innerHTML = this.head(t.title, 'Encadenar') + `<div class="card callout">Has acertado <b>${hits} de ${order.length}</b> enlaces · ${score}/10</div><button class="btn primary" id="again">Repetir</button>`;
        this.bindBack(); $('#again').onclick = () => this._encadenar(t); return;
      }
      const i = order[k], a = t.sections[i], b = t.sections[i + 1];
      this.root().innerHTML = this.head(t.title, 'Encadenar · ' + (k + 1) + ' de ' + order.length) + `
        <div class="card"><p class="muted small">Acabas de terminar…</p><h3>${esc(a.title)}</h3><p class="muted small" style="margin-top:6px">…${esc(U.sentences(a.text).slice(-1)[0] || '')}</p></div>
        <div class="field"><label>¿Qué apartado viene ahora y con qué frase lo enlazas?</label><textarea id="ans" class="editor answer" style="min-height:120px"></textarea></div>
        <div class="row"><button class="btn" id="dict">🎙 Dictar</button><button class="btn primary" id="chk">Comprobar</button></div><div id="res"></div>`;
      this.bindBack();
      $('#dict').onclick = () => Dictado.toggle($('#ans'), $('#dict'));
      $('#chk').onclick = () => {
        Dictado.stop(); const ok = U.overlap(b.title.replace(/^[\d.\s)]+/, ''), $('#ans').value) >= 0.5; if (ok) hits++;
        $('#res').innerHTML = `<div class="card ${ok ? 'okc' : 'koc'}"><b>${ok ? '✓ Correcto' : '✗ Era otro'}:</b> ${esc(b.title)}<p class="small muted" style="margin-top:8px">Cómo empieza: «${esc(U.sentences(b.text).slice(0, 2).join(' ').slice(0, 300))}»</p></div><button class="btn primary" id="nx">Siguiente →</button>`;
        $('#nx').onclick = () => { k++; draw(); };
      };
    };
    draw();
  },

  /* 🃏 Preguntas rápidas (IA) */
  async _tarjetas(t, ids) {
    const secs = this.secs(t, ids);
    if (!Eval.hasAI()) return toast('Las preguntas rápidas necesitan la IA (Ajustes)', 'bad');
    this.root().innerHTML = this.head(secs.length === 1 ? secs[0].title : secs.length + ' apartados', 'Preguntas rápidas') + '<div class="card">Preparando preguntas…</div>';
    this.bindBack();
    let cards;
    try {
      const r = await Providers.json({ system: 'Creas tarjetas de memorización para oposiciones de Orientación Educativa. Devuelve SOLO JSON {"tarjetas":[{"p":"pregunta breve y concreta","r":"respuesta en 1-3 frases, fiel al texto"}]}. Entre 6 y 12 tarjetas, centradas en conceptos clave, autores, clasificaciones, datos y normativa que aparecen en el texto. No inventes nada que no esté en el texto.', messages: [{ role: 'user', content: secs.map(s => '## ' + s.title + '\n' + s.text).join('\n\n').slice(0, 60000) }] });
      cards = U.shuffle(r.tarjetas || []);
    } catch (e) { this.root().innerHTML += `<div class="card koc"><b>No se pudieron crear las preguntas.</b><pre class="err-pre">${esc(e.message)}</pre></div>`; return; }
    let i = 0, ok = 0;
    const draw = () => {
      if (i >= cards.length) {
        const score = +(ok / cards.length * 10).toFixed(1); this.saveAttempt(t, 'Preguntas rápidas · ' + secs.map(s => s.title).join(', ').slice(0, 80), score);
        const g = this.gradeBar(t, secs.map(s => s.id), score);
        this.root().innerHTML = this.head('Resultado', 'Preguntas rápidas') + `<div class="card callout">Sabías <b>${ok} de ${cards.length}</b> · ${score}/10</div>` + g.html; this.bindBack(); g.bind(); return;
      }
      const c = cards[i];
      this.root().innerHTML = this.head('Pregunta ' + (i + 1) + ' de ' + cards.length, 'Preguntas rápidas') + `
        <div class="card flash"><p class="q">${esc(c.p)}</p><div class="a" id="a" hidden>${esc(c.r)}</div></div>
        <div class="row" id="ctl"><button class="btn ghost" id="say">🔊</button><button class="btn primary" id="show">Ver respuesta</button></div>`;
      this.bindBack();
      $('#say').onclick = () => Lector.read(c.p);
      $('#show').onclick = () => { $('#a').hidden = false; $('#ctl').innerHTML = '<button class="btn" id="no">No la sabía</button><button class="btn primary" id="si">La sabía</button>'; $('#no').onclick = () => { i++; draw(); }; $('#si').onclick = () => { ok++; i++; draw(); }; };
    };
    draw();
  },

  /* ⏱ Simulacro de tema completo */
  async _completo(t) {
    const total = Timer.adapted(State.settings.examMinutes || 120);
    const budget = Temas.budget(t, total); const key = 'full:' + t.id;
    let acc = 0; const marks = budget.map(m => (acc += m));
    this.root().innerHTML = this.head(t.title, 'Simulacro · tema completo') + `
      <div class="card"><div class="row between wrap"><div><span class="clock big" id="clk">${U.mins(total * 60)}</span> <span class="muted small">de ${total} min${State.settings.extraTime ? ' (incluye +' + State.settings.extraTime + '% de adaptación)' : ''}</span></div>
        <div class="row"><button class="btn primary" id="go">▶ Empezar</button><button class="btn ghost" id="pz" disabled>⏸</button></div></div>
        <div class="plan" id="plan">${t.sections.map((s, i) => `<div class="pl" data-i="${i}"><span>${esc(s.title.slice(0, 46))}</span><b>${budget[i]}′</b></div>`).join('')}</div>
        <p class="hint">Plan orientativo por apartado. El apartado que «toca» se resalta según el tiempo.</p></div>
      <div class="row wrap sticky-tools"><button class="btn" id="dict">🎙 Dictar</button><label class="chk"><input type="checkbox" id="showIdx"/> Ver índice (desactívalo para examen real)</label><span class="muted small" id="saved"></span></div>
      <div id="idxBox" class="card small" hidden>${esc(Temas.index(t)).replace(/\n/g, '<br>')}</div>
      <textarea id="ans" class="editor answer" style="min-height:55vh" placeholder="Desarrolla el tema completo…">${esc(U.draft.get(key))}</textarea>
      <div class="row"><button class="btn primary" id="corr">Entregar y corregir</button></div><div id="res"></div>`;
    this.bindBack();
    const ta = $('#ans');
    ta.oninput = () => { U.draft.set(key, ta.value); $('#saved').textContent = '✓ guardado · ' + (ta.value.match(/\S+/g) || []).length + ' palabras'; };
    $('#dict').onclick = () => Dictado.toggle(ta, $('#dict'));
    $('#showIdx').onchange = e => $('#idxBox').hidden = !e.target.checked;
    $('#go').onclick = () => {
      $('#go').disabled = true; $('#pz').disabled = false; this.ctx.started = Date.now();
      Timer.start(total, (l, tot) => {
        const c = $('#clk'); if (!c) return Timer.stop(); c.textContent = U.mins(l);
        const el2 = (tot - l) / 60; const cur = marks.findIndex(m => el2 < m);
        $$('#plan .pl').forEach((p, i) => { p.classList.toggle('now', i === cur); p.classList.toggle('past', cur === -1 ? true : i < cur); });
      });
    };
    $('#pz').onclick = () => { Timer.paused = !Timer.paused; $('#pz').textContent = Timer.paused ? '▶' : '⏸'; };
    $('#corr').onclick = async () => {
      if (!ta.value.trim()) return toast('No hay texto que corregir', 'bad');
      Dictado.stop(); Timer.stop();
      const b = $('#corr'); b.disabled = true; b.textContent = 'Corrigiendo (puede tardar un poco)…';
      const r = await Eval.recall(Temas.fullText(t), ta.value, 'un tema completo de oposición (tema completo, valora también introducción, conclusión, bibliografía y presentación)');
      b.disabled = false; b.textContent = 'Corregir de nuevo';
      const fresh = await Temas.get(t.id);
      if (r.apartados) {      // actualiza el repaso de cada apartado según su cobertura
        fresh.sections.forEach(s => { const a = r.apartados.find(x => U.overlap(s.title, x.titulo || '') > 0.5); if (a) SRS.grade(s, a.cobertura < 50 ? 0 : a.cobertura < 70 ? 1 : a.cobertura < 88 ? 2 : 3, +(a.cobertura / 10).toFixed(1)); });
        await Temas.save(fresh); this.ctx.t = fresh;
      }
      await this.saveAttempt(t, 'Simulacro completo', r.nota, { answer: ta.value, eval: r, durationSec: Timer.elapsed() || undefined });
      U.draft.del(key);
      $('#res').innerHTML = Eval.html(r) + (r.apartados ? '<div class="card callout">El repaso de cada apartado se ha programado según lo que has recordado.</div>' : '');
      $('#res').scrollIntoView({ behavior: 'smooth' });
    };
  },

  /* 🎓 Defensa oral: abre la conversación con el tema cargado */
  async _tribunal(t) {
    UI.go('sesion'); UI.selectedMode = 'oposicion'; renderModes();
    $('#sessionTopic').value = (t.num ? 'Tema ' + t.num + ': ' : '') + t.title;
    await renderRagPicker(); $$('#ragPicker input').forEach(c => { if ((t.docIds || []).includes(c.value)) c.checked = true; });
    State.sessionExtra = 'El tema que la opositora ha preparado tiene este índice:\n' + Temas.index(t) + '\nPregunta sobre sus apartados, pide que desarrolle, justifique, relacione con la práctica en un centro de Castilla-La Mancha y cite normativa. Resumen del contenido del tema (para que tus preguntas sean pertinentes):\n' + Temas.fullText(t).slice(0, 12000);
    toast('Tema cargado. Pulsa «Empezar por voz» o «Modo escrito».', 'ok');
  }
};

/* ---------------------------------------------------------------------
   I · REPASO DE HOY (cola de apartados de todos los temas)
   --------------------------------------------------------------------- */
const Repaso = {
  queue: [], energy: 'media',
  async items() {
    const temas = await Temas.list(); const out = [];
    for (const t of temas) for (const s of t.sections || []) if (SRS.isDue(s)) out.push({ t, s });
    return out.sort((a, b) => (a.s.srs.due).localeCompare(b.s.srs.due) || (a.s.srs.score ?? 10) - (b.s.srs.score ?? 10));
  },
  async newOnes() { const temas = (await Temas.list()).filter(t => t.selected); const out = []; for (const t of temas) for (const s of t.sections || []) if (!s.srs) out.push({ t, s }); return out; },
  async render() {
    const items = await this.items(), nuevos = await this.newOnes();
    const left = U.daysTo(State.settings.examDate);
    $('#repasoRoot').innerHTML = `
      ${left != null && left >= 0 ? `<div class="card callout">📅 Quedan <b>${left} días</b> para el examen (${U.fdate(State.settings.examDate)}).</div>` : ''}
      <div class="card"><h3>¿Cómo vas de energía hoy?</h3><p class="hint">Adapta el tipo de repaso a cómo te encuentras. Todo cuenta.</p>
        <div class="seg big" id="en">${[['baja', '🌙 Baja', 'Leer y escuchar'], ['media', '🌤 Media', 'Rellenar huecos'], ['alta', '☀️ Alta', 'Recordar y corregir']].map(([k, l, d]) => `<button data-e="${k}" class="${this.energy === k ? 'on' : ''}"><b>${l}</b><small>${d}</small></button>`).join('')}</div>
        <div class="row wrap" style="margin-top:14px"><label class="small">Bloque de</label><select id="blk" style="width:auto">${[3, 5, 8, 12].map(n => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="small muted">apartados · luego descansa</span></div></div>
      <div class="grid cols-2">
        <div class="card"><h3>Para repasar hoy · ${items.length}</h3>${items.length ? items.slice(0, 12).map(x => `<div class="doc-row"><span class="rag-dot" style="background:${SRS.status(x.s).c}"></span><div class="info"><b>${esc(x.s.title)}</b><span>${x.t.num ? 'Tema ' + esc(x.t.num) + ' · ' : ''}${esc(x.t.title.slice(0, 50))}</span></div></div>`).join('') + (items.length > 12 ? `<p class="muted small">…y ${items.length - 12} más</p>` : '') : '<p class="muted small">Nada pendiente. 🎉</p>'}
          <button class="btn primary" id="goDue" ${items.length ? '' : 'disabled'}>Empezar repaso</button></div>
        <div class="card"><h3>Apartados nuevos · ${nuevos.length}</h3><p class="hint">De tus temas seleccionados (★) que aún no has trabajado.</p>
          <button class="btn" id="goNew" ${nuevos.length ? '' : 'disabled'}>Aprender apartados nuevos</button></div>
      </div>`;
    $$('#en button').forEach(b => b.onclick = () => { this.energy = b.dataset.e; this.render(); });
    const run = list => { const n = +$('#blk').value; this.queue = list.slice(0, n); this.total = this.queue.length; this.next(); };
    $('#goDue').onclick = () => run(items);
    $('#goNew').onclick = () => { const e = this.energy; this.energy = e === 'alta' ? 'media' : e; run(nuevos); this.energy = e; };
  },
  next() {
    const it = this.queue.shift();
    if (!it) { UI.go('repaso'); toast('Bloque terminado ✓ Descansa unos minutos.', 'ok'); return; }
    const mode = { baja: 'estudiar', media: 'huecos', alta: 'recordar' }[this.energy];
    Entreno.start(it.t, mode, [it.s.id], true);
  }
};

/* ---------------------------------------------------------------------
   J · SUPUESTOS PRÁCTICOS
   --------------------------------------------------------------------- */
const FASES = [
  'Análisis del caso e identificación de necesidades',
  'Fundamentación teórica y normativa',
  'Propuesta de intervención y medidas (DUA, medidas de inclusión)',
  'Agentes implicados y coordinación (familia, tutoría, equipo docente, EOA, servicios externos)',
  'Temporalización, seguimiento y evaluación'
];
const Supuestos = {
  root() { return $('#supRoot'); },
  async list() { return State.profile ? (await DB.byIndex('supuestos', 'profile', State.profile.id)).sort((a, b) => b.created - a.created) : []; },
  detectQuestions(text) {
    const qs = []; for (const l of text.split('\n')) { const s = l.trim(); if (/^(\d{1,2}|[a-h])[.)]\s+\S/i.test(s) || (/\?$/.test(s) && s.length > 15)) qs.push(s.replace(/^(\d{1,2}|[a-h])[.)]\s+/i, '')); }
    return qs;
  },
  async renderList() {
    const list = await this.list();
    this.root().innerHTML = `
      <div class="toolbar"><button class="btn primary" id="sNew">+ Añadir supuesto</button><button class="btn" id="sGen">🤖 Generar con IA</button><button class="btn" id="sDoc">📄 Extraer de un documento</button></div>
      ${list.length ? list.map(s => `<button class="sup-card" data-id="${s.id}"><b>${esc(s.title)}</b><span class="small muted">${esc([s.etapa, s.ambito].filter(Boolean).join(' · '))} · ${s.preguntas.length} pregunta${s.preguntas.length === 1 ? '' : 's'}${s.modelo ? ' · con solución' : ''}${s.lastScore != null ? ' · última nota ' + (+s.lastScore).toFixed(1) : ''}</span></button>`).join('') : '<div class="empty">Sin supuestos todavía. Añade los de tu academia o convocatorias anteriores, o genera uno con IA.</div>'}`;
    $('#sNew').onclick = () => this.edit(null);
    $('#sGen').onclick = () => this.generate();
    $('#sDoc').onclick = () => this.fromDoc();
    $$('.sup-card', this.root()).forEach(b => b.onclick = () => this.detail(b.dataset.id));
  },
  async edit(id, preset) {
    const s = id ? await DB.get('supuestos', id) : Object.assign({ id: uid(), profileId: State.profile.id, title: '', etapa: '', ambito: '', enunciado: '', preguntas: [], modelo: '', created: Date.now() }, preset || {});
    this.root().innerHTML = `<button class="btn ghost back" id="bk">← Supuestos</button>
      <div class="card">
        <div class="field"><label>Título</label><input id="sT" value="${esc(s.title)}" placeholder="p. ej. Alumno de 3.º de Primaria con sospecha de TEA"/></div>
        <div class="grid cols-2 tight"><div class="field"><label>Etapa</label><input id="sE" value="${esc(s.etapa)}" placeholder="Infantil, Primaria, ESO…"/></div><div class="field"><label>Ámbito</label><input id="sA" value="${esc(s.ambito)}" placeholder="NEAE, convivencia, absentismo…"/></div></div>
        <div class="field"><label>Enunciado</label><textarea id="sEn" class="editor" style="min-height:180px">${esc(s.enunciado)}</textarea></div>
        <div class="field"><label>Preguntas (una por línea) <button class="btn ghost sm" id="sDet" type="button">Detectar en el enunciado</button></label><textarea id="sQ" class="editor" style="min-height:110px">${esc(s.preguntas.join('\n'))}</textarea></div>
        <div class="field"><label>Solución modelo (opcional, sirve para comparar)</label><textarea id="sM" class="editor" style="min-height:120px">${esc(s.modelo || '')}</textarea></div>
        <div class="row"><button class="btn primary" id="sSave">Guardar</button>${id ? '<button class="btn ghost danger" id="sDel">Eliminar</button>' : ''}</div></div>`;
    $('#bk').onclick = () => id ? this.detail(id) : this.renderList();
    $('#sDet').onclick = () => { const q = this.detectQuestions($('#sEn').value); if (q.length) $('#sQ').value = q.join('\n'); else toast('No encontré preguntas numeradas', 'bad'); };
    $('#sSave').onclick = async () => {
      s.title = $('#sT').value.trim() || 'Supuesto sin título'; s.etapa = $('#sE').value.trim(); s.ambito = $('#sA').value.trim(); s.enunciado = $('#sEn').value.trim();
      s.preguntas = $('#sQ').value.split('\n').map(x => x.trim()).filter(Boolean); if (!s.preguntas.length) s.preguntas = ['Resuelve el supuesto de forma completa y fundamentada.'];
      s.modelo = $('#sM').value.trim(); await DB.put('supuestos', s); toast('Supuesto guardado ✓', 'ok'); this.detail(s.id);
    };
    $('#sDel') && ($('#sDel').onclick = async () => { if (await modal('Eliminar supuesto', '<p>¿Seguro?</p>', [{ label: 'Cancelar', value: false }, { label: 'Eliminar', cls: 'danger', value: true }])) { await DB.del('supuestos', s.id); this.renderList(); } });
  },
  async generate() {
    if (!Eval.hasAI()) return toast('Necesitas la IA configurada en Ajustes', 'bad');
    const html = `<div class="field"><label>Etapa</label><select id="gE"><option>Educación Infantil</option><option selected>Educación Primaria</option><option>ESO</option><option>Bachillerato / FP</option></select></div>
      <div class="field"><label>Ámbito</label><select id="gA"><option>Evaluación psicopedagógica y NEAE</option><option>TEA</option><option>TDAH</option><option>Altas capacidades</option><option>Dificultades de aprendizaje (lectura, escritura)</option><option>Convivencia y acoso escolar</option><option>Bienestar emocional y conducta</option><option>Absentismo</option><option>Orientación académica y profesional</option><option>Asesoramiento al profesorado / DUA</option><option>Familias</option><option>Transición entre etapas</option><option>Plan de actuación del EOA / organización</option></select></div>
      <div class="field"><label>Detalle (opcional)</label><input id="gD" placeholder="p. ej. alumna recién llegada, centro rural…"/></div>
      <div class="field"><label>Nº de preguntas</label><select id="gN"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></div>`;
    if (!await modal('Generar supuesto con IA', html, [{ label: 'Cancelar', value: false }, { label: 'Generar', cls: 'primary', value: true }])) return;
    const p = { etapa: $('#gE').value, ambito: $('#gA').value, det: $('#gD').value, n: $('#gN').value };
    this.root().innerHTML = '<div class="card">Generando supuesto…</div>';
    try {
      const r = await Providers.json({
        system: `Eres un tribunal de oposiciones de Orientación Educativa (Secundaria) en Castilla-La Mancha. Redactas supuestos prácticos realistas, del estilo de los de las convocatorias, situados en un centro público. Normativa de referencia que maneja la opositora (no cites normas que no existan; si dudas de un número, no lo pongas):\n${Eval.normativa()}\nDevuelve SOLO JSON: {"titulo":"…","enunciado":"caso detallado de 150-300 palabras con datos del alumnado, centro y contexto","preguntas":["…"],"solucion_modelo":"esquema de resolución de 250-450 palabras, por preguntas"}`,
        messages: [{ role: 'user', content: `Etapa: ${p.etapa}. Ámbito: ${p.ambito}. ${p.det ? 'Detalle: ' + p.det + '.' : ''} Número de preguntas: ${p.n}.` }]
      });
      await this.edit(null, { title: r.titulo, etapa: p.etapa, ambito: p.ambito, enunciado: r.enunciado, preguntas: r.preguntas || [], modelo: (r.solucion_modelo ? '[Solución orientativa generada por IA: contrástala con tu normativa]\n' + r.solucion_modelo : '') });
      toast('Revisa el supuesto y pulsa Guardar', 'ok');
    } catch (e) { this.renderList(); showAIError(e, 'No se pudo generar el supuesto'); }
  },
  async fromDoc() {
    const docs = await DB.byIndex('docs', 'profile', State.profile.id);
    const html = `<p class="small">Elige un documento de la Biblioteca o sube uno nuevo (PDF de supuestos de tu academia, de convocatorias, etc.).</p>
      <div class="field"><select id="fdD"><option value="">— Biblioteca —</option>${docs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div>
      <div class="field"><input type="file" id="fdF" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"/></div>`;
    if (!await modal('Extraer supuestos de un documento', html, [{ label: 'Cancelar', value: false }, { label: 'Extraer', cls: 'primary', value: true }])) return;
    const f = $('#fdF')?.files?.[0]; let docId = $('#fdD')?.value;
    this.root().innerHTML = '<div class="card">Leyendo el documento…</div>';
    if (f) docId = (await Docs.ingest(f)).id;
    if (!docId) return this.renderList();
    const text = await Docs.text(docId);
    if (!Eval.hasAI()) { await this.edit(null, { title: 'Supuesto de ' + ((await DB.get('docs', docId))?.name || 'documento'), enunciado: text.slice(0, 8000), preguntas: this.detectQuestions(text) }); return; }
    try {
      const r = await Providers.json({ system: 'Extraes supuestos prácticos de oposición de un documento. Devuelve SOLO JSON {"supuestos":[{"titulo":"…","etapa":"…","ambito":"…","enunciado":"texto literal del caso","preguntas":["…literal…"],"solucion":"solución literal si el documento la incluye, si no cadena vacía"}]}. Copia literalmente, no inventes.', messages: [{ role: 'user', content: text.slice(0, 150000) }] });
      const list = r.supuestos || [];
      for (const x of list) await DB.put('supuestos', { id: uid(), profileId: State.profile.id, title: x.titulo || 'Supuesto', etapa: x.etapa || '', ambito: x.ambito || '', enunciado: x.enunciado || '', preguntas: (x.preguntas && x.preguntas.length) ? x.preguntas : ['Resuelve el supuesto de forma completa y fundamentada.'], modelo: x.solucion || '', docId, created: Date.now() });
      toast(list.length + ' supuesto(s) añadidos ✓', 'ok'); this.renderList();
    } catch (e) { this.renderList(); showAIError(e, 'No se pudieron extraer los supuestos'); }
  },
  async detail(id) {
    const s = await DB.get('supuestos', id); if (!s) return this.renderList();
    const at = (await DB.byIndex('attempts', 'item', id)).sort((a, b) => b.at - a.at);
    const tot = Timer.adapted(State.settings.supMinutes || 120);
    this.root().innerHTML = `<button class="btn ghost back" id="bk">← Supuestos</button>
      <div class="view-head"><div class="eyebrow">${esc([s.etapa, s.ambito].filter(Boolean).join(' · ') || 'Supuesto práctico')}</div><h1 style="font-size:clamp(20px,3.6vw,28px)">${esc(s.title)}</h1></div>
      <div class="card reading">${esc(s.enunciado)}</div>
      <div class="card"><h3>Preguntas</h3>${s.preguntas.map((q, i) => `<label class="sec-row"><input type="checkbox" value="${i}"/><span class="num">${i + 1}</span><span class="tt">${esc(q)}</span></label>`).join('')}</div>
      <h3 class="sect">Entrenar</h3>
      <div class="train-grid">
        <button class="train" data-m="completo"><b>⏱ Supuesto completo</b><span>Todas las preguntas, cronometrado (${tot} min con adaptación).</span></button>
        <button class="train" data-m="preguntas"><b>✂️ Solo las preguntas marcadas</b><span>Resuelve una parte; tiempo proporcional.</span></button>
        <button class="train" data-m="fase"><b>🧱 Por fases</b><span>Trabaja solo una fase de la resolución (p. ej. la normativa o la propuesta).</span></button>
        <button class="train" data-m="esquema"><b>📝 Esquema en 15 min</b><span>Solo la estructura de la respuesta: ideal en días de poca energía.</span></button>
        <button class="train" data-m="oral"><b>🎓 Defensa oral</b><span>El tribunal te pregunta por voz sobre tu resolución.</span></button>
      </div>
      <div class="card"><h3>Historial</h3>${at.length ? at.slice(0, 6).map(a => `<div class="doc-row"><div class="ic">${a.score != null ? (+a.score).toFixed(1) : '·'}</div><div class="info"><b>${esc(a.label)}</b><span>${fmtDate(a.at)}</span></div></div>`).join('') : '<p class="muted small">Sin intentos.</p>'}</div>
      <div class="row" style="margin-top:12px"><button class="btn" id="ed">✏️ Editar</button>${s.modelo ? '<button class="btn ghost" id="vm">Ver solución modelo</button>' : ''}</div>`;
    $('#bk').onclick = () => this.renderList();
    $('#ed').onclick = () => this.edit(id);
    $('#vm') && ($('#vm').onclick = () => modal('Solución modelo', `<div class="reading" style="max-height:60vh;overflow:auto">${esc(s.modelo)}</div>`, [{ label: 'Cerrar', value: 1 }]));
    $$('.train', this.root()).forEach(b => b.onclick = async () => {
      const m = b.dataset.m; const sel = $$('.sec-row input', this.root()).filter(x => x.checked).map(x => +x.value);
      if (m === 'completo') return this.train(s, { label: 'Supuesto completo', parts: s.preguntas.map((q, i) => ({ q, i })), minutes: tot });
      if (m === 'preguntas') { if (!sel.length) return toast('Marca al menos una pregunta', 'bad'); return this.train(s, { label: 'Preguntas ' + sel.map(i => i + 1).join(', '), parts: sel.map(i => ({ q: s.preguntas[i], i })), minutes: Math.max(10, Math.round(tot / s.preguntas.length * sel.length)) }); }
      if (m === 'fase') {
        const f = await modal('¿Qué fase quieres trabajar?', FASES.map((x, i) => `<label class="chk" style="display:flex;margin:8px 0"><input type="radio" name="fz" value="${i}" ${i === 0 ? 'checked' : ''}/> ${esc(x)}</label>`).join(''), [{ label: 'Cancelar', value: null }, { label: 'Empezar', cls: 'primary', value: 'ok' }]);
        if (!f) return; const i = +document.querySelector('input[name=fz]:checked')?.value || 0;
        return this.train(s, { label: 'Fase: ' + FASES[i], parts: [{ q: FASES[i] + ' (para el conjunto del supuesto)', i: -1 }], minutes: Timer.adapted(20), fase: FASES[i] });
      }
      if (m === 'esquema') return this.train(s, { label: 'Esquema rápido', parts: [{ q: 'Esquema de la resolución completa: apartados, ideas clave, medidas y normativa (sin desarrollar)', i: -1 }], minutes: Timer.adapted(15), esquema: true });
      if (m === 'oral') {
        UI.go('sesion'); UI.selectedMode = 'supuesto'; renderModes(); $('#sessionTopic').value = s.title;
        State.sessionExtra = 'Supuesto práctico que debe defender oralmente:\n' + s.enunciado + '\nPreguntas: ' + s.preguntas.join(' | ') + (s.modelo ? '\nPuntos que debería tocar (no los reveles): ' + s.modelo.slice(0, 4000) : '');
        toast('Supuesto cargado. Pulsa «Empezar por voz».', 'ok');
      }
    });
  },
  async train(s, cfg) {
    Dictado.stop(); Timer.stop(); const started = Date.now();
    const key = 'sup:' + s.id + ':' + cfg.label; let saved = {}; try { saved = JSON.parse(U.draft.get(key) || '{}'); } catch (e) {}
    let cur = 0;
    this.root().innerHTML = `<button class="btn ghost back" id="bk">← Volver al supuesto</button>
      <div class="view-head"><div class="eyebrow">${esc(cfg.label)}</div><h1 style="font-size:clamp(20px,3.6vw,26px)">${esc(s.title)}</h1></div>
      <details class="card" open><summary>Enunciado</summary><div class="reading small">${esc(s.enunciado)}</div></details>
      <div class="row between wrap sticky-tools"><div class="row"><span class="clock big" id="clk">${U.mins(cfg.minutes * 60)}</span><button class="btn primary sm" id="go">▶</button><button class="btn ghost sm" id="pz">⏸</button></div><button class="btn" id="dict">🎙 Dictar</button></div>
      ${cfg.parts.length > 1 ? `<div class="tabs" id="tabs">${cfg.parts.map((p, k) => `<button data-k="${k}" class="${k === 0 ? 'on' : ''}">P${p.i + 1}</button>`).join('')}</div>` : ''}
      <p class="qtitle" id="qt">${esc(cfg.parts[0].q)}</p>
      <textarea id="ans" class="editor answer" style="min-height:45vh"></textarea>
      <div class="row"><button class="btn primary" id="corr">Entregar y corregir</button><span class="muted small" id="saved"></span></div><div id="res"></div>`;
    const ta = $('#ans'); const answers = cfg.parts.map((_, k) => saved[k] || '');
    const show = k => { answers[cur] = ta.value; cur = k; ta.value = answers[k]; $('#qt').textContent = cfg.parts[k].q; $$('#tabs button').forEach((b, j) => b.classList.toggle('on', j === k)); };
    ta.value = answers[0];
    ta.oninput = () => { answers[cur] = ta.value; U.draft.set(key, JSON.stringify(answers)); $('#saved').textContent = '✓ guardado'; };
    $$('#tabs button').forEach(b => b.onclick = () => { Dictado.stop(); show(+b.dataset.k); });
    $('#bk').onclick = () => { Dictado.stop(); Timer.stop(); this.detail(s.id); };
    $('#dict').onclick = () => Dictado.toggle(ta, $('#dict'));
    $('#go').onclick = () => Timer.start(cfg.minutes, l => { const c = $('#clk'); if (!c) return Timer.stop(); c.textContent = U.mins(l); });
    $('#pz').onclick = () => { Timer.paused = !Timer.paused; };
    $('#corr').onclick = async () => {
      answers[cur] = ta.value; Dictado.stop(); Timer.stop();
      if (!answers.some(a => a.trim())) return toast('No hay respuesta', 'bad');
      const b = $('#corr'); b.disabled = true; b.textContent = 'Corrigiendo…';
      const r = await this.evaluate(s, cfg, answers);
      b.disabled = false; b.textContent = 'Corregir de nuevo';
      await DB.put('attempts', { id: uid(), profileId: State.profile.id, itemId: s.id, kind: 'supuesto', label: cfg.label, score: r.nota, answer: answers, eval: r, durationSec: Math.round((Date.now() - started) / 1000), at: Date.now() });
      s.lastScore = r.nota; await DB.put('supuestos', s); U.draft.del(key);
      $('#res').innerHTML = this.evalHtml(r); $('#res').scrollIntoView({ behavior: 'smooth' });
    };
  },
  async evaluate(s, cfg, answers) {
    const resp = cfg.parts.map((p, k) => 'PREGUNTA: ' + p.q + '\nRESPUESTA:\n' + (answers[k] || '(sin responder)')).join('\n\n');
    if (!Eval.hasAI()) {
      const ref = s.modelo || s.enunciado; const l = Eval.local(ref, answers.join('\n'));
      return { nota: l.nota, resumen: 'Corrección aproximada sin IA (palabras clave' + (s.modelo ? ' de la solución modelo' : ' del enunciado') + '). Configura la IA para una valoración de tribunal.', fortalezas: [], mejoras: l.ideas_ausentes.map(x => 'Falta: ' + x), normativa_revisar: l.normativa_olvidada, source: 'local' };
    }
    try {
      const r = await Providers.json({
        system: `Eres tribunal de oposiciones de Orientación Educativa (Cuerpo de Profesores de Enseñanza Secundaria, Castilla-La Mancha). Corriges ${cfg.esquema ? 'el ESQUEMA de resolución' : cfg.fase ? 'solo la fase «' + cfg.fase + '»' : 'la resolución'} de un supuesto práctico. Criterios: identificación de necesidades; fundamentación teórica y normativa vigente; concreción, realismo y viabilidad de las medidas con los recursos de un centro público; implicación y coordinación de agentes; temporalización, seguimiento y evaluación; claridad y estructura. Normativa de referencia de la opositora:\n${Eval.normativa()}\nSi no estás seguro de un número o fecha de norma, dilo expresamente («verificar»). Español de España, concreto, sin adornos.
Devuelve SOLO JSON: {"nota":0-10,"por_pregunta":[{"pregunta":"…","nota":0-10,"comentario":"…"}],"fortalezas":["…"],"mejoras":["…"],"medidas_omitidas":["medidas o agentes relevantes que no aparecen"],"normativa_bien":["…"],"normativa_revisar":["…"],"comparacion_modelo":"si hay solución modelo, 1-3 frases de comparación","resumen":"2-3 frases"}`,
        messages: [{ role: 'user', content: 'SUPUESTO:\n' + s.enunciado + (s.modelo ? '\n\nSOLUCIÓN MODELO (referencia, no la conoce la opositora):\n' + s.modelo : '') + '\n\n=====\n' + resp }]
      });
      r.source = 'ia'; r.nota = +r.nota || 0; return r;
    } catch (e) { showAIError(e, 'La IA no ha podido corregir el supuesto'); return { nota: 0, resumen: 'No se pudo corregir con IA. Error: ' + e.message, source: 'local' }; }
  },
  evalHtml(r) {
    const li = (a, c) => (a && a.length) ? `<ul class="fb-list">${a.map(x => `<li><span class="dot" style="background:${c}"></span><span>${esc(x)}</span></li>`).join('')}</ul>` : '<p class="muted small">—</p>';
    const col = r.nota < 5 ? 'var(--bad)' : r.nota < 7.5 ? 'var(--warn)' : 'var(--ok)';
    return `<div class="grid cols-2"><div class="card stat"><div class="n" style="color:${col}">${(+r.nota).toFixed(1)}</div><div class="l">Nota /10</div></div><div class="card"><p>${esc(r.resumen || '')}</p>${r.comparacion_modelo ? `<p class="small muted" style="margin-top:8px">Frente al modelo: ${esc(r.comparacion_modelo)}</p>` : ''}</div></div>
      ${r.por_pregunta?.length ? `<div class="card"><h3>Por pregunta</h3>${r.por_pregunta.map(p => `<div class="gauge"><div class="top"><span>${esc(p.pregunta.slice(0, 80))}</span><b>${p.nota}</b></div><div class="bar"><i style="width:${p.nota * 10}%"></i></div><p class="small muted">${esc(p.comentario || '')}</p></div>`).join('')}</div>` : ''}
      <div class="grid cols-2"><div class="card"><h3>Fortalezas</h3>${li(r.fortalezas, 'var(--ok)')}</div><div class="card"><h3>A mejorar</h3>${li(r.mejoras, 'var(--warn)')}</div>
      <div class="card"><h3>Medidas o agentes que faltan</h3>${li(r.medidas_omitidas, 'var(--signal)')}</div><div class="card"><h3>Normativa</h3><p class="small muted">Bien:</p>${li(r.normativa_bien, 'var(--ok)')}<p class="small muted">Revisar:</p>${li(r.normativa_revisar, 'var(--bad)')}</div></div>`;
  }
};

/* ---------------------------------------------------------------------
   K · INTEGRACIÓN CON LA APP (inicio, progreso, ajustes)
   --------------------------------------------------------------------- */
const Estudio = {
  init() {
    if (!Modes.find(m => m.id === 'supuesto')) Modes.push({ id: 'supuesto', mic: '🧩', name: 'Supuesto práctico', desc: 'Defiendes oralmente un supuesto.', role: 'un examinador que plantea un supuesto práctico y evalúa tu resolución oral' });
    const n = $('#normativaRef'); if (n) { n.value = State.settings.normativaRef || ''; n.onchange = () => { State.settings.normativaRef = n.value; State.saveSettings(); toast('Normativa guardada', 'ok'); }; }
    const d = $('#examDate'); if (d) { d.value = State.settings.examDate || ''; d.onchange = () => { State.settings.examDate = d.value; State.saveSettings(); }; }
    const sm = $('#supMinutes'); if (sm) { sm.value = State.settings.supMinutes || 120; sm.onchange = () => { State.settings.supMinutes = +sm.value || 120; State.saveSettings(); }; }
    this.onView('inicio');
  },
  async onView(v) {
    if (v !== 'temario' && v !== 'repaso') { Dictado.stop(); Lector.stop(); }
    // Las pantallas de entrenamiento reutilizan identificadores: solo una puede existir a la vez
    for (const [view, id] of [['temario', 'temarioRoot'], ['repaso', 'repasoRoot'], ['supuestos', 'supRoot']]) if (view !== v) { const r = $('#' + id); if (r) r.innerHTML = ''; }
    if (v !== 'temario' && v !== 'repaso' && v !== 'supuestos') Timer.stop();
    if (v === 'temario' && !this._skipList) TemarioUI.renderList();
    if (v === 'repaso' && !this._skipList) Repaso.render();
    if (v === 'supuestos') Supuestos.renderList();
    if (v === 'inicio') this.homePlan();
    if (v === 'stats') this.studyStats();
  },
  async homePlan() {
    const box = $('#homePlan'); if (!box || !State.profile) return;
    const due = await Repaso.items(); const temas = await Temas.list(); const left = U.daysTo(State.settings.examDate);
    const lb = (await DB.get('kv', 'lastBackup:' + State.profile.id))?.v; const bdays = lb ? Math.floor((Date.now() - lb) / 86400000) : null;
    box.innerHTML = `<div class="grid cols-3">
      <button class="card plan-card" data-go="repaso"><div class="n">${due.length}</div><div class="l">apartados para repasar hoy</div></button>
      <button class="card plan-card" data-go="temario"><div class="n">${temas.filter(t => t.selected).length}<small>/${temas.length}</small></div><div class="l">temas seleccionados</div></button>
      <div class="card plan-card"><div class="n">${left != null && left >= 0 ? left : '—'}</div><div class="l">días para el examen</div></div></div>
      ${(bdays == null && temas.length) || bdays > 7 ? `<div class="card callout">💾 ${bdays == null ? 'Aún no has hecho' : 'Hace ' + bdays + ' días de tu última'} copia de seguridad. <a href="#" id="bkp">Hacerla ahora</a> (también sirve para pasar tus temas al móvil).</div>` : ''}`;
    $$('[data-go]', box).forEach(b => b.onclick = () => UI.go(b.dataset.go));
    $('#bkp') && ($('#bkp').onclick = e => { e.preventDefault(); exportData().then(() => this.homePlan()); });
  },
  async studyStats() {
    const box = $('#studyStats'); if (!box || !State.profile) return;
    const temas = await Temas.list();
    box.innerHTML = temas.length ? `<h3 style="margin-bottom:12px">Dominio por tema</h3>` + temas.map(t => {
      const sc = (t.sections || []).filter(s => s.srs?.score != null); const avg = sc.length ? sc.reduce((a, s) => a + s.srs.score, 0) / sc.length : 0;
      const cov = t.sections?.length ? sc.length / t.sections.length : 0;
      return `<div class="gauge"><div class="top"><span>${t.num ? esc(t.num) + '. ' : ''}${esc(t.title.slice(0, 60))}</span><b>${sc.length ? avg.toFixed(1) : '—'}</b></div><div class="bar"><i style="width:${avg * 10 * cov}%"></i></div></div>`;
    }).join('') : '<div class="empty">Sin temas todavía.</div>';
  }
};
Object.assign(window, { Estudio, Temas, TemarioUI, Entreno, Repaso, Supuestos, SRS, Dictado, Lector, Timer, U });
