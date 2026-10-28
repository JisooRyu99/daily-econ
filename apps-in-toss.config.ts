import { defineConfig } from "@apps-in-toss/web-framework/config";

// 앱인토스 미니앱 설정 — "경제예보" (SDK 3.x, 처음 이름 "하루 경제"는 같은 이름 앱이 많아 변경)
//  - appName: 콘솔에 등록한 고유 이름과 반드시 같아야 함 (등록 후 수정 불가). daily-econ은 이미 사용 중이라 haru-econ.
//  - 앱 이름(표시명 "경제예보")·로고는 콘솔 앱 정보에서 관리 → 코드에 없음(정상).
// 게임 아님(학습 콘텐츠, 퀴즈에 점수 경쟁·보상 없음) → 등급분류 불필요.
export default defineConfig({
  appName: "haru-econ",

  brand: {
    primaryColor: "#3182f6",
  },

  // 위치·카메라 등 권한 안 씀
  permissions: [],

  webBundleDir: "dist",
});
