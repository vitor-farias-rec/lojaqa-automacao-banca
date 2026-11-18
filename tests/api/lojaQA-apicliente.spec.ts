import { test, expect } from '@playwright/test';
import {
  API_BASE_URL,
  CREDENCIAIS_CLIENTE,
  decodificarPayloadJwt,
  type PedidoApi,
  type RespostaLoginApi,
} from '../../fixtures/auth.fixture';

interface RespostaErroApi {
  error: string;
}

/** Status previstos no contrato do recurso Order (APILOJAQA.YAML). */
const STATUS_PEDIDO_VALIDOS = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

test.describe('API LojaQA ({ request }) — Painel do Cliente: GET /orders/me', () => {
  let tokenCliente = '';
  let idClienteAutenticado = '';

  // Setup de autenticação: valida o contrato de POST /login antes dos cenários
  test.beforeAll(async ({ request }) => {
    const respostaLogin = await request.post(`${API_BASE_URL}/login`, {
      data: {
        email: CREDENCIAIS_CLIENTE.email,
        password: CREDENCIAIS_CLIENTE.senha,
      },
    });

    expect(respostaLogin.status()).toBe(200);
    expect(respostaLogin.headers()['content-type']).toContain('application/json');

    const corpoLogin = (await respostaLogin.json()) as RespostaLoginApi;
    expect(corpoLogin.message).toBe('Autenticado com sucesso');
    expect(corpoLogin.token).toBeTruthy();
    expect(corpoLogin.user.email).toBe(CREDENCIAIS_CLIENTE.email);
    expect(corpoLogin.user.role).toBe('user');

    tokenCliente = corpoLogin.token;
    idClienteAutenticado = decodificarPayloadJwt(tokenCliente).id;

    console.log('\n[SETUP AUTH] Login de cliente via POST /api/login concluído com sucesso:');
    console.log(`  • Status Code : ${respostaLogin.status()} (OK)`);
    console.log(`  • Header      : content-type = ${respostaLogin.headers()['content-type']}`);
    console.log(`  • Perfil JWT  : ${corpoLogin.user.email} (role: ${corpoLogin.user.role})`);
    console.log(`  • customerId  : ${idClienteAutenticado} (claim "id" do token)`);
  });

  test('CT-API-CL-01: Deve retornar 200 com os pedidos do próprio cliente ao enviar Bearer Token válido', async ({
    request,
  }) => {
    const resposta = await request.get(`${API_BASE_URL}/orders/me`, {
      headers: { Authorization: `Bearer ${tokenCliente}` },
    });

    const contentType = resposta.headers()['content-type'];
    const pedidos = (await resposta.json()) as PedidoApi[];

    console.log('\n[CT-API-CL-01 | GET /orders/me com Bearer Token]');
    console.log(`  • Status Code : ${resposta.status()} (Esperado: 200 OK)`);
    console.log(`  • Header      : content-type = ${contentType}`);
    console.log(`  • Pedidos     : ${Array.isArray(pedidos) ? pedidos.length : 'payload inválido'}`);
    console.log(
      `  • Amostra     : ${JSON.stringify(
        Array.isArray(pedidos) && pedidos[0]
          ? {
              _id: pedidos[0]._id,
              customerId: pedidos[0].customerId,
              total: pedidos[0].total,
              status: pedidos[0].status,
            }
          : {}
      )}`
    );

    // 1. Contrato de transporte
    expect(resposta.status()).toBe(200);
    expect(contentType).toContain('application/json');

    // 2. Contrato de payload: lista não vazia de pedidos
    expect(Array.isArray(pedidos)).toBe(true);
    expect(pedidos.length).toBeGreaterThan(0);

    // 3. Contrato de cada recurso Order, conforme o schema do OpenAPI
    for (const pedido of pedidos) {
      expect(pedido._id).toMatch(/^[a-f0-9]{24}$/);
      expect(STATUS_PEDIDO_VALIDOS).toContain(pedido.status);
      expect(typeof pedido.total).toBe('number');
      expect(pedido.total).toBeGreaterThan(0);
      expect(pedido.shippingAddress).toBeTruthy();
      expect(Number.isNaN(Date.parse(pedido.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(pedido.updatedAt))).toBe(false);

      expect(Array.isArray(pedido.items)).toBe(true);
      expect(pedido.items.length).toBeGreaterThan(0);
      for (const item of pedido.items) {
        expect(typeof item.name).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);
        expect(Number.isInteger(item.quantity)).toBe(true);
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.unitPrice).toBeGreaterThan(0);
      }

      // Consistência financeira: total do pedido = soma dos itens (tolerância de centavos)
      const somaDosItens = pedido.items.reduce(
        (acumulado, item) => acumulado + item.unitPrice * item.quantity,
        0
      );
      expect(Math.abs(somaDosItens - pedido.total)).toBeLessThan(0.01);
    }

    // 4. Isolamento multi-tenancy: nenhum pedido de outro cliente é exposto
    const customerIdsDistintos = [...new Set(pedidos.map((pedido) => pedido.customerId))];
    expect(customerIdsDistintos).toEqual([idClienteAutenticado]);

    // 5. Sem duplicidade no histórico
    const idsDistintos = new Set(pedidos.map((pedido) => pedido._id));
    expect(idsDistintos.size).toBe(pedidos.length);

    // 6. Ordenação contratual: pedidos mais recentes primeiro
    const datasDeCriacao = pedidos.map((pedido) => new Date(pedido.createdAt).getTime());
    expect(datasDeCriacao).toEqual([...datasDeCriacao].sort((a, b) => b - a));
  });

  test('CT-API-CL-02: [Negativo 403 Forbidden] Deve recusar GET /orders/me sem o header Authorization e não vazar dados', async ({
    request,
  }) => {
    const resposta = await request.get(`${API_BASE_URL}/orders/me`);

    const contentType = resposta.headers()['content-type'];
    const textoResposta = await resposta.text();
    const corpoErro = JSON.parse(textoResposta) as RespostaErroApi;

    console.log('\n[CT-API-CL-02 | CENÁRIO NEGATIVO 403 - GET /orders/me SEM TOKEN]');
    console.log(`  • Status Code : ${resposta.status()} (Esperado: 403 Forbidden)`);
    console.log(`  • Header      : content-type = ${contentType}`);
    console.log(`  • Response    : ${textoResposta}`);

    expect(resposta.status()).toBe(403);
    expect(contentType).toContain('application/json');

    // Mensagem controlada definida no contrato (ForbiddenTokenError)
    expect(corpoErro.error).toBe('Token não fornecido.');

    // Segurança: a resposta de erro não pode conter dados de pedidos/clientes
    expect(textoResposta).not.toContain('customerId');
    expect(textoResposta).not.toContain('items');
    expect(textoResposta).not.toContain('shippingAddress');
  });
});
