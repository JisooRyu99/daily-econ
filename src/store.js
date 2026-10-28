// 저장소. 앱인토스 출시 땐 SDK Storage로 교체 (지금은 localStorage, 막혀 있어도 동작).
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

// 한국 시간 기준 날짜 'YYYY-MM-DD'
export function today() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}
