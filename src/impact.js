import { fxTrend, oilTrend, rateTrend, cpiTrend } from './trend.js';

// 경제 지표 → "내 지갑에 얼마" 카드.
// 숫자는 전부 데이터에서 계산하고 문장은 템플릿으로 만든다 (AI가 숫자를 지어낼 일이 없음).
// 투자 판단이 아니라 생활비 영향만 말한다.

export const DEFAULT_PROFILE = {
  set: false, // 처음 설정을 마쳤는지
  fx: { on: true, currency: 'USD', amount: 1000 }, // 해외여행·직구 (외화 기준 금액)
  car: { on: false, fuel: 'gasoline', liters: 40 }, // 주당 주유량(L)
  loan: { on: false, type: 'variable', amount: 100_000_000 },
  savings: { on: false, amount: 10_000_000 },
  grocery: { on: true, monthly: 600_000 }, // 한 달 장보기
};

const round2 = (n) => Math.round(n * 100) / 100;

// 10만 원 이상은 '61만 2,600원', 1억 이상은 '1억 2,000만원'처럼 읽기 쉽게
export const won = (n) => {
  n = Math.round(n);
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 100_000) return sign + n.toLocaleString('ko-KR') + '원';
  const eok = Math.trunc(n / 1e8), man = Math.trunc((n % 1e8) / 1e4), rest = n % 1e4;
  const parts = [eok && `${eok.toLocaleString('ko-KR')}억`, man && `${man.toLocaleString('ko-KR')}만`, rest && rest.toLocaleString('ko-KR')].filter(Boolean);
  return sign + parts.join(' ') + '원';
};
const signed = (n, digits = 0) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// 지갑 기준 방향: bad(돈이 더 듦) → 비, good(덜 듦) → 맑음, flat → 구름.
// "오늘 내 지갑 날씨"는 금액을 더하지 않고 방향만 센다 — "1,000달러 쓴다면", "40L 넣는다면"은
// 각각 가정이라 더한 금액은 아무 의미가 없다.
const WEATHER = { bad: 'rain', good: 'sun', flat: 'cloud' };

// 해외 결제 통화: today.json 지표 키, 환율 기준 단위(엔화는 100엔), 표시
export const CURRENCIES = {
  USD: { key: 'usdkrw', per: 1, unit: '달러', title: '달러 환율' },
  JPY: { key: 'jpykrw100', per: 100, unit: '엔', title: '엔화 환율 (100엔)' },
  EUR: { key: 'eurkrw', per: 1, unit: '유로', title: '유로 환율' },
};

// 텍스트 안 [[용어id|표시]] 는 화면에서 용어 링크가 된다
export function buildCards(data, profile) {
  const ind = data.indicators;
  const cards = [];

  if (profile.fx.on) {
    const cur = CURRENCIES[profile.fx.currency] || CURRENCIES.USD;
    const i = ind[cur.key];
    const delta = i.value - i.prev;
    const cost = (profile.fx.amount / cur.per) * delta; // 엔화는 100엔 기준 환율
    const pct = (delta / i.prev) * 100;
    const mood = Math.abs(pct) < 0.1 ? 'flat' : delta > 0 ? 'bad' : 'good';
    const spend = `${profile.fx.amount.toLocaleString('ko-KR')}${cur.unit}`;
    cards.push({
      id: 'fx',
      sample: i.sample,
      title: cur.title,
      note: i.note,
      value: `${i.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`,
      change: `${signed(delta, 1)}원`,
      up: delta > 0,
      mood,
      daily: true,
      short: cur.title,
      trend: fxTrend(i.history),
      spark: i.history?.map((h) => h.v),
      sparkSpan: i.value * 0.02, // 환율 2% 미만 움직임은 완만하게
      sparkLabel: '최근 한 달',
      text:
        mood === 'flat'
          ? `[[exchange-rate|환율]]이 거의 그대로라 해외에서 쓰는 돈도 어제와 비슷해요.`
          : `해외에서 ${spend} 쓰면 전 영업일보다 약 ${won(Math.abs(cost))} ${cost > 0 ? '더 들어요' : '덜 들어요'}.`,
      hint: delta > 0 ? `[[exchange-rate|환율]]이 오르면 [[won-weak|원화 약세]]라서 해외 결제가 비싸져요.` : `[[exchange-rate|환율]]이 내리면 해외 결제가 싸져요.`,
      terms: ['exchange-rate', 'won-weak'],
    });
  }

  if (profile.car.on) {
    const diesel = profile.car.fuel === 'diesel';
    const i = diesel ? ind.diesel : ind.gasoline;
    const delta = i.value - i.prev;
    const cost = delta * profile.car.liters;
    const mood = Math.abs(delta) < 1 ? 'flat' : delta > 0 ? 'bad' : 'good';
    cards.push({
      id: 'car',
      sample: i.sample,
      title: diesel ? '경유 (전국 평균)' : '휘발유 (전국 평균)',
      value: `${Math.round(i.value).toLocaleString('ko-KR')}원/L`,
      change: `${signed(delta, Math.abs(delta) < 1 ? 2 : 0)}원`,
      up: delta > 0,
      mood,
      daily: true,
      short: diesel ? '경유' : '휘발유',
      trend: oilTrend(i.history),
      spark: i.history?.map((h) => h.v),
      sparkSpan: 30, // 유가 30원 미만 움직임은 완만하게
      sparkLabel: '최근 일주일',
      text:
        mood === 'flat'
          ? `기름값이 어제와 거의 같아요.`
          : `이번 주 ${profile.car.liters}L 주유하면 약 ${won(Math.abs(cost))} ${cost > 0 ? '더 들어요' : '아껴요'}.`,
      hint: `주유소 가격은 [[oil-price|국제유가]]와 [[exchange-rate|환율]], [[fuel-tax|유류세]]에 따라 움직여요.`,
      terms: ['oil-price', 'fuel-tax'],
      note: i.date ? '오피넷 전국 평균 판매가' : undefined,
    });
  }

  if (profile.loan.on || profile.savings.on) {
    const r = ind.baseRate;
    const delta = round2(r.value - r.prev);
    const when = r.decidedAt ? `${+r.decidedAt.slice(5, 7)}월 ${+r.decidedAt.slice(8)}일` : null;
    const days = r.decidedAt ? (Date.parse(data.asOf) - Date.parse(r.decidedAt)) / 86400e3 : Infinity;
    const lines = [];
    let monthly = 0;
    if (when && delta !== 0) lines.push(`${when} [[mpc|금통위]]에서 ${Math.abs(delta).toFixed(2)}%p ${delta > 0 ? '올렸어요' : '내렸어요'}.`);
    else lines.push(`최근 [[mpc|금통위]]에서 그대로 뒀어요.`);
    if (profile.loan.on) {
      if (profile.loan.type === 'fixed') {
        lines.push(`고정금리 대출은 약정 기간 동안 영향을 받지 않아요.`);
      } else if (delta !== 0) {
        monthly = (profile.loan.amount * delta) / 100 / 12;
        lines.push(`[[variable-rate|변동금리]] 대출 ${won(profile.loan.amount)}이 같은 폭으로 따라 움직였다면 한 달 이자가 약 ${won(Math.abs(monthly))} ${monthly > 0 ? '늘어난' : '줄어든'} 셈이에요.`);
      }
    }
    if (profile.savings.on && delta !== 0) {
      lines.push(`예·적금 금리도 ${delta > 0 ? '오르는' : '내리는'} 쪽으로 움직였을 가능성이 커요.`);
    }
    const recent = days <= 3 && delta !== 0;
    // 대출(변동)이 있으면 인상이 불리, 예·적금만 있으면 인상이 유리
    const hurts = profile.loan.on && profile.loan.type === 'variable' ? delta > 0 : delta < 0;
    const mood = recent ? (hurts ? 'bad' : 'good') : 'flat';
    cards.push({
      id: 'rate',
      sample: r.sample,
      title: '기준금리',
      value: `${r.value.toFixed(2)}%`,
      change: delta === 0 ? '동결' : `${signed(delta, 2)}%p${when ? ` · ${when}` : ''}`,
      up: delta > 0,
      mood,
      daily: recent, // 두 달 전 결정을 매일 "오늘 날씨"에 넣지 않는다
      trend: rateTrend(r.changes),
      short: '기준금리',
      text: lines.join(' '),
      hint: `[[base-rate|기준금리]]는 [[mpc|금통위]]가 1년에 8번 정해요.`,
      terms: ['base-rate', 'mpc', 'variable-rate'],
    });
  }

  if (profile.grocery.on) {
    const c = ind.cpi;
    const now = profile.grocery.monthly * (1 + c.yoy / 100);
    const [y, m] = c.month.split('-');
    cards.push({
      id: 'price',
      sample: c.sample,
      title: `소비자물가 (${+m}월)`,
      value: `${c.yoy > 0 ? '+' : ''}${c.yoy.toFixed(1)}%`,
      change: '작년 같은 달 대비',
      up: c.yoy > 0,
      mood: c.yoy > 3 ? 'bad' : c.yoy < 1 ? 'good' : 'flat',
      daily: false, // 한 달에 한 번 바뀌는 지표
      trend: cpiTrend(c.history),
      spark: c.history?.map((h) => h.v),
      sparkSpan: 1.5, // 물가 상승률 1.5%p 미만 움직임은 완만하게
      sparkLabel: '최근 6개월 상승률',
      text: `작년에 ${won(profile.grocery.monthly)}이던 한 달 장보기가 지금은 평균적으로 약 ${won(now)}이에요.`,
      hint: `[[cpi|소비자물가지수]]는 평균이라, 자주 사는 품목은 더 올랐을 수도 있어요.`,
      terms: ['cpi', 'inflation'],
      note: `${y}년 ${+m}월 통계 기준 · 매달 초 발표`,
    });
  }

  return cards;
}

// 카드 아이콘
export const weatherOf = (card) => WEATHER[card.mood];

// 오늘 내 지갑 날씨: 오늘 움직이는 지표(daily)가 내 지갑에 유리한지·불리한지 개수로
export function summary(cards) {
  const items = cards.filter((c) => c.daily).map((c) => ({ name: c.short, mood: c.mood }));
  const bad = items.filter((x) => x.mood === 'bad').length;
  const good = items.filter((x) => x.mood === 'good').length;
  if (!cards.length) return { weather: 'cloud', title: '관심사를 골라주세요', sub: '', items };
  if (!items.length) return { weather: 'cloud', title: '오늘 바뀐 건 없어요', sub: '매일 바뀌는 지표를 관심사에 추가해보세요', items };
  if (bad > good) return { weather: 'rain', title: '조금 흐려요', sub: '오늘은 지갑에 불리하게 움직인 게 더 많아요', items };
  if (good > bad) return { weather: 'sun', title: '대체로 맑아요', sub: '오늘은 지갑에 유리하게 움직인 게 더 많아요', items };
  if (bad === 0) return { weather: 'cloud', title: '어제와 비슷해요', sub: '크게 움직인 지표가 없어요', items };
  return { weather: 'cloud', title: '맑았다 흐렸다 해요', sub: '유리한 것과 불리한 것이 반반이에요', items };
}
