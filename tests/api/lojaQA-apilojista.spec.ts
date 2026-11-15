import { test, expect } from '@playwright/test';
import { CREDENCIAIS_LOJISTA } from '../../fixtures/auth.fixture';

const API_BASE_URL = 'https://api-qa-fap2026.onrender.com/api';

interface RespostaLogin {
  message: string;
  token: string;
  user: {
    email: string;
    name: string;
    role: string;
  };
}

interface ProdutoApi {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
}

interface RespostaCriacaoProduto {
  message: string;
  product: ProdutoApi;
}

interface RespostaExclusaoProduto {
  message: string;
  id: string;
}

interface RespostaErroApi {
  error: string;
}

test.describe('API LojaQA ({ request }) — Módulo Lojista: CRUD, Padrão Teardown e Travas', () => {
  let tokenLojista = '';

  test.beforeAll(async ({ request }) => {
    const respostaLogin = await request.post(`${API_BASE_URL}/login`, {
      data: {
        email: CREDENCIAIS_LOJISTA.email,
        password: CREDENCIAIS_LOJISTA.senha,
      },
    });

    expect(respostaLogin.status()).toBe(200);
    expect(respostaLogin.headers()['content-type']).toContain('application/json');

    const corpoLogin = (await respostaLogin.json()) as RespostaLogin;
    expect(corpoLogin.token).toBeTruthy();
    expect(corpoLogin.user.role).toBe('seller');

    tokenLojista = corpoLogin.token;

    console.log('\n[SETUP AUTH] Login via POST /api/login concluído com sucesso:');
    console.log(`  • Status Code : ${respostaLogin.status()} (OK)`);
    console.log(`  • Header      : content-type = ${respostaLogin.headers()['content-type']}`);
    console.log(`  • Perfil JWT  : ${corpoLogin.user.email} (role: ${corpoLogin.user.role})`);
  });

  test('CT-API-01: Padrão Teardown Completo — POST cria produto, GET valida persistência e DELETE remove fisicamente', async ({
    request,
  }) => {
    const payloadNovoProduto = {
      name: `Headset Studio QA API ${Date.now()}`,
      description: 'Criado via fixture { request } do Playwright para validar padrão Teardown.',
      category: 'Áudio',
      price: 349.9,
      stock: 15,
      image: 'https://placehold.co/300x300/17221c/ffffff?text=Headset+QA',
    };

    let idProdutoCriado = '';

    try {
      // 1. POST /seller/products — Criação da massa isolada do teste
      const resPost = await request.post(`${API_BASE_URL}/seller/products`, {
        headers: { Authorization: `Bearer ${tokenLojista}` },
        data: payloadNovoProduto,
      });

      const contentTypePost = resPost.headers()['content-type'];
      const jsonPost = (await resPost.json()) as RespostaCriacaoProduto;

      console.log('\n[CT-API-01 | ETAPA 1 - POST /seller/products]');
      console.log(`  • Status Code : ${resPost.status()} (Esperado: 201 Created)`);
      console.log(`  • Header      : content-type = ${contentTypePost}`);
      console.log(`  • Response    : ${JSON.stringify({ message: jsonPost.message, _id: jsonPost.product?._id, name: jsonPost.product?.name, stock: jsonPost.product?.stock })}`);

      expect(resPost.status()).toBe(201);
      expect(contentTypePost).toContain('application/json');
      expect(jsonPost.message).toBe('Produto criado com sucesso.');
      expect(jsonPost.product._id).toBeTruthy();
      expect(jsonPost.product.name).toBe(payloadNovoProduto.name);
      expect(jsonPost.product.price).toBe(payloadNovoProduto.price);
      expect(jsonPost.product.stock).toBe(payloadNovoProduto.stock);

      idProdutoCriado = jsonPost.product._id;

      // 2. GET /seller/products — Validação de leitura no catálogo do lojista
      const resGet = await request.get(`${API_BASE_URL}/seller/products`, {
        headers: { Authorization: `Bearer ${tokenLojista}` },
      });

      const contentTypeGet = resGet.headers()['content-type'];
      const listaProdutos = (await resGet.json()) as ProdutoApi[];
      const produtoPersistido = listaProdutos.find((p) => p._id === idProdutoCriado);

      console.log('[CT-API-01 | ETAPA 2 - GET /seller/products]');
      console.log(`  • Status Code : ${resGet.status()} (Esperado: 200 OK)`);
      console.log(`  • Header      : content-type = ${contentTypeGet}`);
      console.log(`  • Encontrado  : ${Boolean(produtoPersistido)} (ID ${idProdutoCriado}, estoque: ${produtoPersistido?.stock})`);

      expect(resGet.status()).toBe(200);
      expect(contentTypeGet).toContain('application/json');
      expect(produtoPersistido).toBeDefined();
      expect(produtoPersistido?.name).toBe(payloadNovoProduto.name);
      expect(produtoPersistido?.stock).toBe(payloadNovoProduto.stock);
    } finally {
      // 3. DELETE /seller/products/:id — Teardown garantido no bloco finally
      if (idProdutoCriado) {
        const resDelete = await request.delete(
          `${API_BASE_URL}/seller/products/${idProdutoCriado}`,
          {
            headers: { Authorization: `Bearer ${tokenLojista}` },
          }
        );

        const contentTypeDelete = resDelete.headers()['content-type'];
        const jsonDelete = (await resDelete.json()) as RespostaExclusaoProduto;

        console.log('[CT-API-01 | ETAPA 3 - DELETE /seller/products/:id (TEARDOWN)]');
        console.log(`  • Status Code : ${resDelete.status()} (Esperado: 200 OK)`);
        console.log(`  • Header      : content-type = ${contentTypeDelete}`);
        console.log(`  • Response    : ${JSON.stringify(jsonDelete)}`);

        expect(resDelete.status()).toBe(200);
        expect(contentTypeDelete).toContain('application/json');
        expect(jsonDelete.message).toBe('Produto excluído com sucesso.');
        expect(jsonDelete.id).toBe(idProdutoCriado);

        // Confirmação pós-teardown: item não consta mais na listagem do lojista
        const resConfirmacao = await request.get(`${API_BASE_URL}/seller/products`, {
          headers: { Authorization: `Bearer ${tokenLojista}` },
        });
        const listaAposDelete = (await resConfirmacao.json()) as ProdutoApi[];
        expect(listaAposDelete.some((p) => p._id === idProdutoCriado)).toBe(false);
      }
    }
  });

  test('CT-API-02: [Trava 403 Forbidden] Deve bloquear exclusão física de produto padrão do Seed oficial', async ({
    request,
  }) => {
    const resLista = await request.get(`${API_BASE_URL}/seller/products`, {
      headers: { Authorization: `Bearer ${tokenLojista}` },
    });
    expect(resLista.status()).toBe(200);

    const produtos = (await resLista.json()) as ProdutoApi[];
    const produtoSeed = produtos.find((p) => p.name.includes('Teclado Mecânico Aurora'));
    expect(produtoSeed).toBeDefined();

    const resDeleteSeed = await request.delete(
      `${API_BASE_URL}/seller/products/${produtoSeed!._id}`,
      {
        headers: { Authorization: `Bearer ${tokenLojista}` },
      }
    );

    const contentType = resDeleteSeed.headers()['content-type'];
    const corpoErro = (await resDeleteSeed.json()) as RespostaErroApi;

    console.log('\n[CT-API-02 | TRAVA ANTI-CAOS 403 - DELETE /seller/products/:seedId]');
    console.log(`  • Produto Alvo: ${produtoSeed!.name} (${produtoSeed!._id})`);
    console.log(`  • Status Code : ${resDeleteSeed.status()} (Esperado: 403 Forbidden)`);
    console.log(`  • Header      : content-type = ${contentType}`);
    console.log(`  • Response    : ${JSON.stringify(corpoErro)}`);

    expect(resDeleteSeed.status()).toBe(403);
    expect(contentType).toContain('application/json');
    expect(corpoErro.error).toContain('produtos padrão do catálogo oficial não podem ser excluídos');
  });

  test('CT-API-03: [Negativo 400 Bad Request] Deve rejeitar criação de produto com payload inválido (preço negativo)', async ({
    request,
  }) => {
    const payloadInvalido = {
      name: 'Produto Preço Negativo QA',
      category: 'Áudio',
      price: -10,
      stock: 5,
    };

    const resPostInvalido = await request.post(`${API_BASE_URL}/seller/products`, {
      headers: { Authorization: `Bearer ${tokenLojista}` },
      data: payloadInvalido,
    });

    const contentType = resPostInvalido.headers()['content-type'];
    const corpoErro = (await resPostInvalido.json()) as RespostaErroApi;

    console.log('\n[CT-API-03 | CENÁRIO NEGATIVO 400 - POST /seller/products com preço -10]');
    console.log(`  • Status Code : ${resPostInvalido.status()} (Esperado: 400 Bad Request)`);
    console.log(`  • Header      : content-type = ${contentType}`);
    console.log(`  • Response    : ${JSON.stringify(corpoErro)}`);

    expect(resPostInvalido.status()).toBe(400);
    expect(contentType).toContain('application/json');
    expect(corpoErro.error).toContain('preço e estoque válidos são obrigatórios');
  });

  test('CT-API-04: [Negativo 400 Bad Request] Deve rejeitar exclusão com ObjectId malformado na rota', async ({
    request,
  }) => {
    const resDeleteInvalido = await request.delete(
      `${API_BASE_URL}/seller/products/id_invalido_123`,
      {
        headers: { Authorization: `Bearer ${tokenLojista}` },
      }
    );

    const contentType = resDeleteInvalido.headers()['content-type'];
    const corpoErro = (await resDeleteInvalido.json()) as RespostaErroApi;

    console.log('\n[CT-API-04 | CENÁRIO NEGATIVO 400 - DELETE /seller/products/id_invalido_123]');
    console.log(`  • Status Code : ${resDeleteInvalido.status()} (Esperado: 400 Bad Request)`);
    console.log(`  • Header      : content-type = ${contentType}`);
    console.log(`  • Response    : ${JSON.stringify(corpoErro)}`);

    expect(resDeleteInvalido.status()).toBe(400);
    expect(contentType).toContain('application/json');
    expect(corpoErro.error).toBe('ID de produto inválido.');
  });
});
