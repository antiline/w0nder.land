import { defineConfig, devices } from '@playwright/test';

/** 두 프로세스의 런타임 게이트를 같은 production 빌드로 검사한다. 실제 구독 API는 호출하지 않는다. */
export default defineConfig({
  testDir: './tests/hub',
  workers: 2,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'hub-desktop', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3102' } },
    {
      name: 'hub-mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', baseURL: 'http://127.0.0.1:3102' },
    },
  ],
  webServer: [
    { command: 'node tests/support/fake-mocco.mjs', url: 'http://127.0.0.1:3105/ready', timeout: 30_000 },
    {
      command:
        'PORT=3101 POSTS_SOURCE=file POSTS_SHADOW= SITE_PROFILE_SOURCE=file HUB_ENABLED=false HUB_SERIES_ENABLED=false NEWSLETTER_ENABLED=false sh scripts/start-standalone.sh',
      url: 'http://127.0.0.1:3101/robots.txt',
      timeout: 60_000,
    },
    {
      command:
        'PORT=3104 HUB_ENABLED=true HUB_SERIES_ENABLED=true POSTS_SOURCE=mocco POSTS_SHADOW= SITE_PROFILE_SOURCE=file NEWSLETTER_ENABLED=false MOCCO_API_URL=http://127.0.0.1:3105 MOCCO_BLOG_READ_KEY=mk_sec_synthetic node scripts/start-test-isolated.mjs',
      url: 'http://127.0.0.1:3104/robots.txt',
      timeout: 120_000,
    },
    {
      command:
        'PORT=3102 POSTS_SOURCE=file POSTS_SHADOW= SITE_PROFILE_SOURCE=file HUB_ENABLED=true HUB_SERIES_ENABLED=false NEWSLETTER_ENABLED=true MOCCO_API_URL=https://newsletter.example.test/api/ext MOCCO_NEWSLETTER_KEY=mk_pub_synthetic sh scripts/start-standalone.sh',
      url: 'http://127.0.0.1:3102/robots.txt',
      timeout: 60_000,
    },
  ],
});
