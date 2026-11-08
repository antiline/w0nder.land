import { defineConfig, devices } from '@playwright/test';

/**
 * 기존 원더랜드 동작의 characterization 테스트(W2, #7).
 *
 * - 기본: `next build` 결과를 운영과 같은 standalone 서버(scripts/start-standalone.sh)로 3100 포트에 띄워 검사한다.
 * - BASE_URL 을 주면 그 서버를 검사한다(예: 운영 읽기 전용 확인). 시각 비교는 로컬에서만 의미가 있다.
 */
const port = 3100;
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' },
  },
  // 스냅샷은 OS 별로 폰트 렌더가 달라 플랫폼 접미사를 붙인다.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
  projects: [
    { name: 'legacy', testMatch: /legacy\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'visual-pc',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'visual-mobile',
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // 운영 Docker 와 같은 standalone 서버로 검사한다(next start 는 output: standalone 과 맞지 않는다).
        command: `PORT=${port} sh scripts/start-standalone.sh`,
        url: `${baseURL}/robots.txt`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
