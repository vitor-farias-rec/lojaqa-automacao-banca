import { test, expect } from '@playwright/test';
import { SauceDemoPage } from '../../pages/SauceDemoPage';

test.describe('UI Externa (E2E) — Fluxo Completo de Compra no SauceDemo', () => {
  test('CT-EXT-E2E-01: Deve autenticar, adicionar produto ao carrinho e finalizar compra com sucesso', async ({
    page,
  }) => {
    const saucePage = new SauceDemoPage(page);

    await saucePage.acessarSite();
    await saucePage.realizarLogin('standard_user', 'secret_sauce');
    await expect(page).toHaveURL(/inventory\.html$/);

    await saucePage.adicionarMochilaEAbrirCarrinho();
    await expect(page).toHaveURL(/cart\.html$/);
    await expect(page.getByText('Sauce Labs Backpack')).toBeVisible();

    await saucePage.concluirCheckout({
      nome: 'Estudante',
      sobrenome: 'QA Aplicado',
      cep: '55600-000',
    });

    await expect(page).toHaveURL(/checkout-complete\.html$/);
    await expect(saucePage.tituloPedidoConcluido).toBeVisible();
    await expect(saucePage.tituloPedidoConcluido).toHaveText('Thank you for your order!');
  });
});
