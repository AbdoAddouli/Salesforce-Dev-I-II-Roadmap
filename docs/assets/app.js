/* =============================================================================
 * Developer I & II Academy — app
 * Client-side learning app: hash routing, lesson renderer, quiz engine,
 * progress persistence (localStorage), search, keyboard shortcuts.
 * ============================================================================= */

/* ------------------------- small helpers ------------------------- */

const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

const esc = (s = '') => s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const cyrb53 = s => { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761); return (h ^ h >>> 9) >>> 0; };

const MODULES = ACADEMY;

/* ------------------------- progress store ------------------------- */

const KEY = 'devacademy-v1';
let store = load();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || defaultStore(); }
  catch (e) { return defaultStore(); }
}
function defaultStore() {
  return { done: {}, quiz: {}, best: {}, stars: {}, lastOpen: null };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
}
function lessonDone(mid, li)  { return !!store.done[mid + ':' + li]; }
function markDone(mid, li, v) { store.done[mid + ':' + li] = v; save(); }
function moduleProgress(mid) {
  const m = byId(mid);
  if (!m) return { done: 0, total: 0, pct: 0, quizPct: 0, complete: 0, totalUnits: 0 };
  const lessons = m.lessons.length;
  let done = 0;
  m.lessons.forEach((_, i) => { if (lessonDone(mid, i)) done++; });
  // lessons are worth 2 units, quiz worth 1
  const units = lessons * 2 + 1;
  const earned = done * 2 + (store.quiz[mid] ? 1 : 0);
  const pct = Math.round((earned / units) * 100);
  const complete = earned >= units;
  return { done, total: lessons, pct, quizPct: quizPctOf(mid), complete, earned, units };
}
function quizPctOf(mid) {
  const m = byId(mid);
  if (!m || !store.best[mid]) return 0;
  return Math.round((store.best[mid] / m.quiz.questions.length) * 100);
}
function overallPct() {
  const rows = MODULES.map(m => {
    const p = moduleProgress(m.id);
    return p.units ? p.earned / p.units * 100 : 0;
  });
  return Math.round(rows.reduce((a, b) => a + b, 0) / rows.length);
}

function byId(id) { return MODULES.find(m => m.id === id); }

/* ------------------------- routing ------------------------- */

let route = { view: 'home', mid: null, li: null };

function navigate(view, mid, li) {
  route = { view, mid, li: li != null ? li : null };
  history.replaceState(null, '', '#' + hashFor());
  render();
}
function hashFor() {
  if (route.view === 'phase') return '/phase/' + route.mid;
  if (route.view === 'lesson') return '/lesson/' + route.mid + '/' + route.li;
  if (route.view === 'quiz')  return '/quiz/' + route.mid;
  return '/';
}
function parseHash() {
  const h = decodeURIComponent((location.hash || '#/').replace(/^#/, ''));
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'phase') return { view: 'phase', mid: parts[1] };
  if (parts[0] === 'lesson') return { view: 'lesson', mid: parts[1], li: Number(parts[2]) };
  if (parts[0] === 'quiz')   return { view: 'quiz', mid: parts[1] };
  return { view: 'home' };
}

/* ------------------------- renderer ------------------------- */

const view = $('#view');

function render() {
  const mod = route.mid ? byId(route.mid) : null;
  const r = parseHash(); // keep in sync with friendly URLs
  document.title = 'Developer I & II Academy' + (mod ? ' · ' + mod.title : '');

  // sidebar
  renderSidebar();

  // topbar progress
  const tp = $('#topPct');
  if (tp) tp.textContent = overallPct() + '%';
  const tbar = $('#topBar');
  if (tbar) tbar.style.width = overallPct() + '%';
  bindTopSearch();

  if (r.view === 'phase')  return renderModule(mod);
  if (r.view === 'lesson') return renderLesson(mod, Math.min(Number(r.li) || 0, mod.lessons.length - 1));
  if (r.view === 'quiz')   return renderQuiz(mod);
  renderHome();
}

/* ------------------------- sidebar ------------------------- */

function renderSidebar() {
  const aside = $('aside.sidebar');
  aside.innerHTML = `
    <div class="side-brand">
      <div class="logo">☁️</div>
      <div><b>Developer I & II Academy</b><span>13-phase roadmap</span></div>
    </div>`;

  const nav = document.createElement('nav');
  nav.className = 'side-nav';

  const home = document.createElement('a');
  home.href = '#/';
  home.className = 'side-link' + (route.view === 'home' ? ' active' : '');
  home.innerHTML = `<span class="sli">🏠</span> Dashboard`;
  nav.appendChild(home);

  MODULES.forEach(m => {
    const p = moduleProgress(m.id);
    const a = document.createElement('a');
    a.href = '#/phase/' + m.id;
    a.className = 'side-phase' + (route.mid === m.id ? ' active' : '');
    a.innerHTML = `
      <span class="sp-n" style="border-color:${m.color}">${String(m.n).padStart(2, '0')}</span>
      <span class="sp-body">
        <span class="sp-title">${m.title}</span>
        <span class="sp-bar"><i style="width:${p.pct}%;background:${m.color}"></i></span>
      </span>
      <span class="sp-pct">${p.pct}%</span>
      ${p.complete ? '<span class="sp-ok">✓</span>' : ''}`;
    nav.appendChild(a);
  });

  aside.appendChild(nav);

  const progWrap = document.createElement('div');
  progWrap.className = 'side-progress';
  const op = overallPct();
  progWrap.innerHTML = `<div class="sp-bar big"><i style="width:${op}%"></i></div>
    <div class="side-prog-label"><b>${op}%</b> of roadmap complete</div>`;
  aside.appendChild(progWrap);
}

/* ------------------------- home ------------------------- */

function renderHome() {
  const op = overallPct();
  const totalLessons = MODULES.reduce((a, m) => a + m.lessons.length, 0);
  const totalMin = MODULES.reduce((a, m) => a + m.lessons.reduce((x, l) => x + l.mins, 0), 0) + MODULES.reduce((a, m) => a + m.quiz.mins, 0);
  const totalDone = MODULES.reduce((a, m) => a + moduleProgress(m.id).earned, 0);
  const totalUnits = MODULES.reduce((a, m) => a + moduleProgress(m.id).units, 0);

  // continue card
  let next = null;
  for (const m of MODULES) {
    for (let i = 0; i < m.lessons.length; i++) {
      if (!lessonDone(m.id, i)) { next = { m, i }; break; }
    }
    if (next) break;
  }
  if (!next) next = { m: MODULES[0], i: 0 };
  let resume = null;
  if (store.lastOpen && byId(store.lastOpen.mid)) {
    const lm = byId(store.lastOpen.mid);
    resume = { m: lm, li: Math.max(0, Math.min(store.lastOpen.li, lm.lessons.length - 1)) };
  }
  if (!resume) resume = { m: next.m, li: next.i };
  const rm = resume.m;

  view.innerHTML = `
    <div class="home-hero reveal">
      <div>
        <div class="hero-kicker">Salesforce Development · study from zero</div>
        <h1 class="hero-title">Become <span class="grad">developer certified</span>, phase by phase.</h1>
        <p class="hero-sub">${MODULES.length} guided modules, ${totalLessons} lessons, ${MODULES.length} quizzes — with real metadata in the repo to deploy and practice on.</p>
        <div class="hero-actions">
          <button class="btn primary" id="startBtn">${next ? '▶ Continue learning' : '🎉 Restart'}</button>
          <button class="btn ghost" id="phasesBtn">Browse all phases</button>
          <span class="hero-meta">📅 ~13 phases · self-paced</span>
        </div>
      </div>
      <div class="ring-wrap">
        <div class="ring" style="--p:${op}"><span>${op}<small>%</small></span></div>
        <div class="ring-caption">roadmap progress</div>
      </div>
    </div>

    <div class="stats reveal">
      <div class="stat"><div class="st-n">${totalDone}<small>/${totalUnits}</small></div><div class="st-l">units completed</div></div>
      <div class="stat"><div class="st-n">${MODULES.filter(m => moduleProgress(m.id).complete).length}<small>/</small></div><div class="st-l">phases mastered</div></div>
      <div class="stat"><div class="st-n">${MODULES.filter(m => store.best[m.id] >= m.quiz.questions.length).length}<small>/</small></div><div class="st-l">quizzes passed</div></div>
      <div class="stat"><div class="st-n">${totalMin}<small> min</small></div><div class="st-l">~ total study time</div></div>
    </div>

    <div class="home-cards">
      <div class="card continue-card" style="--c:${rm.color}">
        <div class="cc-top"><span class="cc-label">Continue where you left off</span><span class="pill">Phase ${rm.n}</span></div>
        <h3>${resume.li != null && resume.li < rm.lessons.length ? rm.lessons[resume.li].title : rm.lessons[0].title}</h3>
        <div class="cc-sub">${rm.title}</div>
        <div class="sp-bar"><i style="width:${moduleProgress(rm.id).pct}%;background:${rm.color}"></i></div>
        <button class="btn primary sm" id="resumeBtn">Resume →</button>
      </div>
      <div class="card next-card" style="--c:${next.m.color}">
        <div class="cc-top"><span class="cc-label">Next up</span><span class="pill">Phase ${next.m.n}</span></div>
        <h3>${next.i != null && next.i < next.m.lessons.length ? next.m.lessons[next.i].title : next.m.lessons[0].title}</h3>
        <div class="cc-sub">${next.m.lessons[next.i].mins} min · ${next.m.lessons.length} lessons · ${next.m.quiz.questions.length}-question quiz</div>
        <button class="btn sm" id="nextBtn">Open →</button>
      </div>
      <div class="card streak-card" style="--c:#e8b93d">
        <div class="cc-top"><span class="cc-label">Learning tips</span></div>
        <h3>3 wins today</h3>
        <ul class="tips">
          <li>Finish <b>one lesson</b> then take its phase quiz.</li>
          <li>Re-create flows / reports in your own org.</li>
          <li>Use <kbd>/</kbd> to search anything.</li>
        </ul>
      </div>
    </div>

    <div class="grid-head reveal"><h2>Your roadmap</h2><span>${MODULES.length} phases · study in order or jump anywhere</span></div>
    <div class="module-grid reveal" id="modGrid"></div>`;

  $('#startBtn').addEventListener('click', () => navigate('lesson', resume.m.id, resume.li != null && resume.li < rm.lessons.length ? resume.li : 0));
  $('#resumeBtn').addEventListener('click', () => navigate('lesson', resume.m.id, resume.li != null && resume.li < rm.lessons.length ? resume.li : 0));
  $('#nextBtn').addEventListener('click', () => navigate('lesson', next.m.id, next.i));
  $('#phasesBtn').addEventListener('click', () => navigate('phase', MODULES[0].id));

  const grid = $('#modGrid');
  MODULES.forEach(m => {
    const p = moduleProgress(m.id);
    const card = document.createElement('a');
    card.href = '#/phase/' + m.id;
    card.className = 'mod-card';
    card.style.setProperty('--c', m.color);
    card.innerHTML = `
      <div class="mc-top">
        <span class="mc-num">${String(m.n).padStart(2, '0')}</span>
        <span class="mc-ico">${m.icon}</span>
        ${p.complete ? '<span class="mc-done">✓ completed</span>' : ''}
      </div>
      <h3>${esc(m.title)}</h3>
      <div class="mc-tag">${esc(m.tagline)}</div>
      <div class="mc-prog">
        <div class="sp-bar"><i style="width:${p.pct}%;background:${m.color}"></i></div>
        <div class="mc-sub">${p.done}/${p.total} lessons · ${p.quizPct}% quiz</div>
      </div>
      <div class="mc-foot">
        <span>${m.lessons.length} lessons · ${m.quiz.questions.length} quiz</span>
        <span class="mc-arrow">→</span>
      </div>`;
    grid.appendChild(card);
  });
}

/* ------------------------- module/phase page ------------------------- */

function renderModule(mod) {
  const p = moduleProgress(mod.id);
  const quizScore = store.best[mod.id];
  view.innerHTML = `
    <div class="crumb reveal"><a href="#/">Dashboard</a> <span>›</span> <b>${mod.title}</b></div>

    <div class="phase-hero reveal" style="--c:${mod.color}">
      <div class="ph-ico">${mod.icon}</div>
      <div class="ph-body">
        <div class="ph-kicker">Phase ${String(mod.n).padStart(2, '0')} · ${mod.tagline}</div>
        <h1>${mod.title}</h1>
        <div class="ph-obj"><span>By the end you can:</span>
          <ul>${mod.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="ph-side">
        <div class="ring sm" style="--p:${p.pct};--c:${mod.color}"><span>${p.pct}<small>%</small></span></div>
        <div class="ph-stats">
          <span>${p.done}/${p.total} lessons</span>
          <span>${store.quiz[mod.id] ? '✓ quiz taken' : 'quiz pending'}</span>
        </div>
        <a class="btn ghost sm" target="_blank" rel="noopener"
           href="${GUIDE}${mod.guide}">📄 Full guide on GitHub</a>
      </div>
    </div>

    <div class="lessons reveal">
      ${mod.lessons.map((l, i) => `
        <a class="lesson-row" href="#/lesson/${mod.id}/${i}" style="--c:${mod.color}">
          <span class="lr-state">${lessonDone(mod.id, i) ? '<span class="lr-done">✓</span>' : String(i + 1).padStart(2, '0')}</span>
          <span class="lr-info">
            <b>${l.title}</b>
            <span class="lr-meta">${l.mins} min</span>
          </span>
          <span class="lr-arrow">→</span>
        </a>`).join('')}
    </div>

    <div class="quiz-card reveal" style="--c:${mod.color}">
      <div class="qc-left">
        <div class="qc-ico">🧠</div>
        <div>
          <h3>Module quiz · check your understanding</h3>
          <p>${mod.quiz.questions.length} questions · ${mod.quiz.mins} min.
             ${quizScore != null ? `Your best: <b>${quizScore}/${mod.quiz.questions.length}</b> (${Math.round(quizScore / mod.quiz.questions.length * 100)}%).` : 'Not attempted yet.'}
          </p>
        </div>
      </div>
      <div class="qc-right">
        ${quizScore != null && quizScore === mod.quiz.questions.length ? '<span class="qc-perfect">★ perfect</span>' : ''}
        <a class="btn primary" href="#/quiz/${mod.id}">${quizScore != null ? 'Retake quiz' : 'Take quiz →'}</a>
      </div>
    </div>

    <div class="artifacts reveal">
      <h3>📦 Real artifacts in this repo</h3>
      <div class="artifacts-grid">
        ${mod.art.map(a => `
          <a class="artifact" target="_blank" rel="noopener"
             href="https://github.com/AbdoAddouli/Salesforce-Dev-I-II-Roadmap/blob/main/${a.href}" style="--c:${mod.color}">
            <span class="a-ico">🗂️</span> <span>${a.label}</span>
          </a>`).join('')}
      </div>
    </div>

    <div class="phase-nav reveal">
      ${mod.n > 1 ? `<a class="btn ghost" href="#/phase/${MODULES[mod.n - 2].id}">← ${MODULES[mod.n - 2].title}</a>` : '<span></span>'}
      ${mod.n < MODULES.length
        ? `<a class="btn primary" href="#/phase/${MODULES[mod.n].id}">${MODULES[mod.n].title} →</a>`
        : `<a class="btn primary" href="#/quiz/${mod.id}">🎯 Take the final quiz</a>`}
    </div>`;
}

/* ------------------------- lesson page ------------------------- */

function renderLesson(mod, li) {
  const lesson = mod.lessons[li];
  const prevI = li > 0 ? li - 1 : null;
  const nextI = li < mod.lessons.length - 1 ? li + 1 : null;
  const done = lessonDone(mod.id, li);

  view.innerHTML = `
    <div class="crumb reveal"><a href="#/">Dashboard</a> <span>›</span> <a href="#/phase/${mod.id}">${mod.title}</a> <span>›</span> <b>${lesson.title}</b></div>

    <div class="lesson-wrap reveal">
      <aside class="lesson-toc">
        <div class="toc-title">${mod.title}</div>
        ${mod.lessons.map((l, i) => `
          <a href="#/lesson/${mod.id}/${i}" class="toc-item ${i === li ? 'active' : ''}">
            <span class="toc-state">${lessonDone(mod.id, i) ? '✓' : i + 1}</span>
            <span>${l.title}<span class="toc-min">${l.mins}′</span></span>
          </a>`).join('')}
        <a href="#/quiz/${mod.id}" class="toc-item toc-quiz" style="--c:${mod.color}">
          <span class="toc-state">🧠</span><span>Module quiz</span>
        </a>
      </aside>

      <article class="lesson article">
        <div class="lesson-head" style="--c:${mod.color}">
          <div class="lh-meta">Phase ${String(mod.n).padStart(2, '0')} · Lesson ${li + 1} of ${mod.lessons.length} · ${lesson.mins} min</div>
          <h1>${lesson.title}</h1>
        </div>
        <div class="chips">
          ${mod.objectives.map((o, i) => `<span class="chip-o">${o}</span>`).join('')}
        </div>

        <div class="blocks">${lesson.blocks.map(renderBlock).join('')}</div>

        <div class="lesson-foot">
          <div class="lf-left">
            ${done
              ? '<button class="btn ghost sm" id="unbtn">↩ Mark as unlearned</button>'
              : `<button class="btn primary" id="doneBtn">✓ Mark lesson complete</button>`}
          </div>
          <div class="lf-right">
            ${prevI != null ? `<a class="btn ghost sm" href="#/lesson/${mod.id}/${prevI}">← Prev</a>` : ''}
            ${nextI != null
              ? `<a class="btn primary sm" href="#/lesson/${mod.id}/${nextI}">Next →</a>`
              : `<a class="btn primary sm" href="#/quiz/${mod.id}">Take the quiz →</a>`}
          </div>
        </div>
      </article>
    </div>`;

  const b = $('#doneBtn'); const u = $('#unbtn');
  if (b) b.addEventListener('click', () => { markDone(mod.id, li, true); store.lastOpen = { mid: mod.id, li }; save(); toast('Lesson complete! 🎉'); render(); });
  if (u) u.addEventListener('click', () => { markDone(mod.id, li, false); render(); });
  store.lastOpen = { mid: mod.id, li }; save();
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

/* Block renderer for the curriculum blocks */
function renderBlock(b) {
  switch (b.t) {
    case 'p': return `<p>${esc(b.x)}</p>`;
    case 'h': return `<h2>${esc(b.x)}</h2>`;
    case 'list': return `<ul class="tick-list">${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    case 'num': return `<ol>${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`;
    case 'table': return `
      <div class="tbl"><table>
        <thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    case 'code': {
      const cid = 'c' + cyrb53(b.x);
      const bT = b.lang || 'text';
      return `<div class="codeblock">
        <div class="cb-head"><span class="cb-lang">${esc(bT)}</span><button class="cb-copy" data-copy="${cid}" title="Copy">⧉ Copy</button></div>
        <pre id="${cid}" class="lang-${esc(bT)}"><code>${esc(b.x)}</code></pre>
      </div>`;
    }
    case 'callout': {
      const icons = { tip: '💡', warn: '⚠️' };
      return `<div class="callout ${esc(b.kind)}"><div class="co-ico">${icons[b.kind] || '💡'}</div><div>${esc(b.x)}</div></div>`;
    }
    case 'selfcheck': return `
      <div class="selfcheck">
        <div class="sc-head"><span class="sc-qmark">?</span> <span>Check yourself</span></div>
        <div class="sc-q">${esc(b.q)}</div>
        <div class="sc-actions"><button class="btn sm ghost showA">Show answer</button></div>
        <div class="sc-a" hidden>${esc(b.a)}</div>
      </div>`;
    default: return '';
  }
}

/* ------------------------- quiz page ------------------------- */

function renderQuiz(mod) {
  const qs = mod.quiz.questions;
  const prevBest = store.quiz[mod.id]; // fractional 0..1
  view.innerHTML = `
    <div class="crumb reveal"><a href="#/">Dashboard</a> <span>›</span> <a href="#/phase/${mod.id}">${mod.title}</a> <span>›</span> <b>Quiz</b></div>

    <div class="quiz-top reveal" style="--c:${mod.color}">
      <div>
        <div class="ph-kicker">Phase ${String(mod.n).padStart(2, '0')} · ${mod.quiz.title}</div>
        <h1>${mod.icon} ${mod.title} — Quiz</h1>
        <p class="qc-sub">${qs.length} questions. Answer all, get instant feedback + explanations, then save your score.</p>
      </div>
      <div class="quiz-best">
        ${prevBest != null
          ? `Best: <b>${Math.round(prevBest * qs.length)}/${qs.length}</b> · ${Math.round(prevBest * 100)}%`
          : 'No score yet'}
      </div>
    </div>

    <div class="quiz-list reveal" id="quizList"></div>
    <div class="lesson-foot reveal" id="quizFoot"></div>`;

  const list = $('#quizList');
  qs.forEach((q, qi) => {
    const item = document.createElement('div');
    item.className = 'q-item';
    item.dataset.qi = qi;
    item.innerHTML = `
      <div class="q-head"><span class="q-num">Q${qi + 1}</span><span class="q-prog"></span></div>
      <div class="q-text">${esc(q.q)}</div>
      <div class="q-opts">
        ${q.opts.map((o, oi) => `
          <button class="q-opt" data-oi="${oi}">
            <span class="q-letter">${String.fromCharCode(65 + oi)}</span>
            <span class="q-otext">${esc(o)}</span>
            <span class="q-mark"></span>
          </button>`).join('')}
      </div>
      <div class="q-why" hidden><div class="qw-label"></div><div class="qw-text">${esc(q.why)}</div></div>`;
    list.appendChild(item);
  });

  // footer buttons
  const foot = $('#quizFoot');
  foot.innerHTML = `
    <div class="lf-left"><button class="btn ghost sm" id="resetQuiz">↺ Reset</button></div>
    <div class="lf-right">
      <button class="btn primary" id="saveScore" disabled>✓ Save my score</button>
      <a class="btn ghost sm" href="#/phase/${mod.id}">Back to module</a>
    </div>`;

  $('#resetQuiz').addEventListener('click', () => renderQuiz(mod));

  const saveBtn = $('#saveScore');
  let answered = 0, score = 0;
  const reset = () => { answered = 0; score = 0; saveBtn.disabled = true; };

  $$('.q-item', list).forEach(item => {
    const qi = +item.dataset.qi;
    const prog = $('.q-prog', item);

    $$('.q-opt', item).forEach(btn => {
      btn.addEventListener('click', () => {
        if (item.dataset.state) return; // already answered
        const oi = +btn.dataset.oi;
        const correct = oi === qs[qi].a;
        item.dataset.state = correct ? 'right' : 'wrong';
        prog.textContent = item.dataset.state === 'right' ? '✓ correct' : '✗';
        prog.classList.add(item.dataset.state === 'right' ? 'ok' : 'bad');

        $$('.q-opt', item).forEach(o => {
          const t = +o.dataset.oi;
          o.classList.add(t === qs[qi].a ? 'right' : 'dim');
          if (t === oi && !correct) o.classList.add('wrong');
          o.disabled = true;
        });
        const why = $('.q-why', item);
        why.hidden = false;
        $('.qw-label', why).textContent = item.dataset.state === 'right' ? '🎉 That\u2019s right' : '🙈 Not quite';
        why.classList.add(item.dataset.state === 'right' ? 'ok' : 'bad');

        answered++; if (correct) score++;
        saveBtn.disabled = answered < qs.length;
        if (answered === qs.length) {
          const pct = Math.round(score / qs.length * 100);
          toast(`Quiz complete: ${score}/${qs.length} (${pct}%)`);
          if (pct === 100) confetti();
        }
      });
    });
  });

  saveBtn.addEventListener('click', () => {
    const pct = score / qs.length;
    if (prevBest == null || pct > prevBest) {
      store.quiz[mod.id] = pct;
      store.best[mod.id] = Math.round(pct * qs.length);
      save();
      toast('Score saved — keep it up! 🏆');
      saveBtn.textContent = '✓ Saved — nice work!';
      saveBtn.disabled = true;
    }
    renderSidebar();
  });
}

/* ------------------------- toast ------------------------- */

let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ------------------------- confetti ------------------------- */

function confetti() {
  const colors = ['#00A1E0', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#e8b93d'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    const x = Math.random() * 100;
    const d = Math.random() * 2.4 + 1.2;
    const s = 8 + Math.random() * 8;
    p.style.left = x + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = d + 's';
    p.style.width = p.style.height = s + 'px';
    p.style.setProperty('--tx', (Math.random() * 160 - 80) + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), d * 1000 + 400);
  }
}

/* ------------------------- events wiring ------------------------- */

document.addEventListener('click', e => {
  const sc = e.target.closest('.selfcheck');
  if (sc) {
    const a = $('.sc-a', sc); const btn = $('.showA', sc);
    if (a.hidden) { a.hidden = false; btn.textContent = 'Hide answer'; }
    else { a.hidden = true; btn.textContent = 'Show answer'; }
    return;
  }
  const copy = e.target.closest('.cb-copy');
  if (copy) {
    const pre = document.getElementById(copy.dataset.copy);
    if (pre) {
      const txt = pre.innerText;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
        .then(() => { copy.textContent = '✓ Copied'; setTimeout(() => copy.textContent = '⧉ Copy', 1400); })
        .catch(() => { /* fallback select */ const r = document.createRange(); r.selectNodeContents(pre); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); copy.textContent = '✓ Copied'; setTimeout(() => copy.textContent = '⧉ Copy', 1400); });
    }
  }
});

/* search */
let searchBox = null;
function ensureSearch() {
  if (searchBox) return searchBox;
  searchBox = document.createElement('div');
  searchBox.className = 'search-wrap';
  searchBox.innerHTML = `<input id="globalQ" type="search" placeholder="Search lessons, concepts, topics…" autocomplete="off" />
    <div class="search-results" id="searchRes"></div>`;
  document.body.appendChild(searchBox);

  const input = $('#globalQ', searchBox);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const first = $('.sr-item', wrap);
      if (first) { location.hash = first.getAttribute('href'); closeSearch(); }
    }
    if (e.key === 'Escape') closeSearch();
  });

  const wrap = $('#searchRes', searchBox);
  input.addEventListener('input', runSearch);
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) searchBox.classList.add('open'); });
  return searchBox;
}

function runSearch() {
  const sb = searchBox || ensureSearch();
  const input = $('#globalQ', sb);
  const wrap = $('#searchRes', sb);
  const q = input.value.trim().toLowerCase();
  wrap.innerHTML = '';
  if (q.length < 2) { sb.classList.remove('open'); return; }

  const results = [];
  MODULES.forEach(m => {
    m.lessons.forEach((l, i) => {
      const hay = (m.title + ' ' + m.tagline + ' ' + l.title + ' ' + m.objectives.join(' ') + ' ' + l.blocks.map(bd => bd.x || (bd.items || []).join(' ')).join(' ')).toLowerCase();
      if (hay.includes(q) || m.title.toLowerCase().includes(q)) {
        results.push({ mod: m, li: i, label: m.title + ' → ' + l.title });
      }
    });
    m.quiz.questions.forEach(qq => {
      if ((qq.q + ' ' + qq.why).toLowerCase().includes(q)) {
        results.push({ mod: m, quiz: true, label: `Quiz · ${m.title}: "${qq.q.slice(0, 60)}…"` });
      }
    });
  });
  const seen = new Set(); const uniq = [];
  results.forEach(r => { const k = r.quiz ? 'q' + r.label : r.mod.id + ':' + r.li; if (!seen.has(k)) { seen.add(k); uniq.push(r); } });
  if (!uniq.length) { wrap.innerHTML = '<div class="sr-empty">No results — try "lead", "flow", "report", "quota"…</div>'; }
  else {
    uniq.slice(0, 10).forEach(r => {
      const a = document.createElement('a');
      a.className = 'sr-item';
      a.href = r.quiz ? '#/quiz/' + r.mod.id : '#/lesson/' + r.mod.id + '/' + r.li;
      a.innerHTML = `<span class="sr-ico">${r.quiz ? '🧠' : r.mod.icon}</span><span>${r.label}</span><span class="sr-go">→</span>`;
      a.addEventListener('click', closeSearch);
      wrap.appendChild(a);
    });
  }
  sb.classList.add('open');
}

function openSearch() {
  const sb = ensureSearch();
  sb.classList.add('open');
  const inp = $('#globalQ', sb);
  inp.focus();
  const top = $('#topSearch');
  if (top) { inp.value = top.value; }
  runSearch();
}
function closeSearch() {
  if (searchBox) { searchBox.classList.remove('open'); const inp = $('#globalQ', searchBox); inp.value = ''; }
}

/* hotkey */
window.addEventListener('keydown', e => {
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
  if ((e.key === '/' || e.key === 'f') && !e.ctrlKey && !e.metaKey) {
    if (!typing) { e.preventDefault(); openSearch(); }
    return;
  }
  if (e.key === 'Escape') {
    if (searchBox && searchBox.classList.contains('open')) { closeSearch(); e.preventDefault(); return; }
  }
  if (e.key === 'ArrowLeft' && !typing && route.view === 'lesson') {
    const mod = byId(route.mid);
    if (route.li > 0) navigate('lesson', route.mid, route.li - 1);
  }
  if (e.key === 'ArrowRight' && !typing && route.view === 'lesson') {
    const mod = byId(route.mid);
    if (route.li < mod.lessons.length - 1) navigate('lesson', route.mid, route.li + 1);
  }
});

function bindTopSearch() {
  const topQ = $('#topSearch');
  if (!topQ || topQ.dataset.bound) return;
  topQ.dataset.bound = '1';
  topQ.addEventListener('focus', () => {
    const sb = ensureSearch();
    sb.classList.add('open');
    $('#globalQ', sb).value = topQ.value;
    runSearch();
  });
  topQ.addEventListener('input', () => {
    const sb = ensureSearch();
    sb.classList.add('open');
    $('#globalQ', sb).value = topQ.value;
    runSearch();
  });
}

/* ------------------------- lazy event (hashchange) ------------------------- */
window.addEventListener('hashchange', () => { route = parseHash(); render(); });

/* ------------------------- boot ------------------------- */
route = parseHash();
render();

/* mobile menu */
const menuBtn = $('#menuBtn');
if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    document.body.classList.toggle('sb-open');
    if (document.body.classList.contains('sb-open')) {
      const first = $('.side-phase');
      if (first) first.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
}
document.addEventListener('click', e => {
  if (document.body.classList.contains('sb-open') && !e.target.closest('.sidebar') && !e.target.closest('#menuBtn')) {
    document.body.classList.remove('sb-open');
  }
});