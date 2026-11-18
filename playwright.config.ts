import { defineConfig, devices } from '@playwright/test';

/**
 * Câmera lenta para demonstração.
 *
 * SLOW_MO=<ms> atrasa CADA ação do navegador (clique, digitação, navegação),
 * tornando a automação visível a olho nu. Sem a variável, o valor é 0 e a suíte
 * roda na velocidade normal — nenhum teste depende desse atraso.
 *
 *   npm run test:lento        # E2E do Painel do Cliente, devagar e com navegador visível
 *   SLOW_MO=1200 npm test     # qualquer suíte, com 1,2s entre ações
 */
const SLOW_MO = Number(process.env.SLOW_MO ?? 0);
const LENTO = SLOW_MO > 0;

export default defineConfig({
  testDir: './tests',
  // Com câmera lenta a execução fica mais longa de propósito: folga nos timeouts.
  timeout: LENTO ? 240_000 : 90_000,
  expect: {
    timeout: LENTO ? 30_000 : 20_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'https://alisonmelo.github.io/tioalison-pe-t4-fap26/projetos-base/01-sistema-login/',
    testIdAttribute: 'data-test',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    launchOptions: LENTO ? { slowMo: SLOW_MO } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
