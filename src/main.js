import { TERMS, CATEGORIES, termById } from './terms.js';
import { DEFAULT_PROFILE, buildCards, summary, weatherOf, CURRENCIES } from './impact.js';
import { sparkline, weekChange } from './trend.js';
import { buildQuiz, pickTerms } from './quiz.js';
import { store, today } from './store.js';

const $ = (id) => document.getElementById(id);
// GitHub Actions가 gh-pages 브랜치에 올리는 데이터 (저장소 JisooRyu99/daily-econ)
const DATA_URL = 'https://jisooryu99.github.io/daily-econ/today.json';
const ICON = { sun: '☀️', cloud: '⛅', rain: '🌧️' };
const DAY = today();

let data = null;
let tab = 'today';
let profile = { ...structuredClone(DEFAULT_PROFILE), ...store.get('profile', {}) };
let termFilter = { q: '', cat: null };
let history = { filter: 'all', open: DAY }; // 지난 퀴즈: 필터(all|wrong|saved), 펼친 날짜 (처음엔 오늘)

// [[id|표시]] → 용어 링크
const linkify = (s) =>
  s.replace(/\[\[([\w-]+)\|([^\]]+)\]\]/g, (_, id, label) => `<button class="term" data-term="${id}">${label}</button>`);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- 오늘 ----------

function dday(date) {
  const diff = Math.round((new Date(date + 'T00:00:00+09:00') - new Date(DAY + 'T00:00:00+09:00')) / 86400e3);
  return diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

function renderToday() {
  const cards = buildCards(data, profile);
  const sum = summary(cards);
  const dow = new Date(DAY + 'T00:00:00+09:00').getDay();
  if ((dow === 0 || dow === 6) && sum.items.length) sum.sub = '주말엔 발표가 없어서 마지막 영업일 기준이에요';
  const asOf = new Date(data.asOf);
  const asOfText = `${asOf.getMonth() + 1}월 ${asOf.getDate()}일 ${String(asOf.getHours()).padStart(2, '0')}:${String(asOf.getMinutes()).padStart(2, '0')} 기준`;
  const anySample = cards.some((c) => c.sample) || data.events.some((e) => e.sample);
  const events = data.events.filter((e) => e.date >= DAY).slice(0, 3);

  return `<div class="stack">
    <div class="card">
      <div class="hero">
        <div class="icon">${ICON[sum.weather]}</div>
        <div>
          <div class="label">오늘 내 지갑 날씨</div>
          <div class="title">${sum.title}</div>
          <div class="sub">${sum.sub}</div>
        </div>
      </div>
      ${sum.items.length ? `<div class="moods">${sum.items.map((x) => `<span class="mood ${x.mood}">${ICON[{ bad: 'rain', good: 'sun', flat: 'cloud' }[x.mood]]} ${x.name}</span>`).join('')}</div>` : ''}
      ${anySample ? '<span class="badge">"예시" 표시는 아직 실제 데이터가 아니에요</span>' : ''}
    </div>

    ${renderWeekend()}

    ${cards
      .map(
        (c) => `<div class="card">
      <div class="ind-head">
        <div>
          <div class="ind-title">${c.title}${c.sample ? ' <span class="tag-sample">예시</span>' : ''}</div>
          <div class="ind-value">${c.value}<span class="ind-change ${c.change === '동결' || c.change.startsWith('작년') ? 'flat' : c.up ? 'up' : 'down'}">${c.change}</span></div>
        </div>
        <div class="ind-weather">${ICON[weatherOf(c)]}</div>
      </div>
      <div class="ind-text">${linkify(c.text)}</div>
      ${
        c.trend
          ? `<div class="trend">
        ${c.spark ? sparkline(c.spark, { minSpan: c.sparkSpan }) : ''}
        <div class="trend-text">${c.sparkLabel ? `<span class="trend-label">${c.sparkLabel}</span>` : ''}${c.trend.text}${c.trend.range ? `<div class="trend-range">${c.trend.range}</div>` : ''}</div>
      </div>`
          : ''
      }
      <div class="ind-hint">${linkify(c.hint)}</div>
      ${c.note ? `<div class="ind-note">${c.note}</div>` : ''}
    </div>`
      )
      .join('')}

    ${
      events.length
        ? `<div class="section-title">다가오는 일정</div>
    <div class="card" style="padding:8px 20px">
      ${events
        .map(
          (e) => `<div class="event">
        <div class="dday">${dday(e.date)}</div>
        <div><div class="t">${esc(e.title)}${e.sample ? ' <span class="tag-sample">예시</span>' : ''}</div>
        <div class="d">${+e.date.slice(5, 7)}월 ${+e.date.slice(8)}일 · ${e.terms.map((id) => `<button class="term" data-term="${id}">${termById[id].name}</button>`).join(', ')}</div></div>
      </div>`
        )
        .join('')}
    </div>`
        : ''
    }
    <div class="ind-note" style="text-align:center">${asOfText} · 투자 조언이 아닌 생활비 참고용이에요</div>
  </div>`;
}

// ---------- 용어 ----------

// 주말(토·일): 새 발표가 없으니 한 주를 정리해준다
function renderWeekend() {
  const dow = new Date(DAY + 'T00:00:00+09:00').getDay();
  if (dow !== 0 && dow !== 6) return '';
  const ind = data.indicators;
  const won1 = (n, d = 1) => n.toLocaleString('ko-KR', { maximumFractionDigits: d });
  const rows = [];
  if (profile.fx.on) {
    const cur = CURRENCIES[profile.fx.currency] || CURRENCIES.USD;
    const w = weekChange(ind[cur.key].history);
    if (w) rows.push({ name: cur.title, from: `${won1(w.from)}원`, to: `${won1(w.to)}원`, diff: w.diff, unit: '원', mood: w.diff > 0 ? 'bad' : 'good' });
  }
  if (profile.car.on) {
    const diesel = profile.car.fuel === 'diesel';
    const w = weekChange((diesel ? ind.diesel : ind.gasoline).history);
    if (w) rows.push({ name: diesel ? '경유' : '휘발유', from: `${won1(w.from, 0)}원`, to: `${won1(w.to, 0)}원`, diff: w.diff, unit: '원', mood: w.diff > 0 ? 'bad' : 'good' });
  }
  const weekEnd = new Date(Date.parse(DAY) + 7 * 86400e3).toISOString().slice(0, 10);
  const next = data.events.filter((e) => e.date >= DAY && e.date <= weekEnd);
  if (!rows.length && !next.length) return '';
  return `<div class="card">
    <div class="ind-title">이번 주 정리</div>
    <div class="week-sub">주말엔 새 발표가 없어요. 한 주 동안 이렇게 움직였어요</div>
    ${rows
      .map((r) => {
        const flat = Math.abs(r.diff) < 1;
        return `<div class="week-row"><span class="week-name">${r.name}</span>
        <span>${r.from} → <b>${r.to}</b> <span class="ind-change ${flat ? 'flat' : r.diff > 0 ? 'up' : 'down'}">${flat ? '거의 그대로' : `${r.diff > 0 ? '+' : '−'}${won1(Math.abs(r.diff))}${r.unit}`}</span></span></div>`;
      })
      .join('')}
    ${next.length ? `<div class="week-next">다음 주: ${next.map((e) => `${+e.date.slice(5, 7)}/${+e.date.slice(8)} ${esc(e.title)}`).join(', ')}</div>` : ''}
  </div>`;
}

function renderTerms() {
  const todayIds = [...new Set(buildCards(data, profile).flatMap((c) => c.terms))];
  const q = termFilter.q.trim();
  const marks = store.get('bookmarks', []);
  const base = termFilter.cat === 'saved' ? marks.map((id) => termById[id]).filter(Boolean) : TERMS;
  const list = base.filter(
    (t) =>
      (!termFilter.cat || termFilter.cat === 'saved' || t.category === termFilter.cat) &&
      (!q || t.name.includes(q) || t.short.includes(q))
  );
  return `<div class="stack">
    <input class="search" id="term-search" placeholder="궁금한 경제 용어 검색" value="${esc(termFilter.q)}" />
    ${
      todayIds.length && !q
        ? `<div class="section-title" style="margin-top:4px">오늘 나온 용어</div>
    <div class="chips">${todayIds.map((id) => `<button class="chip today" data-term="${id}">${termById[id].name}</button>`).join('')}</div>`
        : ''
    }
    <div class="chips">
      <button class="chip ${!termFilter.cat ? 'on' : ''}" data-cat="">전체</button>
      <button class="chip ${termFilter.cat === 'saved' ? 'on' : ''}" data-cat="saved">🔖 책갈피 ${marks.length}</button>
      ${CATEGORIES.map((c) => `<button class="chip ${termFilter.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.name}</button>`).join('')}
    </div>
    <div class="card" style="padding:4px 20px">
      ${
        list.length
          ? list.map((t) => `<button class="term-row" data-term="${t.id}"><div class="n">${t.name}</div><div class="s">${t.short}</div></button>`).join('')
          : `<div class="empty">${termFilter.cat === 'saved' && !q ? '용어 설명에서 "책갈피"를 누르면<br>다시 볼 용어가 여기 모여요' : '찾는 용어가 아직 없어요'}</div>`
      }
    </div>
  </div>`;
}

function openTerm(id) {
  const t = termById[id];
  if (!t) return;
  const marked = store.get('bookmarks', []).includes(id);
  openSheet(`
    <div class="sheet-head"><h2>${t.name}</h2>
      <button class="mark ${marked ? 'on' : ''}" data-bookmark="${id}">${marked ? '🔖 저장됨' : '책갈피'}</button></div>
    <p class="lead">${t.short}</p>
    <div class="block"><h3>쉽게 말하면</h3><p>${t.analogy}</p></div>
    <div class="block"><h3>내 생활에는</h3><p>${t.life}</p></div>
    ${
      t.related.length
        ? `<div class="block"><h3>함께 보면 좋은 용어</h3><div class="chips">${t.related
            .map((r) => `<button class="chip today" data-term="${r}">${termById[r].name}</button>`)
            .join('')}</div></div>`
        : ''
    }
    <button class="btn secondary" data-close>닫기</button>`);
}

// 책갈피: 최근 저장한 게 위로
function toggleBookmark(id) {
  const marks = store.get('bookmarks', []);
  store.set('bookmarks', marks.includes(id) ? marks.filter((m) => m !== id) : [id, ...marks]);
  openTerm(id);
  if (tab === 'terms') render();
}

// ---------- 퀴즈 ----------
// 저장: quiz:<날짜> = { picks: [고른 보기 index...] }, review = [{ term, due }], streak = { last, count }

function quizState() {
  const saved = store.get('quiz:' + DAY, { picks: [] });
  if (!saved.terms) {
    const due = store.get('review', []).filter((r) => r.due <= DAY).map((r) => r.term);
    saved.terms = pickTerms(DAY, due, store.get('bookmarks', []));
    store.set('quiz:' + DAY, saved);
  }
  const questions = buildQuiz(DAY, data, saved.terms);
  // 다 풀었는데 기록(스냅샷)이 없으면 채운다 — "다시 보기" 기능 전에 푼 오늘 퀴즈 대응
  if (saved.picks.length >= questions.length && !saved.questions) {
    saved.questions = questions;
    store.set('quiz:' + DAY, saved);
    store.set('quizDays', [DAY, ...store.get('quizDays', []).filter((d) => d !== DAY)]);
  }
  return { questions, saved };
}

function renderQuiz() {
  return renderQuizMain() + renderHistory();
}

const dateLabel = (day) => `${+day.slice(5, 7)}월 ${+day.slice(8)}일`;

// 지난 문제 한 장: 문제, 내 답, 정답, 해설
function reviewCard(day, k, q, pick) {
  const id = `${day}#${k}`;
  const marked = store.get('qmarks', []).includes(id);
  const right = pick === q.answer;
  return `<div class="rv">
    <div class="rv-head"><span class="q-tag ${right ? '' : 'review'}">${right ? '맞힘' : '틀림'}</span>
      <button class="mark ${marked ? 'on' : ''}" data-qmark="${id}">${marked ? '🔖 저장됨' : '🔖'}</button></div>
    <div class="rv-q">${q.today && day !== DAY ? q.q.replace(/^오늘/, dateLabel(day)) : q.q}</div>
    ${right ? '' : `<div class="rv-a wrong">내 답 · ${q.options[pick]}</div>`}
    <div class="rv-a">정답 · ${q.options[q.answer]}</div>
    <div class="rv-why">${q.why}</div>
    <button class="term" data-term="${q.term}">'${termById[q.term].name}' 설명 보기</button>
  </div>`;
}

function renderHistory() {
  const qmarks = store.get('qmarks', []);
  // 푼 날짜 목록은 따로 저장 (토스 Storage는 키 목록 조회가 안 될 수 있어서)
  const days = store.get('quizDays', []).filter((d) => store.get('quiz:' + d, {}).questions);
  if (!days.length) return '';
  const visible = (day, k, q, pick) =>
    history.filter === 'all' || (history.filter === 'wrong' ? pick !== q.answer : qmarks.includes(`${day}#${k}`));
  const rows = days
    .map((day) => {
      const s = store.get('quiz:' + day);
      const items = s.questions.map((q, k) => ({ q, k, pick: s.picks[k] })).filter((x) => visible(day, x.k, x.q, x.pick));
      if (!items.length) return '';
      const right = s.questions.filter((q, k) => s.picks[k] === q.answer).length;
      const open = history.filter !== 'all' || history.open === day;
      return `<div class="hist-day">
        <button class="hist-head" data-hday="${day}">
          <span><b>${day === DAY ? '오늘' : dateLabel(day)}</b> · ${s.questions.length}문제 중 ${right}개 맞힘</span>
          <span class="chev">${open ? '접기' : '보기'}</span></button>
        ${open ? items.map((x) => reviewCard(day, x.k, x.q, x.pick)).join('') : ''}
      </div>`;
    })
    .join('');
  return `<div class="section-title" style="margin-top:20px">지난 퀴즈 다시 보기</div>
    <div class="chips" style="margin:10px 0">
      ${[['all', '전체'], ['wrong', '틀린 문제'], ['saved', `🔖 저장한 문제 ${qmarks.length}`]]
        .map(([f, label]) => `<button class="chip ${history.filter === f ? 'on' : ''}" data-hfilter="${f}">${label}</button>`)
        .join('')}
    </div>
    <div class="card" style="padding:4px 20px">${rows || `<div class="empty">${history.filter === 'wrong' ? '틀린 문제가 없어요' : '문제 해설에서 🔖를 누르면 여기 모여요'}</div>`}</div>`;
}

function renderQuizMain() {
  const { questions, saved } = quizState();
  const i = saved.picks.length;
  const progress = `<div class="q-progress">${questions.map((_, k) => `<span class="${k < i ? 'done' : ''}"></span>`).join('')}</div>`;

  if (i >= questions.length) {
    const streak = store.get('streak', { last: null, count: 0 });
    const right = questions.filter((q, k) => saved.picks[k] === q.answer).length;
    return `<div class="card">${progress}
      <div class="done-big">📘</div>
      <div class="done-title">오늘 공부 끝!</div>
      <div class="done-sub">${streak.count > 1 ? `${streak.count}일 연속 공부 중이에요` : '오늘부터 공부 기록을 시작했어요'}<br>${right < questions.length ? '헷갈린 용어는 이틀 뒤에 다시 나와요' : '오늘 문제를 모두 이해했어요'}</div>
      <div class="block"><h3>오늘 본 용어</h3><div class="chips">${[...new Set(questions.map((q) => q.term))]
        .map((id) => `<button class="chip today" data-term="${id}">${termById[id].name}</button>`)
        .join('')}</div></div>
      <div class="done-sub" style="margin-top:16px">내일 새 문제가 나와요 · 아래에서 오늘 문제를 다시 볼 수 있어요</div>
    </div>`;
  }

  const q = questions[i];
  const picked = saved.current;
  const answered = picked != null;
  return `<div class="card">${progress}
    <span class="q-tag ${q.tag ? 'review' : ''}">${q.today ? '오늘 경제' : q.tag === 'review' ? '다시 보기' : q.tag === 'saved' ? '🔖 책갈피' : '용어 복습'}</span>
    <div class="q-text">${q.q}</div>
    ${q.options
      .map((o, k) => {
        const cls = answered ? (k === q.answer ? 'correct' : k === picked ? 'wrong' : '') : '';
        return `<button class="opt ${cls}" data-pick="${k}" ${answered ? 'disabled' : ''}>${o}</button>`;
      })
      .join('')}
    ${
      answered
        ? `<div class="why"><b>${picked === q.answer ? '맞았어요' : '아쉬워요'}</b>${q.why}</div>
    <button class="btn secondary" data-term="${q.term}">'${termById[q.term].name}' 설명 보기</button>
    <button class="btn" data-next>${i + 1 < questions.length ? '다음 문제' : '오늘 공부 마치기'}</button>`
        : ''
    }
  </div>`;
}

function pick(k) {
  const { questions, saved } = quizState();
  const q = questions[saved.picks.length];
  saved.current = k;
  store.set('quiz:' + DAY, saved);
  // 틀린 용어는 이틀 뒤 복습, 맞힌 복습 용어는 목록에서 뺀다
  let review = store.get('review', []).filter((r) => r.term !== q.term);
  if (k !== q.answer) {
    const due = new Date(Date.parse(DAY) + 2 * 86400e3).toISOString().slice(0, 10);
    review.push({ term: q.term, due });
  }
  store.set('review', review);
  render();
}

function next() {
  const { questions, saved } = quizState();
  saved.picks.push(saved.current);
  delete saved.current;
  store.set('quiz:' + DAY, saved);
  if (saved.picks.length >= questions.length) {
    saved.questions = questions;
    store.set('quiz:' + DAY, saved);
    store.set('quizDays', [DAY, ...store.get('quizDays', []).filter((d) => d !== DAY)]);
    const s = store.get('streak', { last: null, count: 0 });
    if (s.last !== DAY) {
      const yesterday = new Date(Date.parse(DAY) - 86400e3).toISOString().slice(0, 10);
      store.set('streak', { last: DAY, count: s.last === yesterday ? s.count + 1 : 1 });
    }
  }
  if (saved.questions) history.open = DAY;
  render();
  window.scrollTo(0, 0);
}

// ---------- 내 관심사 (처음 설정 / 수정) ----------

const won = (n) => (n >= 1e8 ? `${n / 1e8}억` : n >= 1e4 ? `${(n / 1e4).toLocaleString('ko-KR')}만` : n.toLocaleString('ko-KR')) + '원';

function group(key, title, desc, subs = '') {
  const on = profile[key].on;
  return `<div class="opt-group">
    <div class="opt-row"><div><div class="t">${title}</div><div class="d">${desc}</div></div>
    <button class="switch ${on ? 'on' : ''}" data-toggle="${key}" aria-label="${title}"></button></div>
    ${on && subs ? `<div class="sub-opts">${subs}</div>` : ''}
  </div>`;
}
const choices = (key, field, items) =>
  `<div class="chips">${items
    .map(([v, label]) => `<button class="chip ${profile[key][field] === v ? 'on' : ''}" data-set="${key}.${field}" data-v="${v}">${label}</button>`)
    .join('')}</div>`;

function openProfile() {
  const fxAmounts = {
    USD: [[300, '300달러'], [1000, '1,000달러'], [3000, '3,000달러']],
    JPY: [[30000, '3만 엔'], [100000, '10만 엔'], [300000, '30만 엔']],
    EUR: [[300, '300유로'], [1000, '1,000유로'], [3000, '3,000유로']],
  }[profile.fx.currency];
  openSheet(`
    <h2>${profile.set ? '내 관심사' : '나에게 해당되는 걸 골라주세요'}</h2>
    <p class="lead" style="font-size:14px;color:var(--sub)">고른 것만 "내 돈으로 얼마인지" 계산해서 보여드려요. 대략적인 값이면 충분해요.</p>
    ${group('fx', '해외여행·해외 직구', '환율이 바뀌면 얼마나 달라지는지',
      choices('fx', 'currency', [['USD', '달러'], ['JPY', '엔화'], ['EUR', '유로']]) + choices('fx', 'amount', fxAmounts))}
    ${group('car', '자동차', '기름값이 바뀌면 주유비가 얼마나 달라지는지',
      choices('car', 'fuel', [['gasoline', '휘발유'], ['diesel', '경유']]) + choices('car', 'liters', [[20, '주 20L'], [40, '주 40L'], [60, '주 60L']]))}
    ${group('loan', '대출', '금리가 바뀌면 이자가 얼마나 달라지는지',
      choices('loan', 'type', [['variable', '변동금리'], ['fixed', '고정금리']]) + choices('loan', 'amount', [[50_000_000, won(5e7)], [100_000_000, won(1e8)], [300_000_000, won(3e8)]]))}
    ${group('savings', '예·적금', '금리가 바뀌면 예금 이자가 어떻게 되는지')}
    ${group('grocery', '장보기', '물가가 오르면 한 달 장보기가 얼마나 늘었는지',
      choices('grocery', 'monthly', [[300_000, '월 30만'], [600_000, '월 60만'], [1_000_000, '월 100만']]))}
    <button class="btn" data-save>${profile.set ? '저장하기' : '시작하기'}</button>`);
}

function setProfile(path, v) {
  const [k, f] = path.split('.');
  const num = Number(v);
  profile[k][f] = Number.isNaN(num) ? v : num;
  if (k === 'fx' && f === 'currency') profile.fx.amount = v === 'JPY' ? 100000 : 1000;
  openProfile();
}

// ---------- 공통 ----------

function openSheet(html) {
  $('sheet-body').innerHTML = html;
  $('sheet').hidden = false;
}
function closeSheet() {
  $('sheet').hidden = true;
}

function render() {
  $('view').innerHTML = tab === 'today' ? renderToday() : tab === 'terms' ? renderTerms() : renderQuiz();
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const d = new Date(DAY + 'T00:00:00+09:00');
  $('h-date').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
  if (tab === 'terms') {
    const input = $('term-search');
    input.addEventListener('input', () => {
      termFilter.q = input.value;
      const pos = input.selectionStart;
      render();
      const again = $('term-search');
      again.focus();
      again.setSelectionRange(pos, pos);
    });
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('button, #sheet');
  if (!el) return;
  if (el.id === 'sheet') {
    if (e.target.id === 'sheet') closeSheet(); // 바깥 영역 탭하면 닫기
    return;
  }
  const d = el.dataset;
  if (d.tab) { tab = d.tab; render(); window.scrollTo(0, 0); }
  else if (d.bookmark) toggleBookmark(d.bookmark);
  else if (d.qmark) {
    const m = store.get('qmarks', []);
    store.set('qmarks', m.includes(d.qmark) ? m.filter((x) => x !== d.qmark) : [d.qmark, ...m]);
    render();
  } else if (d.hfilter) { history.filter = d.hfilter; render(); }
  else if (d.hday) { history.open = history.open === d.hday ? null : d.hday; render(); }
  else if (d.term) openTerm(d.term);
  else if ('cat' in d) { termFilter.cat = d.cat || null; render(); }
  else if (d.pick) pick(+d.pick);
  else if ('next' in d) next();
  else if ('close' in d) closeSheet();
  else if (d.toggle) { profile[d.toggle].on = !profile[d.toggle].on; openProfile(); }
  else if (d.set) setProfile(d.set, d.v);
  else if ('save' in d) { profile.set = true; store.set('profile', profile); closeSheet(); render(); }
  else if (el.id === 'gear') openProfile();
});

(async function init() {
  // 개발 중엔 public/today.json, 빌드(출시)에선 GitHub Pages의 today.json (GitHub Actions가 하루 두 번 갱신)
  data = await fetch(import.meta.env.DEV ? '/today.json' : DATA_URL, { cache: 'no-store' }).then((r) => r.json());
  render();
  if (!profile.set) openProfile();
})();
