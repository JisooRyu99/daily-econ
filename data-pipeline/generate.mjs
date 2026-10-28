// 오늘의 지표 → today.json
// 실행: node data-pipeline/generate.mjs [출력경로=public/today.json]
// 출시 땐 GitHub Actions가 매일 실행해서 GitHub Pages에 올린다 ("내일을 맞혀라"와 같은 구조).
//
// 데이터 출처 (전부 무료, 키는 .env 또는 GitHub Secrets)
//  - 환율: 한국수출입은행 현재환율 API (EXIM_KEY) — 영업일 오전 11시쯤 발표하는 매매기준율, 하루 한 번.
//          키가 없거나 실패하면 야후 파이낸스(비공식, 실시간)로 대신한다.
//  - 유가: 오피넷 전국 평균 판매가 (OPINET_KEY) — DIFF = 전일 대비
//  - 기준금리·소비자물가: 한국은행 ECOS (ECOS_KEY)
// 키가 없는 지표는 예시값을 쓰고 sample: true 로 표시한다 (화면에 "예시" 태그).

import fs from 'node:fs';
import path from 'node:path';
import { upcomingEvents } from './events.mjs';

// .env의 API 키 읽기 (Node 내장 기능, 파일이 없으면 무시). GitHub Actions에선 Secrets로 넣는다.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {}
const KEYS = { exim: process.env.EXIM_KEY, ecos: process.env.ECOS_KEY, opinet: process.env.OPINET_KEY };

const out = process.argv[2] || 'public/today.json';
// GitHub Actions에선 경고를 화면 상단 알림(annotation)으로 띄운다
const warn = (...a) => console.warn((process.env.GITHUB_ACTIONS ? '::warning::' : '') + a.join(' '));
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const num = (s) => Number(String(s).replace(/,/g, ''));
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
// 한국 시간 기준 오늘 (00시 UTC로 맞춘 Date)
const kstToday = () => new Date(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10));
const dash = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- 환율 ----------

// 오늘부터 거꾸로 영업일 두 번 찾기 (주말·공휴일·오전 11시 전에는 그날 값이 없음)
async function eximRates() {
  const found = [];
  const d = kstToday();
  for (let i = 0; i < 10 && found.length < 2; i++) {
    const day = ymd(d);
    const rows = await json(`https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${KEYS.exim}&searchdate=${day}&data=AP01`);
    const usd = rows.find?.((r) => r.cur_unit === 'USD');
    const jpy = rows.find?.((r) => r.cur_unit === 'JPY(100)');
    const eur = rows.find?.((r) => r.cur_unit === 'EUR');
    if (usd && jpy && eur) found.push({ day, usd: num(usd.deal_bas_r), jpy: num(jpy.deal_bas_r), eur: num(eur.deal_bas_r) });
    d.setUTCDate(d.getUTCDate() - 1);
  }
  if (found.length < 2) throw new Error('수출입은행 환율을 찾지 못함');
  const [now, prev] = found;
  const note = `${+now.day.slice(4, 6)}월 ${+now.day.slice(6)}일 오전 매매기준율`;
  return {
    usdkrw: { value: now.usd, prev: prev.usd, note },
    jpykrw100: { value: now.jpy, prev: prev.jpy, note },
    eurkrw: { value: now.eur, prev: prev.eur, note },
  };
}

async function yahooDaily(symbol) {
  const r = (await json(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10d&interval=1d`)).chart.result[0];
  const closes = r.indicators.quote[0].close.filter((v) => v != null);
  return { value: closes.at(-1), prev: closes.at(-2) };
}

async function yahooRates() {
  const usd = await yahooDaily('KRW=X');
  const jpy = await yahooDaily('JPYKRW=X');
  const eur = await yahooDaily('EURKRW=X');
  const note = '실시간 시세 (참고용)';
  return {
    usdkrw: { value: round(usd.value, 1), prev: round(usd.prev, 1), note },
    jpykrw100: { value: round(jpy.value * 100, 2), prev: round(jpy.prev * 100, 2), note },
    eurkrw: { value: round(eur.value, 1), prev: round(eur.prev, 1), note },
  };
}

// ---------- 유가 ----------

async function opinet() {
  const r = await json(`https://www.opinet.co.kr/api/avgAllPrice.do?out=json&code=${KEYS.opinet}`);
  const oil = r.RESULT.OIL;
  const pick = (code) => {
    const o = oil.find((x) => x.PRODCD === code);
    const value = num(o.PRICE);
    return { value: round(value, 2), prev: round(value - num(o.DIFF), 2), date: dash(o.TRADE_DT) };
  };
  return { gasoline: pick('B027'), diesel: pick('D047') };
}

// ---------- 한국은행 ECOS ----------

async function ecos(stat, cycle, from, to, item, count = 400) {
  const r = await json(`https://ecos.bok.or.kr/api/StatisticSearch/${KEYS.ecos}/json/kr/1/${count}/${stat}/${cycle}/${from}/${to}/${item}`);
  if (!r.StatisticSearch) throw new Error(`ECOS ${stat}: ${JSON.stringify(r.RESULT)}`);
  return r.StatisticSearch.row.map((x) => ({ time: x.TIME, value: Number(x.DATA_VALUE) }));
}

// 기준금리: 일별 기록에서 마지막으로 바뀐 날과 그 전 값
async function baseRate() {
  const to = kstToday();
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 2);
  const rows = await ecos('722Y001', 'D', ymd(from), ymd(to), '0101000', 1000);
  const value = rows.at(-1).value;
  let i = rows.length - 1;
  while (i > 0 && rows[i - 1].value === value) i--;
  return { value, prev: i > 0 ? rows[i - 1].value : value, decidedAt: i > 0 ? dash(rows[i].time) : null };
}

// 소비자물가: 최근 달 지수 ÷ 작년 같은 달 지수
async function cpi() {
  const to = kstToday();
  const from = new Date(to);
  from.setUTCMonth(from.getUTCMonth() - 15);
  const rows = await ecos('901Y009', 'M', ymd(from).slice(0, 6), ymd(to).slice(0, 6), '0', 30);
  const last = rows.at(-1);
  const yearAgo = rows.find((r) => r.time === String(Number(last.time.slice(0, 4)) - 1) + last.time.slice(4));
  return { yoy: round((last.value / yearAgo.value - 1) * 100, 1), month: `${last.time.slice(0, 4)}-${last.time.slice(4)}` };
}

// ---------- 실행 ----------

const SAMPLE = {
  gasoline: { value: 1682, prev: 1691, sample: true },
  diesel: { value: 1541, prev: 1547, sample: true },
  baseRate: { value: 2.5, prev: 2.5, decidedAt: null, sample: true },
  cpi: { yoy: 2.1, month: '2026-09', sample: true },
};

// 실패해도 다른 지표는 계속 — 실패한 건 예시값 + 로그
async function tryOr(name, fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    warn(`⚠️ ${name} 실패 → 대체값 사용:`, e.message);
    return fallback();
  }
}

console.log('키:', Object.entries(KEYS).map(([k, v]) => `${k} ${v ? '있음' : '없음'}`).join(', '));

const fx = KEYS.exim ? await tryOr('수출입은행 환율', eximRates, yahooRates) : await yahooRates();
const oil = KEYS.opinet ? await tryOr('오피넷', opinet, () => ({ gasoline: SAMPLE.gasoline, diesel: SAMPLE.diesel })) : { gasoline: SAMPLE.gasoline, diesel: SAMPLE.diesel };
const rate = KEYS.ecos ? await tryOr('ECOS 기준금리', baseRate, () => SAMPLE.baseRate) : SAMPLE.baseRate;
const price = KEYS.ecos ? await tryOr('ECOS 소비자물가', cpi, () => SAMPLE.cpi) : SAMPLE.cpi;

const data = {
  asOf: new Date().toISOString(),
  indicators: { ...fx, ...oil, baseRate: rate, cpi: price },
  // 금통위·물가 발표는 공식 페이지에서 자동 수집, 코픽스는 규칙 계산 (실패하면 events.json)
  events: await upcomingEvents(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), warn),
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
const i = data.indicators;
console.log(
  `→ ${out}\n  달러 ${i.usdkrw.value} (전 ${i.usdkrw.prev}) ${i.usdkrw.note}\n  100엔 ${i.jpykrw100.value} (전 ${i.jpykrw100.prev})  유로 ${i.eurkrw.value} (전 ${i.eurkrw.prev})` +
    `\n  휘발유 ${i.gasoline.value} (전 ${i.gasoline.prev}) 경유 ${i.diesel.value}` +
    `\n  기준금리 ${i.baseRate.value}% (이전 ${i.baseRate.prev}%, ${i.baseRate.decidedAt} 변경)\n  물가 ${i.cpi.yoy}% (${i.cpi.month})`
);
