/**
 * Captura de evidências reais de execução (prints + PDF do comprovante).
 *
 * Uso:  npm run evidencias      (requer: npx playwright install chromium)
 *
 * Gera em docs/evidencias/:
 *   01-painel-cliente-meus-pedidos.png  → listagem de pedidos do cliente autenticado
 *   02-timeline-rastreio-stepper.png    → timeline de rastreio (stepper visual)
 *   03-impressao-comprovante.png        → comprovante em mídia de impressão
 *   04-comprovante-pedido.pdf           → comprovante renderizado para impressão
 *   05-diario-pe-busca.png              → resultados da busca pelo termo "Shakira"
 *   06-diario-pe-materia-busca.png      → matéria localizada pela busca (data + autoria)
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_UI =
  'https://alisonmelo.github.io/tioalison-pe-t4-fap26/projetos-base/01-sistema-login/';
const CREDENCIAIS = {
  email: process.env.LOJAQA_CLIENTE_EMAIL || 'user@system.com',
  senha: process.env.LOJAQA_CLIENTE_PASSWORD || 'UserPassword123',
};
const DIR_EVIDENCIAS = resolve(process.cwd(), 'docs/evidencias');

const moeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

mkdirSync(DIR_EVIDENCIAS, { recursive: true });

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await contexto.newPage();

console.log('[EVIDENCIAS] Autenticando cliente na LojaQA...');
await page.goto(`${BASE_UI}login.html`);
await page.getByRole('textbox', { name: 'E-mail' }).fill(CREDENCIAIS.email);
await page.getByRole('textbox', { name: 'Senha' }).fill(CREDENCIAIS.senha);
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL('**/painel.html');
// Aguarda a renderização da listagem de pedidos (e não apenas do bloco de perfil)
await page.locator('#ordersSection').getByRole('article').first().waitFor();

const secaoPedidos = page.locator('#ordersSection');
await secaoPedidos.scrollIntoViewIfNeeded();
const caixaSecao = await secaoPedidos.boundingBox();
await page.screenshot({
  path: `${DIR_EVIDENCIAS}/01-painel-cliente-meus-pedidos.png`,
  clip: {
    x: caixaSecao.x,
    y: caixaSecao.y,
    width: caixaSecao.width,
    height: Math.min(caixaSecao.height, 760),
  },
});
console.log('  ✓ 01-painel-cliente-meus-pedidos.png');

const totalPedidos = await secaoPedidos.getByRole('article').count();

// Pedido em andamento (primeiro da lista) para evidenciar a timeline
const primeiraLinha = secaoPedidos.getByRole('article').first();
await primeiraLinha.getByRole('button', { name: /Ver Detalhes/i }).click();
const modal = page
  .locator('.modal-backdrop')
  .filter({ has: page.getByRole('heading', { name: /^Pedido PED-\d{5}$/ }) });
await modal.waitFor();
await modal.screenshot({ path: `${DIR_EVIDENCIAS}/02-timeline-rastreio-stepper.png` });
console.log('  ✓ 02-timeline-rastreio-stepper.png');

const titulo = (await modal.getByRole('heading', { level: 2 }).innerText()).trim();
const totalPago = (await modal.locator('#modalOrderTotal').innerText()).trim();

// Impressão: stub de window.print + mídia de impressão para o print/PDF do comprovante
await page.evaluate(() => {
  window.__impressoesDisparadas = 0;
  window.print = () => {
    window.__impressoesDisparadas += 1;
  };
});
await modal.getByRole('button', { name: 'Imprimir Comprovante' }).click();
const disparos = await page.evaluate(() => window.__impressoesDisparadas);

await page.emulateMedia({ media: 'print' });
await modal.screenshot({ path: `${DIR_EVIDENCIAS}/03-impressao-comprovante.png` });
await page.pdf({
  path: `${DIR_EVIDENCIAS}/04-comprovante-pedido.pdf`,
  format: 'A4',
  printBackground: true,
});
await page.emulateMedia({ media: 'screen' });
console.log('  ✓ 03-impressao-comprovante.png');
console.log('  ✓ 04-comprovante-pedido.pdf');

console.log('\n[EVIDENCIAS] Resumo da captura');
console.log(`  • Pedidos listados na UI : ${totalPedidos}`);
console.log(`  • Comprovante capturado  : ${titulo} (total ${totalPago || moeda(0)})`);
console.log(`  • window.print() disparos: ${disparos}`);

// ---------------------------------------------------------------------------
// Cenário externo — Portal Diario de Pernambuco (CT-EXT-E2E-02: busca de conteúdo)
// ---------------------------------------------------------------------------
const URL_DIARIO = 'https://www.diariodepernambuco.com.br/';
const ID_MATERIA_BUSCA = '11729214';

console.log('\n[EVIDENCIAS] Capturando a busca no portal Diario de Pernambuco...');
const contextoDiario = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const paginaDiario = await contextoDiario.newPage();

await paginaDiario.goto(URL_DIARIO, { waitUntil: 'domcontentloaded' });
await paginaDiario.getByRole('heading', { level: 1 }).first().waitFor();

const avisoCookies = paginaDiario.locator('#divCookieConsent');
if (await avisoCookies.isVisible().catch(() => false)) {
  await avisoCookies.getByRole('link', { name: 'Aceitar' }).click({ timeout: 4000 }).catch(() => {});
  await avisoCookies.waitFor({ state: 'hidden', timeout: 4000 }).catch(async () => {
    await avisoCookies.evaluate((elemento) => elemento.remove()).catch(() => {});
  });
}

await paginaDiario.getByRole('button', { name: 'Buscar no Portal' }).click();
await paginaDiario.getByRole('searchbox').fill('Shakira');
await paginaDiario.getByRole('button', { name: 'Pesquisar', exact: true }).first().click();
await paginaDiario.waitForURL('**/capa_busca.html*');

const resultadoAlvo = paginaDiario
  .locator(`a.gs-title[href*="${ID_MATERIA_BUSCA}"]`)
  .filter({ visible: true })
  .first();
await resultadoAlvo.waitFor({ state: 'visible' });
await paginaDiario.screenshot({ path: `${DIR_EVIDENCIAS}/05-diario-pe-busca.png` });
console.log('  ✓ 05-diario-pe-busca.png');

const [abaMateria] = await Promise.all([
  paginaDiario.context().waitForEvent('page'),
  resultadoAlvo.click(),
]);
await abaMateria.waitForLoadState('domcontentloaded');
await abaMateria.locator('.publicacaoNot').first().waitFor();
await abaMateria.screenshot({ path: `${DIR_EVIDENCIAS}/06-diario-pe-materia-busca.png` });
console.log('  ✓ 06-diario-pe-materia-busca.png');

console.log('\n[EVIDENCIAS] Resumo da busca no Diario de Pernambuco');
console.log(`  • URL da busca      : ${paginaDiario.url()}`);
console.log(`  • Matéria localizada: ${(await abaMateria.getByRole('heading', { level: 1 }).first().innerText()).slice(0, 90)}`);
console.log(`  • Publicação        : ${(await abaMateria.locator('.publicacaoNot').first().innerText()).trim()}`);
console.log(`  • Autoria           : ${(await abaMateria.locator('.assinaturaNot').allInnerTexts()).join(' ').trim()}`);

await contextoDiario.close();
await navegador.close();
