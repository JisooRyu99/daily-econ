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

// 오늘 데이터 문제: 가장 크게 움직인 지표로 만든다
function dataQuestion(data) {
  const fx = data.indicators.usdkrw;
  const oil = data.indicators.gasoline;
  const fxUp = fx.value > fx.prev;
  if (Math.abs(fx.value - fx.prev) >= 3) {
    return {
      q: `오늘 원/달러 환율이 ${fxUp ? '올랐어요' : '내렸어요'}. 미국 사이트 직구 비용은?`,
      options: [fxUp ? '비싸져요' : '싸져요', fxUp ? '싸져요' : '비싸져요', '그대로예요'],
      answer: 0,
      why: `환율이 ${fxUp ? '오르면 같은 달러를 사는 데 원화가 더 들어서' : '내리면 같은 달러를 사는 데 원화가 덜 들어서'} 직구 비용도 ${fxUp ? '올라요' : '내려요'}.`,
      term: 'exchange-rate',
      today: true,
    };
  }
  const oilUp = oil.value > oil.prev;
  return {
    q: `오늘 휘발유 값이 ${oilUp ? '올랐어요' : '내렸어요'}. 다음 중 기름값에 영향을 주지 않는 것은?`,
    options: ['아파트 관리비', '국제유가', '유류세'],
    answer: 0,
    why: '주유소 가격은 국제유가, 환율, 유류세의 영향을 받아요. 관리비와는 상관없어요.',
    term: 'oil-price',
    today: true,
  };
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
  const termQs = picks.map(({ id, tag }) => ({ ...termById[id].quiz, term: id, tag }));
  return [dataQuestion(data), ...termQs].map((q) => shuffled(q, r));
}
