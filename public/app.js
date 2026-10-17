'use strict';
const root = document.getElementById('app');
const logoutButton = document.getElementById('logout');
const model = { lesson: null, step: 0, answers: {}, feedback: null, busy: false };
const $ = (tag, className = '', value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};
const add = (parent, ...children) => { children.filter(Boolean).forEach(n => parent.append(n)); return parent; };
const mkButton = (text, className, onClick) => { const b = $('button', className, text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
async function api(path, options = {}) {
  let response;
  try { response = await fetch('/api' + path, { credentials: 'same-origin', ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } }); }
  catch { throw new Error('Cannot reach the server. Check your connection and try again.'); }
  let data; try { data = await response.json(); } catch { throw new Error('Unexpected server response.'); }
  if (!response.ok) { if (response.status === 401) showLogin(); throw new Error(data.error || 'Request failed'); }
  return data;
}
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
function clear() { root.replaceChildren(); }
function alertError(parent, message) { const n = $('p', 'error', message); parent.prepend(n); return n; }
function showLogin() {
  logoutButton.hidden = true; clear();
  const container = $('section', 'panel login-panel');
  add(container, $('div', 'login-symbol', '🌱'), $('div', 'eyebrow', 'Welcome to MultiLingo'),
    $('h1', 'title', 'Every word is a new beginning.'), $('p', 'subtle', 'Learn Spanish at your own pace. Enter your personal learning code to get started or sign back in.'));
  const form = $('form', 'form-stack');
  const nameLabel = $('label', 'field-label', 'Your first name or nickname');
  const name = $('input', 'input'); name.required = true; name.maxLength = 32; name.minLength = 2; name.autocomplete = 'nickname'; name.placeholder = 'e.g. Alex';
  nameLabel.append(name);
  const codeLabel = $('label', 'field-label', 'Personal learning code');
  const code = $('input', 'input'); code.required = true; code.placeholder = 'Paste your private learning code'; code.autocomplete = 'off'; code.spellcheck = false;
  codeLabel.append(code);
  const submit = $('button', 'primary', 'Start learning →'); submit.type = 'submit';
  add(form, nameLabel, codeLabel, submit);
  form.addEventListener('submit', async e => {
    e.preventDefault(); submit.disabled = true; submit.textContent = 'Checking invitation…';
    container.querySelector('.error')?.remove();
    try { await post('/auth/redeem', { name: name.value, invite: code.value }); await showHome(); }
    catch (error) { alertError(container, error.message); submit.disabled = false; submit.textContent = 'Start learning →'; }
  });
  add(container, form, $('p', 'muted center', 'Keep your private code safe. Reuse it to sign back in on any device. Your progress is saved privately.')); root.append(container);
}
async function showHome() {
  clear(); logoutButton.hidden = false;
  const shell = $('section'); add(shell, $('p', 'subtle', 'Loading your learning path…')); root.append(shell);
  try {
    const data = await api('/lessons');
    const done = data.lessons.filter(l => l.bestPercent >= 80).length;
    clear(); const welcome = $('div', 'welcome'); const name = $('div');
    add(name, $('div', 'eyebrow', 'Your learning path'), $('h1', '', `¡Hola, ${data.name}!`), $('p', 'subtle', 'A little Spanish every day adds up.'));
    const counter = $('div', 'counter'); add(counter, $('div', '', `${done} / ${data.lessons.length}`), $('span', '', 'LESSONS MASTERED'));
    add(welcome, name, counter); root.append(welcome);
    root.append($('div', 'section-title', 'Unit 1 · Your first Spanish words'));
    const path = $('section', 'path');
    for (const [index, lesson] of data.lessons.entries()) {
      const btn = $('button', 'lesson-card' + (lesson.unlocked ? ' unlocked' : '') + (lesson.bestPercent >= 80 ? ' completed' : ''));
      btn.type = 'button'; btn.disabled = !lesson.unlocked;
      const emoji = $('div', 'lesson-icon', lesson.unlocked ? (lesson.bestPercent >= 80 ? '✅' : '💬') : '🔒');
      const text = $('div', 'lesson-text'); add(text, $('strong', '', `${index + 1}. ${lesson.title}`), $('span', '', lesson.subtitle));
      const status = $('span', 'lesson-status', lesson.bestPercent >= 80 ? (lesson.reviewDue ? 'REVIEW DUE' : `${lesson.bestPercent}% BEST`) : lesson.unlocked ? 'START →' : 'LOCKED');
      add(btn, emoji, text, status); btn.addEventListener('click', () => loadLesson(lesson.id)); path.append(btn);
    }
    root.append(path, $('div', 'hint', '💡 Lessons unlock after you score at least 80%. Review completed lessons anytime. Your mistakes come with explanations.'));
  } catch (error) { clear(); const p = $('div', 'panel'); add(p, $('h2', '', 'We could not load your lessons'), $('p', 'error', error.message), mkButton('Try again', 'primary', showHome)); root.append(p); }
}
async function loadLesson(id) {
  clear(); root.append($('div', 'panel loading', 'Opening lesson…'));
  try {
    const data = await api('/lessons/' + id);
    model.lesson = data.lesson; model.step = 0; model.answers = {}; model.feedback = null; model.busy = false;
    renderQuestion();
  } catch (error) { clear(); const p = $('div', 'panel'); add(p, $('p', 'error', error.message), mkButton('Back to lessons', 'secondary', showHome)); root.append(p); }
}
function answerValue(question, value) { model.answers[question.id] = value; }
function pronounce(text) {
  if (!('speechSynthesis' in window)) return false;
  try { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'es-ES'; utterance.rate = .82; speechSynthesis.speak(utterance); return true; }
  catch { return false; }
}
function renderQuestion() {
  const lesson = model.lesson; const question = lesson.questions[model.step]; const index = model.step;
  clear(); const wrapper = $('section', 'lesson-shell'); const top = $('div', 'lesson-top');
  const back = mkButton('×', 'back', showHome); back.setAttribute('aria-label', 'Return to lessons');
  const track = $('div', 'progress-track'); const fill = $('div', 'progress-fill'); fill.style.width = `${100 * index / lesson.questions.length}%`; track.append(fill);
  add(top, back, track, $('span', 'step-label', `${index + 1} / ${lesson.questions.length}`));
  const card = $('section', 'panel');
  const kindTitle = question.kind === 'listen' ? 'Listen and choose' : question.kind === 'type' ? 'Write in Spanish' : 'Choose the answer';
  add(card, $('div', 'question-kind', kindTitle), $('h2', 'question-title', question.prompt));
  let selected = model.answers[question.id] || '';
  let input = null; let candidates = [];
  if (question.kind === 'listen') {
    const sound = mkButton('🔊 Play Spanish audio', 'speak', () => {
      if (!pronounce(question.spoken)) alertError(card, 'Audio is not available on this device.');
    });
    add(card, sound, $('p', 'listen-note', 'Audio uses your device’s available Spanish voice.'));
  }
  if (question.kind === 'type') {
    input = $('input', 'input'); input.autocomplete = 'off'; input.autocapitalize = 'none'; input.spellcheck = false;
    input.value = selected; input.placeholder = question.placeholder || 'Your answer';
    input.addEventListener('input', () => { selected = input.value; answerValue(question,selected); check.disabled = !selected.trim(); });
    card.append(input);
  } else {
    const choices = $('div', 'choice-stack');
    question.options.forEach((option, ix) => {
      const btn = $('button', 'choice' + (selected === option ? ' selected' : ''));
      btn.type = 'button'; const key = $('b', '', String(ix+1)); add(btn,key,$('span','',option));
      btn.addEventListener('click', () => {
        selected = option; answerValue(question, selected);
        candidates.forEach(b => b.classList.toggle('selected', b === btn)); check.disabled = false;
      }); candidates.push(btn); choices.append(btn);
    }); card.append(choices);
  }
  const action = $('div', 'actionbar');
  const check = mkButton('Check answer →', 'primary', async () => {
    if (!selected.trim() || model.busy) return;
    model.busy = true; check.disabled = true;
    try { model.feedback = (await post('/lessons/' + lesson.id + '/check', { questionId: question.id, answer: selected })).feedback;
      renderFeedback(question); }
    catch (error) { model.busy = false; check.disabled = false; alertError(card, error.message); }
  });
  check.disabled = !selected.trim(); action.append(check);
  wrapper.append(top, card, action); root.append(wrapper);
  if (input) input.focus();
}
function renderFeedback(question) {
  const wrapper = root.querySelector('.lesson-shell'); if (!wrapper) return;
  const fb = model.feedback;
  wrapper.querySelector('.actionbar')?.remove();
  const panel = $('section', 'feedback' + (fb.correct ? '' : ' bad'));
  add(panel, $('strong', '', fb.correct ? '✓ Correct!' : 'Not quite — keep going'),
    $('p', '', fb.correct ? fb.explanation : `Correct answer: ${fb.answer}`));
  if (!fb.correct) panel.append($('small', '', fb.explanation));
  const bar = $('div', 'actionbar'); const done = model.step === model.lesson.questions.length - 1;
  const next = mkButton(done ? 'Finish lesson →' : 'Continue →', 'primary', async () => {
    if (!done) { model.step += 1; model.busy = false; model.feedback = null; renderQuestion(); return; }
    next.disabled = true;
    try { const result = await post('/lessons/' + model.lesson.id + '/complete', { answers: model.answers }); showResult(result); }
    catch (error) { next.disabled = false; alertError(panel, error.message); }
  }); add(bar, next); wrapper.append(panel,bar);
}
function showResult(result) {
  clear(); const card = $('section', 'panel result-card');
  add(card, $('div', 'login-symbol', result.passed ? '🎉' : '💪'),
    $('span', 'pill', result.passed ? 'Lesson mastered' : 'Practice makes progress'),
    $('h2', '', result.passed ? 'Great work!' : 'You are learning!'),
    $('div', 'score', `${result.percent}%`),
    $('p', 'subtle', `${result.correctCount} of ${result.total} answers correct. ${result.passed ? 'The next lesson is now unlocked.' : 'Aim for 80% to unlock the next lesson.'}`),
    mkButton('Back to learning path', 'primary', showHome));
  root.append(card);
}
logoutButton.addEventListener('click', async () => {
  try { await post('/auth/logout', {}); showLogin(); }
  catch (error) { alertError(root, 'Sign out failed: ' + error.message); }
});
(async () => {
  try { const session = await api('/me'); if (session.signedIn) await showHome(); else showLogin(); }
  catch { showLogin(); }
})();
