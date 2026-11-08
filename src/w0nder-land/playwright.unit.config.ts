import { defineConfig } from '@playwright/test';

/** 서버 없이 도는 단위 테스트(데이터 원천 경계 등). `yarn test:unit` */
export default defineConfig({
  testDir: './tests/unit',
  fullyParallel: true,
  reporter: [['list']],
});
