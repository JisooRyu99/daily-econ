// 하루 3문제: 오늘 데이터로 만든 1문제 + 용어 복습 2문제.
// 점수·순위·보상 없음 — 학습 앱으로 남기 위해 (게임으로 분류되면 등급분류 필요).
// 틀린 용어는 며칠 뒤 다시 나온다.

import { TERMS, termById } from './terms.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (day) => [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function shuffled(q, r) {
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { ...q, options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) };
}

// 오늘 데이터 문제: 오늘 데이터로 만들 수 있는 문제들 중 하나를 날짜별로 돌아가며 낸다.
// (예전엔 환율·유가 두 종류뿐이라 매일 비슷한 문제가 나왔다)
const fmt = (n, d = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: d });
const wonText = (n) => {
  const man = Math.trunc(n / 10000), rest = Math.round(n % 10000);
  return `${man}만${rest ? ' ' + fmt(rest) : ''}원`;
};

function dataQuestions(data) {
  const ind = data.indicators;
  const out = [];
  const fxQ = (key, name, place) => {
    const i = ind[key];
    if (!i || Math.abs(i.value - i.prev) < 0.5) return;
    const up = i.value > i.prev;
    out.push({
      q: `오늘 ${name} 환율이 ${up ? '올랐어요' : '내렸어요'}. ${place} 여행 경비는 원화로 따지면?`,
      options: [up ? '늘어나요' : '줄어들어요', up ? '줄어들어요' : '늘어나요', '그대로예요'],
      answer: 0,
      why: `환율이 ${up ? '오르면 같은 외화를 사는 데 원화가 더 들어요' : '내리면 같은 외화를 사는 데 원화가 덜 들어요'}.`,
      term: 'exchange-rate',
    });
  };
  fxQ('usdkrw', '달러', '미국');
  fxQ('jpykrw100', '엔화', '일본');
  fxQ('eurkrw', '유로', '유럽');

  const h = ind.usdkrw?.history;
  if (h?.length > 10) {
    const pct = (h.at(-1).v / h[0].v - 1) * 100;
    if (Math.abs(pct) >= 1) {
      const down = pct < 0;
      out.push({
        q: `달러 환율이 한 달 전보다 ${fmt(Math.abs(pct), 1)}% ${down ? '내렸어요' : '올랐어요'}. 이럴 때 상대적으로 유리한 쪽은?`,
        options: down ? ['미국 여행을 준비하는 사람', '물건을 수출하는 기업', '둘 다 불리해요'] : ['물건을 수출하는 기업', '미국 여행을 준비하는 사람', '둘 다 불리해요'],
        answer: 0,
        why: down ? '환율이 내리면 달러가 싸져서 해외에서 쓰는 사람에게 유리해요.' : '환율이 오르면 같은 달러 매출이 원화로 더 커져서 수출 기업에 유리해요.',
        term: 'won-weak',
      });
    }
  }

  const r = ind.baseRate;
  if (r && r.decidedAt && r.value !== r.prev) {
    const up = r.value > r.prev;
    out.push({
      q: `${+r.decidedAt.slice(5, 7)}월 금통위가 기준금리를 ${r.value.toFixed(2)}%로 ${up ? '올렸어요' : '내렸어요'}. 변동금리 대출 이자는 보통?`,
      options: [up ? '늘어나는 쪽으로 움직여요' : '줄어드는 쪽으로 움직여요', up ? '줄어드는 쪽으로 움직여요' : '늘어나는 쪽으로 움직여요', '절대 바뀌지 않아요'],
      answer: 0,
      why: '변동금리 대출은 시장 금리를 따라 주기적으로 바뀌어서, 기준금리 방향을 따라가는 경향이 있어요.',
      term: 'variable-rate',
    });
  }

  const c = ind.cpi;
  if (c && c.yoy) {
    const now = 100000 * (1 + c.yoy / 100);
    const wrong = 100000 * (1 - c.yoy / 100);
    out.push({
      q: `${+c.month.slice(5)}월 소비자물가가 작년 같은 달보다 ${fmt(c.yoy, 1)}% 올랐어요. 작년에 10만 원어치 장보기는 지금 평균 얼마일까요?`,
      options: [`약 ${wonText(now)}`, `약 ${wonText(wrong)}`, '그대로 10만 원'],
      answer: 0,
      why: `10만 원 × ${fmt(c.yoy, 1)}% = 약 ${fmt(now - 100000)}원이 더 들어요.`,
      term: 'cpi',
    });
  }

  out.push({
    q: '다음 중 주유소 기름값에 영향을 주지 않는 것은?',
    options: ['아파트 관리비', '국제유가', '유류세'],
    answer: 0,
    why: '주유소 가격은 국제유가, 환율, 유류세의 영향을 받아요. 관리비와는 상관없어요.',
    term: 'oil-price',
  });
  return out.map((x) => ({ ...x, today: true }));
}

function dataQuestion(data, day) {
  const qs = dataQuestions(data);
  return qs[seedOf(day + ':data') % qs.length];
}

// 오늘 볼 용어 2개 고르기: 복습할 용어(예전에 틀린 것) → 책갈피한 용어 1개 → 나머지는 무작위.
// 고른 결과는 그날 저장해두고 다시 고르지 않는다 (풀다가 복습 목록이 바뀌어도 문제가 안 바뀌게).
export function pickTerms(day, review = [], bookmarks = []) {
  const r = rng(seedOf(day) + 1);
  const picks = [];
  const tag = {};
  for (const id of review) if (picks.length < 2 && termById[id] && !picks.includes(id)) { picks.push(id); tag[id] = 'review'; }
  const saved = bookmarks.filter((id) => termById[id] && !picks.includes(id));
  if (picks.length < 2 && saved.length) {
    const id = saved[Math.floor(r() * saved.length)];
    picks.push(id);
    tag[id] = 'saved';
  }
  const pool = TERMS.map((t) => t.id).filter((id) => !picks.includes(id));
  while (picks.length < 2) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return picks.map((id) => ({ id, tag: tag[id] || null }));
}

export function buildQuiz(day, data, picks) {
  const r = rng(seedOf(day));
  // 용어마다 문제가 여러 개 → 날짜별로 다른 문제
  const termQs = picks.map(({ id, tag }) => {
    const list = termById[id].quizzes;
    return { ...list[seedOf(day + id) % list.length], term: id, tag };
  });
  return [dataQuestion(data, day), ...termQs].map((q) => shuffled(q, r));
}
