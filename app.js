// === Anatomía Humana — Guía Interactiva ===
// Carga data.json, gestiona modos Estudio/Repaso/Galería, reinicio de preguntas,
// V/F, pareo, opción múltiple, respuesta breve.

let DATA = null;
let currentMode = 'estudio';
let currentTemaId = null;
let repasoIndex = 0;
let repasoPreguntas = [];

// Cuántas preguntas mostrar por sesión (aleatorias del pool)
const PREGUNTAS_POR_SESION = 8;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
  } catch (e) {
    document.getElementById('welcome').innerHTML =
      '<h2>Error al cargar data.json</h2><p>Asegúrate de servir la aplicación con un servidor (no abrirla directamente como file://). Por ejemplo, en la carpeta webapp ejecuta: <code>python -m http.server</code> y abre <code>http://localhost:8000</code>.</p>';
    return;
  }
  renderSidebar();
});

// ---------- Sidebar ----------
function renderSidebar() {
  const list = document.getElementById('tema-list');
  list.innerHTML = '';
  DATA.temas.forEach(tema => {
    const li = document.createElement('li');
    li.textContent = tema.titulo;
    li.dataset.id = tema.id;
    li.addEventListener('click', () => {
      loadTema(tema.id);
      closeSidebar(); // auto-close drawer on mobile after picking a tema
    });
    list.appendChild(li);
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ---------- Mode switching ----------
function setMode(mode) {
  currentMode = mode;
  document.getElementById('btn-estudio').classList.toggle('active', mode === 'estudio');
  document.getElementById('btn-repaso').classList.toggle('active', mode === 'repaso');
  document.getElementById('btn-galeria').classList.toggle('active', mode === 'galeria');
  if (currentTemaId !== null) loadTema(currentTemaId);
}

// ---------- Load tema ----------
function loadTema(id) {
  currentTemaId = id;
  const tema = DATA.temas.find(t => t.id === id);
  if (!tema) return;

  document.querySelectorAll('#tema-list li').forEach(li => {
    li.classList.toggle('active', parseInt(li.dataset.id) === id);
  });

  document.getElementById('welcome').classList.add('hidden');
  document.getElementById('estudio-view').classList.add('hidden');
  document.getElementById('repaso-view').classList.add('hidden');
  document.getElementById('galeria-view').classList.add('hidden');

  if (currentMode === 'estudio') showEstudio(tema);
  else if (currentMode === 'repaso') showRepaso(tema);
  else showGaleria(tema);
}

// ---------- Helpers ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, Math.min(n, arr.length)); }
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ---------- Estudio Mode ----------
function showEstudio(tema) {
  document.getElementById('estudio-view').classList.remove('hidden');
  document.getElementById('tema-titulo').textContent = tema.titulo;
  document.getElementById('tema-resumen').textContent = tema.resumen;
  renderPreguntas(tema);
}

function renderPreguntas(tema) {
  const container = document.getElementById('preguntas-container');
  container.innerHTML = '';

  const selectedAll = document.getElementById('mostrar-todas')?.checked;
  const total = tema.preguntas.length;
  const pool = selectedAll ? shuffle(tema.preguntas) : sample(tema.preguntas, PREGUNTAS_POR_SESION);

  const counter = document.createElement('div');
  counter.className = 'sesion-info';
  counter.textContent = selectedAll
    ? `Mostrando ${pool.length} preguntas (todas las del tema).`
    : `Mostrando ${pool.length} de ${total} preguntas (selección aleatoria).`;
  container.appendChild(counter);

  const sessionState = { total: pool.length, answered: 0, correct: 0 };

  pool.forEach(p => {
    const card = createPreguntaCard(p, sessionState, () => maybeShowResumen(container, sessionState, tema));
    container.appendChild(card);
  });

  if (tema.imagenes && tema.imagenes.length) {
    const tip = document.createElement('p');
    tip.className = 'imagen-tip';
    tip.innerHTML = `📷 Este tema incluye <strong>${tema.imagenes.length} imágenes</strong> de las diapositivas — usa el botón <strong>Galería</strong> para identificarlas visualmente.`;
    container.appendChild(tip);
  }

  const slot = document.createElement('div');
  slot.id = 'sesion-resumen-slot';
  container.appendChild(slot);
}

function maybeShowResumen(container, state, tema) {
  if (state.answered < state.total) return;
  const slot = container.querySelector('#sesion-resumen-slot');
  if (!slot || slot.dataset.done) return;
  slot.dataset.done = '1';

  const pct = Math.round((state.correct / state.total) * 100);
  let msg, cls;
  if (pct >= 90) { msg = '¡Excelente!'; cls = 'res-excelente'; }
  else if (pct >= 70) { msg = '¡Muy bien!'; cls = 'res-bien'; }
  else if (pct >= 50) { msg = 'Sigue practicando.'; cls = 'res-medio'; }
  else { msg = 'Repasa el tema y vuelve a intentarlo.'; cls = 'res-bajo'; }

  slot.innerHTML = `
    <div class="resumen-final ${cls}">
      <h3>${msg}</h3>
      <p><strong>${state.correct}</strong> de <strong>${state.total}</strong> correctas (${pct}%).</p>
      <div class="resumen-actions">
        <button class="btn-primary" id="btn-nuevas">🔄 Nuevas preguntas</button>
        <button class="btn-secondary" id="btn-reintentar">↻ Mismas preguntas</button>
      </div>
    </div>`;
  slot.querySelector('#btn-nuevas').addEventListener('click', () => renderPreguntas(tema));
  slot.querySelector('#btn-reintentar').addEventListener('click', () => renderPreguntas(tema));
  slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function reiniciarPreguntas() {
  if (currentTemaId === null) return;
  const tema = DATA.temas.find(t => t.id === currentTemaId);
  if (tema) renderPreguntas(tema);
}
function toggleMostrarTodas() { reiniciarPreguntas(); }

// ---------- Pregunta card ----------
function createPreguntaCard(pregunta, sessionState, onAnswered) {
  const card = document.createElement('div');
  card.className = 'pregunta-card';
  card.dataset.id = pregunta.id || '';

  const badge = document.createElement('span');
  badge.className = 'pregunta-badge';
  const tipoMap = {
    'opcion_multiple': ['Marque con X', 'badge-opcion'],
    'pareo': ['Pareo', 'badge-pareo'],
    'respuesta_breve': ['Respuesta breve', 'badge-breve'],
    'verdadero_falso': ['Verdadero / Falso', 'badge-vf'],
  };
  const [txt, cls] = tipoMap[pregunta.tipo] || ['Pregunta', 'badge-opcion'];
  badge.textContent = txt;
  badge.classList.add(cls);
  card.appendChild(badge);

  const text = document.createElement('p');
  text.className = 'pregunta-text';
  text.textContent = pregunta.pregunta;
  card.appendChild(text);

  const reportAnswer = (isCorrect) => {
    if (card.dataset.answered) return;
    card.dataset.answered = '1';
    sessionState.answered++;
    if (isCorrect) sessionState.correct++;
    if (typeof onAnswered === 'function') onAnswered();
  };

  if (pregunta.tipo === 'opcion_multiple') {
    card.appendChild(renderOpcionMultiple(pregunta, card, reportAnswer));
  } else if (pregunta.tipo === 'pareo') {
    card.appendChild(renderPareo(pregunta, card, reportAnswer));
  } else if (pregunta.tipo === 'verdadero_falso') {
    card.appendChild(renderVerdaderoFalso(pregunta, card, reportAnswer));
  } else {
    card.appendChild(renderRespuestaBreve(pregunta, card, reportAnswer));
  }

  const feedback = document.createElement('div');
  feedback.className = 'feedback';
  card.appendChild(feedback);
  return card;
}

// ---------- Opción múltiple ----------
function renderOpcionMultiple(pregunta, card, report) {
  const wrap = document.createElement('div');
  const ul = document.createElement('ul');
  ul.className = 'opciones-list';
  let selectedIndex = -1;

  pregunta.opciones.forEach((op, i) => {
    const li = document.createElement('li');
    li.className = 'opcion-item';
    li.textContent = op;
    li.addEventListener('click', () => {
      if (li.classList.contains('disabled')) return;
      ul.querySelectorAll('.opcion-item').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      selectedIndex = i;
    });
    ul.appendChild(li);
  });
  wrap.appendChild(ul);

  const btn = document.createElement('button');
  btn.className = 'btn-verificar';
  btn.textContent = 'Verificar';
  btn.addEventListener('click', () => {
    if (selectedIndex === -1) return;
    const isCorrect = selectedIndex === pregunta.respuesta_correcta;
    ul.querySelectorAll('.opcion-item').forEach((li, i) => {
      li.classList.add('disabled');
      if (i === pregunta.respuesta_correcta) li.classList.add('correct-answer');
      if (i === selectedIndex && !isCorrect) li.classList.add('wrong-answer');
    });
    card.classList.add(isCorrect ? 'correct' : 'incorrect');
    showFeedback(card, isCorrect, pregunta.explicacion,
      isCorrect ? null : pregunta.opciones[pregunta.respuesta_correcta]);
    btn.disabled = true;
    report(isCorrect);
  });
  wrap.appendChild(btn);
  return wrap;
}

// ---------- Verdadero / Falso ----------
function renderVerdaderoFalso(pregunta, card, report) {
  const wrap = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'vf-row';
  let pick = null;

  ['Verdadero', 'Falso'].forEach((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vf-btn';
    b.textContent = label;
    b.addEventListener('click', () => {
      if (b.classList.contains('disabled')) return;
      row.querySelectorAll('.vf-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      pick = (i === 0);
    });
    row.appendChild(b);
  });
  wrap.appendChild(row);

  const btn = document.createElement('button');
  btn.className = 'btn-verificar';
  btn.textContent = 'Verificar';
  btn.addEventListener('click', () => {
    if (pick === null) return;
    const isCorrect = pick === !!pregunta.respuesta_correcta;
    row.querySelectorAll('.vf-btn').forEach((b, i) => {
      b.classList.add('disabled');
      const isV = (i === 0);
      if (isV === !!pregunta.respuesta_correcta) b.classList.add('correct-answer');
      if (isV === pick && !isCorrect) b.classList.add('wrong-answer');
    });
    card.classList.add(isCorrect ? 'correct' : 'incorrect');
    const correctLabel = pregunta.respuesta_correcta ? 'Verdadero' : 'Falso';
    showFeedback(card, isCorrect, pregunta.explicacion, isCorrect ? null : correctLabel);
    btn.disabled = true;
    report(isCorrect);
  });
  wrap.appendChild(btn);
  return wrap;
}

// ---------- Pareo ----------
function renderPareo(pregunta, card, report) {
  const wrap = document.createElement('div');
  const container = document.createElement('div');
  container.className = 'pareo-container';
  const colA = document.createElement('div');
  colA.className = 'pareo-column';

  pregunta.columna_a.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'pareo-item pareo-item-a';
    const label = document.createElement('div');
    label.textContent = (i + 1) + '. ' + item;
    label.style.fontWeight = '600';
    label.style.marginBottom = '0.3rem';
    const sel = document.createElement('select');
    sel.className = 'pareo-select';
    sel.dataset.index = i;
    const def = document.createElement('option');
    def.value = ''; def.textContent = '— Seleccione —';
    sel.appendChild(def);
    pregunta.columna_b.forEach((b, j) => {
      const o = document.createElement('option');
      o.value = j; o.textContent = b;
      sel.appendChild(o);
    });
    row.appendChild(label);
    row.appendChild(sel);
    colA.appendChild(row);
  });
  container.appendChild(colA);
  wrap.appendChild(container);

  const btn = document.createElement('button');
  btn.className = 'btn-verificar';
  btn.textContent = 'Verificar';
  btn.addEventListener('click', () => {
    const selects = container.querySelectorAll('.pareo-select');
    let allCorrect = true, allFilled = true;
    selects.forEach((sel, i) => {
      if (sel.value === '') { allFilled = false; return; }
      const isCorrect = parseInt(sel.value) === pregunta.respuestas_correctas[i];
      sel.classList.add(isCorrect ? 'correct-select' : 'wrong-select');
      sel.disabled = true;
      if (!isCorrect) allCorrect = false;
    });
    if (!allFilled) return;
    card.classList.add(allCorrect ? 'correct' : 'incorrect');
    let correctText = null;
    if (!allCorrect) {
      correctText = pregunta.columna_a.map((a, i) =>
        a + ' → ' + pregunta.columna_b[pregunta.respuestas_correctas[i]]
      ).join(' | ');
    }
    showFeedback(card, allCorrect, pregunta.explicacion, correctText);
    btn.disabled = true;
    report(allCorrect);
  });
  wrap.appendChild(btn);
  return wrap;
}

// ---------- Respuesta breve ----------
function renderRespuestaBreve(pregunta, card, report) {
  const wrap = document.createElement('div');
  const ta = document.createElement('textarea');
  ta.className = 'breve-input';
  ta.placeholder = 'Escribe tu respuesta aquí…';
  wrap.appendChild(ta);
  const btn = document.createElement('button');
  btn.className = 'btn-verificar';
  btn.textContent = 'Ver respuesta';
  btn.addEventListener('click', () => {
    ta.disabled = true;
    card.classList.add('correct');
    showFeedback(card, true, pregunta.explicacion, pregunta.respuesta_correcta);
    btn.disabled = true;
    report(true);
  });
  wrap.appendChild(btn);
  return wrap;
}

// ---------- Feedback ----------
function showFeedback(card, isCorrect, explicacion, correctAnswer) {
  const fb = card.querySelector('.feedback');
  fb.classList.add('show');
  if (isCorrect) {
    fb.className = 'feedback show correct-feedback';
    fb.innerHTML =
      '<span class="feedback-icon">✓</span> ¡Correcto!' +
      '<br><small>' + escapeHtml(explicacion || '') + '</small>' +
      (correctAnswer ? '<span class="correct-answer-text">Respuesta: ' + escapeHtml(correctAnswer) + '</span>' : '');
  } else {
    fb.className = 'feedback show incorrect-feedback';
    fb.innerHTML =
      '<span class="feedback-icon">✗</span> Incorrecto' +
      (correctAnswer ? '<span class="correct-answer-text">Respuesta correcta: ' + escapeHtml(correctAnswer) + '</span>' : '') +
      '<br><small>' + escapeHtml(explicacion || '') + '</small>';
  }
}

// ---------- Repaso ----------
function showRepaso(tema) {
  document.getElementById('repaso-view').classList.remove('hidden');
  document.getElementById('repaso-titulo').textContent = 'Repaso: ' + tema.titulo;
  repasoPreguntas = shuffle(tema.preguntas);
  repasoIndex = 0;
  renderRepasoPregunta();
}
function renderRepasoPregunta() {
  if (!repasoPreguntas.length) return;
  const p = repasoPreguntas[repasoIndex];
  const cont = document.getElementById('repaso-pregunta-container');
  cont.innerHTML = '';
  const dummy = { total: 1, answered: 0, correct: 0 };
  cont.appendChild(createPreguntaCard(p, dummy));
  document.getElementById('repaso-counter').textContent =
    (repasoIndex + 1) + ' / ' + repasoPreguntas.length;
  document.getElementById('repaso-progress').innerHTML =
    '<div class="bar" style="width:' + (((repasoIndex + 1) / repasoPreguntas.length) * 100) + '%"></div>';
  document.getElementById('btn-prev').disabled = repasoIndex === 0;
  document.getElementById('btn-next').disabled = repasoIndex === repasoPreguntas.length - 1;
}
function repasoPrev() { if (repasoIndex > 0) { repasoIndex--; renderRepasoPregunta(); } }
function repasoNext() { if (repasoIndex < repasoPreguntas.length - 1) { repasoIndex++; renderRepasoPregunta(); } }
function repasoMezclar() {
  if (currentTemaId !== null) {
    const t = DATA.temas.find(x => x.id === currentTemaId);
    if (t) showRepaso(t);
  }
}

// ---------- Galería de imágenes ----------
function showGaleria(tema) {
  document.getElementById('galeria-view').classList.remove('hidden');
  document.getElementById('galeria-titulo').textContent = 'Galería: ' + tema.titulo;
  const desc = document.getElementById('galeria-desc');
  const grid = document.getElementById('galeria-grid');
  if (!tema.imagenes || tema.imagenes.length === 0) {
    desc.textContent = 'Este tema no tiene imágenes en los PDFs fuente.';
    grid.innerHTML = '';
    return;
  }
  desc.innerHTML = `<strong>${tema.imagenes.length}</strong> imágenes extraídas de los PDFs. Haz clic en una imagen para verla en grande. La leyenda corresponde al texto de la diapositiva.`;
  grid.innerHTML = '';
  tema.imagenes.forEach((img, idx) => {
    const fig = document.createElement('figure');
    fig.className = 'galeria-item';
    fig.innerHTML = `
      <img loading="lazy" src="${img.src}" alt="${escapeHtml(img.caption || 'Imagen ' + (idx+1))}">
      <figcaption>
        <span class="g-num">#${idx + 1}</span>
        <span class="g-page">pág. ${img.pagina}</span>
        <p class="g-text">${escapeHtml(img.caption || '(sin leyenda)')}</p>
        <small class="g-source">${escapeHtml(img.fuente)}</small>
      </figcaption>`;
    fig.querySelector('img').addEventListener('click', () => openLightbox(img, idx + 1));
    grid.appendChild(fig);
  });
}

function openLightbox(img, num) {
  const lb = document.getElementById('lightbox');
  lb.classList.add('open');
  lb.querySelector('.lb-img').src = img.src;
  lb.querySelector('.lb-caption').innerHTML =
    `<strong>#${num} — ${escapeHtml(img.fuente)} (pág. ${img.pagina})</strong><br>${escapeHtml(img.caption || '(sin leyenda)')}`;
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }
