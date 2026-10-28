// 하루치 변화만으로는 큰 건지 작은 건지 모른다 → 기간 안에서 지금이 어디쯤인지 한 줄로.
// 숫자는 전부 기록(history)에서 계산.

const fmt = (n, d = 0) => n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

// 환율: 최근 한 달 (영업일 약 22개)
export function fxTrend(hist) {
  if (!hist || hist.length < 5) return null;
  const vals = hist.map((h) => h.v);
  const last = vals.at(-1), first = vals[0];
  const max = Math.max(...vals), min = Math.min(...vals);
  const pct = (last / first - 1) * 100;
  const move = Math.abs(pct) < 0.5 ? '한 달 전과 비슷해요' : `한 달 전보다 ${fmt(Math.abs(pct), 1)}% ${pct > 0 ? '올랐어요' : '내렸어요'}`;
  const where = last >= max ? ' · 최근 한 달 중 가장 높아요' : last <= min ? ' · 최근 한 달 중 가장 낮아요' : '';
  return { text: move + where, range: `한 달 범위 ${fmt(min, 1)}~${fmt(max, 1)}원` };
}

// 유가: 최근 일주일
export function oilTrend(hist) {
  if (!hist || hist.length < 4) return null;
  const vals = hist.map((h) => h.v);
  const max = Math.max(...vals), min = Math.min(...vals);
  if (max - min < 2) return { text: '일주일째 거의 그대로예요' };
  // 끝에서부터 같은 방향으로 몇 번 연속 움직였는지
  let streak = 0, dir = 0;
  for (let k = vals.length - 1; k > 0; k--) {
    const d = Math.sign(vals[k] - vals[k - 1]);
    if (!d || (dir && d !== dir)) break;
    dir = d;
    streak++;
  }
  if (streak >= 3) return { text: `${streak}일 연속 ${dir > 0 ? '올랐어요' : '내렸어요'}` };
  const week = vals.at(-1) - vals[0];
  return { text: `일주일 전보다 ${fmt(Math.abs(week))}원 ${week > 0 ? '올랐어요' : '내렸어요'}` };
}

// 기준금리: 최근 1년 변경 내역
export function rateTrend(changes) {
  if (!changes) return null;
  if (!changes.length) return { text: '최근 1년 동안 한 번도 바뀌지 않았어요' };
  const list = changes.map((c) => `${+c.d.slice(5, 7)}월 ${fmt(c.v, 2)}%`).join(' → ');
  return { text: `최근 1년 동안 ${changes.length}번 바뀌었어요 (${list})` };
}

// 물가: 최근 6개월 상승률
export function cpiTrend(hist) {
  if (!hist || hist.length < 2) return null;
  const last = hist.at(-1).v, prev = hist.at(-2).v;
  const prevMonth = +hist.at(-2).d.slice(5);
  const cmp = Math.abs(last - prev) < 0.1 ? `${prevMonth}월(${fmt(prev, 1)}%)과 비슷해요` : `${prevMonth}월(${fmt(prev, 1)}%)보다 ${last > prev ? '높아졌어요' : '낮아졌어요'}`;
  const hot = hist.filter((h) => h.v >= 3).length;
  return { text: cmp + (hot ? ` · 최근 ${hist.length}달 중 ${hot}달이 3% 이상이었어요` : '') };
}

// 작은 추세 그래프 (SVG). 처음보다 오르면 빨강, 내리면 파랑 — 화면의 등락 색과 같다.
// minSpan: 세로 눈금의 최소 폭. 없으면 0.3원 움직임도 화면 가득 급등락처럼 보인다
// (휘발유 일주일 0.3원 변화가 급락처럼 그려졌던 문제).
export function sparkline(vals, { w = 300, h = 40, minSpan = 0 } = {}) {
  if (!vals || vals.length < 2) return '';
  let max = Math.max(...vals), min = Math.min(...vals);
  if (max - min < minSpan) {
    const mid = (max + min) / 2;
    max = mid + minSpan / 2;
    min = mid - minSpan / 2;
  }
  const span = max - min || 1;
  const pts = vals.map((v, k) => [(k / (vals.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const d = pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const flat = Math.max(...vals) - Math.min(...vals) < minSpan / 4 || max - min < 1e-9;
  const color = flat ? 'var(--muted)' : vals.at(-1) > vals[0] ? 'var(--up)' : 'var(--down)';
  const [lx, ly] = pts.at(-1);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="${color}"/></svg>`;
}

// 주말용 이번 주 정리: 최근 값과 7일 전(그 이전 가장 가까운 값) 비교
export function weekChange(hist) {
  if (!hist || hist.length < 2) return null;
  const last = hist.at(-1);
  const cut = new Date(Date.parse(last.d) - 7 * 86400e3).toISOString().slice(0, 10);
  const base = [...hist].reverse().find((h) => h.d <= cut) || hist[0];
  return { from: base.v, to: last.v, diff: last.v - base.v };
}
