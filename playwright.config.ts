import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // Electron 앱 여러 개를 동시에 띄우면 창 포커스를 서로 가로채 입력 테스트(드래그)가 흔들린다
  workers: 1,
  // 잡는 동안 오버레이 창은 입력을 받으므로, 테스트 중 사용자의 실제 마우스 클릭이 잡기를 풀어 드물게 실패한다
  retries: 2
})
