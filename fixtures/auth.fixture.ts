import { test as base, expect } from '@playwright/test';
import { LojistaPage } from '../pages/LojistaPage';

export const CREDENCIAIS_LOJISTA = {
  email: process.env.LOJAQA_SELLER_EMAIL || 'lojista@system.com',
  senha: process.env.LOJAQA_SELLER_PASSWORD || 'SellerPass123',
};

type LojistaFixtures = {
  lojistaPage: LojistaPage;
};

/**
 * Fixture Autenticada — Painel do Lojista (LojaQA)
 *
 * Encapsula todo o setup de autenticação exigido:
 * 1. Navegação para a tela de login (login.html)
 * 2. Preenchimento de credenciais válidas de lojista
 * 3. Submissão do formulário
 * 4. Espera ativa da URL restrita (painel.html) e carregamento dos elementos protegidos
 * 5. Disponibilização da página pronta para o spec via await use(lojistaPage)
 */
export const test = base.extend<LojistaFixtures>({
  lojistaPage: async ({ page }, use) => {
    const lojistaPage = new LojistaPage(page);

    await lojistaPage.irParaLogin();
    await lojistaPage.autenticarComoLojista(
      CREDENCIAIS_LOJISTA.email,
      CREDENCIAIS_LOJISTA.senha
    );

    await use(lojistaPage);
  },
});

export { expect };
