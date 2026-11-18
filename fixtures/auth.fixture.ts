import { test as base, expect } from '@playwright/test';
import { ClientePage } from '../pages/ClientePage';

/**
 * Endereço base da API REST da LojaQA (sobrescrevível para o ambiente local).
 */
export const API_BASE_URL =
  process.env.LOJAQA_API_URL || 'https://api-qa-fap2026.onrender.com/api';

/**
 * Massa de dados oficial do Cliente (perfil `user`) disponibilizada na tela de login.
 * Credenciais podem ser sobrescritas por variáveis de ambiente (CI/CD).
 */
export const CREDENCIAIS_CLIENTE = {
  email: process.env.LOJAQA_CLIENTE_EMAIL || 'user@system.com',
  senha: process.env.LOJAQA_CLIENTE_PASSWORD || 'UserPassword123',
};

/** Contrato de um item de pedido devolvido por GET /orders/me. */
export interface ItemPedidoApi {
  _id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  sellerId: string;
}

/** Contrato do recurso Order documentado no OpenAPI (APILOJAQA.YAML). */
export interface PedidoApi {
  _id: string;
  customerId: string;
  items: ItemPedidoApi[];
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | string;
  shippingAddress: string;
  createdAt: string;
  updatedAt: string;
}

/** Contrato da resposta 200 de POST /login. */
export interface RespostaLoginApi {
  message: string;
  token: string;
  user: {
    email: string;
    name: string;
    role: string;
  };
}

/**
 * Decodifica o payload de um JWT (sem validar assinatura) para conferir
 * a identidade do titular do token nas asserções de isolamento multi-tenancy.
 */
export function decodificarPayloadJwt(token: string): { id: string; role: string; email: string } {
  const partes = token.split('.');
  if (partes.length !== 3) {
    throw new Error('[FIXTURE] Token JWT malformado: esperado o formato header.payload.signature.');
  }
  const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf-8')) as {
    id: string;
    role: string;
    email: string;
  };
  return payload;
}

type FixturesCliente = {
  /** Page Object do Painel do Cliente já autenticado e com a listagem renderizada. */
  clientePage: ClientePage;
  /** Bearer Token JWT de um cliente válido, obtido via POST /login. */
  tokenCliente: string;
  /** Massa de pedidos do cliente autenticado, obtida via GET /orders/me (fonte da verdade). */
  pedidosDoCliente: PedidoApi[];
};

/**
 * Fixtures Autenticadas — Painel do Cliente (LojaQA)
 *
 * Encapsula todo o setup exigido pelos testes do módulo "Pedidos & Rastreio":
 *
 * `clientePage`
 *   1. Navega para a tela de login (login.html)
 *   2. Preenche credenciais válidas de cliente (perfil `user`)
 *   3. Submete o formulário e aguarda a URL restrita (painel.html)
 *   4. Aguarda a resposta de GET /orders/me e a renderização da listagem
 *   5. Entrega a página pronta via `await use(clientePage)`
 *
 * `tokenCliente` / `pedidosDoCliente`
 *   1. Autenticam via POST /api/login usando o fixture `request` do Playwright
 *   2. Consultam GET /api/orders/me com Bearer Token
 *   3. Disponibilizam a mesma massa que a UI exibe, permitindo cruzar
 *      Interface x API nos testes E2E (sem massa fixa "chumbada" no spec)
 *
 * Nenhuma asserção de negócio reside aqui: o setup apenas falha rápido
 * (throw) quando um pré-requisito do ambiente não é atendido.
 */
export const test = base.extend<FixturesCliente>({
  clientePage: async ({ page }, use) => {
    const clientePage = new ClientePage(page);

    await clientePage.irParaLogin();
    await clientePage.autenticarComoCliente(
      CREDENCIAIS_CLIENTE.email,
      CREDENCIAIS_CLIENTE.senha
    );

    await use(clientePage);
  },

  tokenCliente: async ({ request }, use) => {
    const resposta = await request.post(`${API_BASE_URL}/login`, {
      data: {
        email: CREDENCIAIS_CLIENTE.email,
        password: CREDENCIAIS_CLIENTE.senha,
      },
    });

    if (!resposta.ok()) {
      throw new Error(
        `[FIXTURE] Falha no setup de autenticação (POST /login): HTTP ${resposta.status()} — ${await resposta.text()}`
      );
    }

    const corpo = (await resposta.json()) as RespostaLoginApi;
    if (!corpo.token) {
      throw new Error('[FIXTURE] POST /login respondeu 200 sem o campo `token`.');
    }

    await use(corpo.token);
  },

  pedidosDoCliente: async ({ request, tokenCliente }, use) => {
    const resposta = await request.get(`${API_BASE_URL}/orders/me`, {
      headers: { Authorization: `Bearer ${tokenCliente}` },
    });

    if (!resposta.ok()) {
      throw new Error(
        `[FIXTURE] Falha ao obter a massa de pedidos (GET /orders/me): HTTP ${resposta.status()} — ${await resposta.text()}`
      );
    }

    const pedidos = (await resposta.json()) as PedidoApi[];
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      throw new Error(
        `[FIXTURE] A conta cliente "${CREDENCIAIS_CLIENTE.email}" não possui pedidos para os cenários de listagem/rastreio. ` +
          'Realize um checkout na vitrine para gerar a massa de dados antes de executar a suíte.'
      );
    }

    await use(pedidos);
  },
});

export { expect };
