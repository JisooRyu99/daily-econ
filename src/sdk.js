// 앱인토스 SDK 래퍼. 토스 웹뷰 안에서는 실제 SDK, 브라우저(개발 중)에서는 폴백.
import * as Toss from '@apps-in-toss/web-framework';

// 토스 웹뷰 안인지 판정.
// ⚠️ `typeof Toss.Storage.getItem === 'function'`으로 판정하면 안 된다 — 브라우저에서도 항상 true
// (호출할 때만 던짐). RN 웹뷰 브리지 객체가 있는지로 본다. (summer-map-toss에서 겪은 함정)
export const inToss =
  typeof window !== 'undefined' &&
  (typeof window.ReactNativeWebView?.postMessage === 'function' || typeof window.__GRANITE__ !== 'undefined');

// ---------- 저장소 (토스 Storage는 문자열만, 비동기) ----------

export async function storageGet(key) {
  try {
    if (inToss) return await Toss.Storage.getItem(key);
  } catch (e) {
    console.warn('Storage.getItem 실패, localStorage 폴백', e);
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function storageSet(key, value) {
  try {
    if (inToss) return await Toss.Storage.setItem(key, value);
  } catch (e) {
    console.warn('Storage.setItem 실패, localStorage 폴백', e);
  }
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// ---------- 안전 영역 ----------
// 토스 웹뷰에서는 CSS env(safe-area-inset-*)가 제대로 안 들어올 수 있어서(실기기에서 하단 내용이
// 떠 있는 탭바에 가려졌음) SDK 값을 CSS 변수(--sb)로 넣는다. 위쪽은 토스 상단바가 있어 건드리지 않는다.
export function applySafeArea() {
  if (!inToss) return;
  const set = (ins) => {
    if (ins && Number.isFinite(ins.bottom)) document.documentElement.style.setProperty('--sb', `${ins.bottom}px`);
  };
  try {
    const api = Toss.SafeArea || Toss.SafeAreaInsets;
    set(api.get());
    api.subscribe({ onEvent: set });
  } catch (e) {
    try {
      set(Toss.getSafeAreaInsets());
    } catch {}
    console.warn('SafeArea 실패', e);
  }
}

// ---------- 안드로이드 뒤로가기 ----------
// 구독하는 동안만 우리가 처리하고, 해제하면 프레임워크 기본 동작(최초 화면에서 앱 종료)으로 돌아간다.
// 그래서 "닫을 게 있을 때만" 구독한다. 반환값은 구독 해제 함수.
export function onBackPress(handler) {
  try {
    if (inToss && typeof Toss.graniteEvent?.addEventListener === 'function') {
      return Toss.graniteEvent.addEventListener('backEvent', { onEvent: handler });
    }
  } catch (e) {
    console.warn('백버튼 구독 실패', e);
  }
  return () => {};
}

// ---------- 이용 지표 ----------
// 추천 미니앱 선정에 재방문·전환 지표가 쓰인다. 미지원 버전에선 조용히 무시됨(토스 5.208.0+).
export function logEvent(name, params = {}) {
  try {
    if (inToss) Toss.Analytics.log({ log_name: name, log_type: 'event', params });
    else if (import.meta.env.DEV) console.debug('[event]', name, params);
  } catch {}
}

export function logScreen(name) {
  try {
    if (inToss) Toss.Analytics.screen({ log_name: name });
  } catch {}
}
