// 다가오는 경제 일정 자동 수집.
//  - 금통위: 한국은행 "통화정책방향 결정회의 일정" 페이지에서 "11월 26일(목)" 형식을 읽는다
//  - 소비자물가 발표: 통계청(국가데이터처) 통계공표일정 페이지에서 "2026-11-03( 화 ) 2026년 10월 소비자물가동향"을 읽는다
//  - 코픽스: 규칙 계산 — 매월 15일, 주말이면 다음 월요일 (공휴일은 반영 안 함, 아래 events.json으로 보정)
// 읽기에 실패한 출처는 data-pipeline/events.json(수동 관리)의 같은 종류 일정으로 대신한다.
// events.json에 있는 일정은 항상 함께 들어간다 (같은 날·같은 제목이면 하나만).

import fs from 'node:fs';

const BOK_URL = 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755';
const STATS_URL = 'https://www.mods.go.kr/lcofNewsPln.es?mid=a50303000000';

const pad = (n) => String(n).padStart(2, '0');
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function page(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return textOf(await res.text());
}

async function bokMeetings(year) {
  const t = await page(BOK_URL);
  const dates = [...t.matchAll(/(\d{1,2})월 (\d{1,2})일\(([월화수목금토일])\)/g)].map((m) => `${year}-${pad(m[1])}-${pad(m[2])}`);
  if (dates.length < 4) throw new Error(`금통위 날짜를 ${dates.length}개만 찾음`);
  return [...new Set(dates)].map((date) => ({ date, title: '기준금리 결정 (금통위)', terms: ['base-rate', 'mpc'], kind: 'mpc' }));
}

async function cpiReleases() {
  const t = await page(STATS_URL);
  const found = [...t.matchAll(/(\d{4}-\d{2}-\d{2})\( \S \) \d{4}년 (\d{1,2})월 소비자물가동향/g)];
  if (found.length < 6) throw new Error(`물가 발표일을 ${found.length}개만 찾음`);
  return found.map((m) => ({ date: m[1], title: `${m[2]}월 소비자물가 발표`, terms: ['cpi'], kind: 'cpi' }));
}

function cofixDates(from, months = 3) {
  const out = [];
  for (let k = 0; k < months; k++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + k, 15));
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    const prevMonth = ((d.getUTCMonth() + 11) % 12) + 1;
    out.push({ date: d.toISOString().slice(0, 10), title: `${prevMonth}월 코픽스 공시`, terms: ['cofix'], kind: 'cofix' });
  }
  return out;
}

export async function upcomingEvents(todayStr, warn = console.warn) {
  const manual = JSON.parse(fs.readFileSync(new URL('./events.json', import.meta.url))).events;
  const today = new Date(todayStr + 'T00:00:00Z');
  const fromManual = (kind) => manual.filter((e) => e.kind === kind);

  const sources = [
    ['금통위', () => bokMeetings(today.getUTCFullYear()), 'mpc'],
    ['소비자물가', cpiReleases, 'cpi'],
  ];
  let events = cofixDates(today);
  for (const [name, fn, kind] of sources) {
    try {
      events.push(...(await fn()));
    } catch (e) {
      warn(`⚠️ ${name} 일정 자동 수집 실패 → events.json 사용:`, e.message);
      events.push(...fromManual(kind));
    }
  }
  // 수동 일정(보정·추가)은 항상 포함
  events.push(...manual.filter((e) => !e.kind || e.kind === 'extra'));

  const seen = new Set();
  events = events
    .filter((e) => e.date >= todayStr)
    .filter((e) => !seen.has(e.date + e.title) && seen.add(e.date + e.title))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ kind, ...e }) => e);

  // 앞으로 30일 안에 일정이 없으면 알려준다 (연말에 다음 해 일정이 아직 안 올라왔을 때 등)
  const in30 = new Date(today.getTime() + 30 * 86400e3).toISOString().slice(0, 10);
  if (!events.some((e) => e.date <= in30)) warn('⚠️ 앞으로 30일 안에 일정이 없어요. data-pipeline/events.json에 추가해주세요.');
  return events;
}
