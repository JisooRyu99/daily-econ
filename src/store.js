// 저장소: 시작할 때 필요한 키를 한 번에 읽어 메모리에 두고(load), 읽기는 메모리에서 바로,
// 쓰기는 메모리 + 토스 Storage(비동기)에 같이 한다. 토스 Storage가 비동기라 화면 코드가
// 매번 await하지 않도록 이렇게 둔다.
import { storageGet, storageSet } from './sdk.js';

const cache = new Map();

export const store = {
  async load(keys) {
    await Promise.all(
      keys.map(async (k) => {
        const raw = await storageGet(k);
        if (raw == null) return;
        try {
          cache.set(k, JSON.parse(raw));
        } catch {}
      })
    );
  },
  get(key, fallback) {
    return cache.has(key) ? cache.get(key) : fallback;
  },
  set(key, value) {
    cache.set(key, value);
    storageSet(key, JSON.stringify(value));
  },
};

// 한국 시간 기준 날짜 'YYYY-MM-DD'
export function today() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}
