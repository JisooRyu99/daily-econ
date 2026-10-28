import { defineConfig } from "@apps-in-toss/web-framework/config";

// 앱인토스 미니앱 설정 — "하루 경제" (SDK 3.x)
//  - appName: 콘솔에 등록할 고유 이름과 반드시 같아야 함 (등록 후 수정 불가).
//  - 앱 이름(표시명 "하루 경제")·로고는 콘솔 앱 정보에서 관리 → 코드에 없음(정상).
// 게임 아님(학습 콘텐츠, 퀴즈에 점수 경쟁·보상 없음) → 등급분류 불필요.
export default defineConfig({
  appName: "daily-econ",

  brand: {
    primaryColor: "#3182f6",
  },

  // 위치·카메라 등 권한 안 씀
  permissions: [],

  webBundleDir: "dist",
});
