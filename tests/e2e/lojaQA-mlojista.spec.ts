import { test, expect, CREDENCIAIS_LOJISTA } from '../../fixtures/auth.fixture';

const API_BASE_URL = 'https://api-qa-fap2026.onrender.com/api';

test.describe('Módulo Lojista (E2E UI) — CRUD de Produtos, Área Protegida & Teardown', () => {
  let produtoPendenteTeardown: string | null = null;

  // Rede de segurança: caso uma falha interrompa o teste antes da exclusão na UI,
  // remove o produto temporário via API para não poluir o banco compartilhado da turma.
  test.afterEach(async ({ request }) => {
    if (!produtoPendenteTeardown) return;

    const loginRes = await request.post(`${API_BASE_URL}/login`, {
      data: {
        email: CREDENCIAIS_LOJISTA.email,
        password: CREDENCIAIS_LOJISTA.senha,
      },
    });

    if (loginRes.ok()) {
      const { token } = (await loginRes.json()) as { token: string };
      const listaRes = await request.get(`${API_BASE_URL}/seller/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (listaRes.ok()) {
        const produtos = (await listaRes.json()) as Array<{ _id: string; name: string }>;
        const encontrado = produtos.find((p) => p.name === produtoPendenteTeardown);
        if (encontrado) {
          await request.delete(`${API_BASE_URL}/seller/products/${encontrado._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    }

    produtoPendenteTeardown = null;
  });

  test('CT-E2E-01: Deve iniciar autenticado via fixture na área restrita e realizar logout seguro', async ({
    lojistaPage,
    page,
  }) => {
    // Prova de que o teste já inicia na área protegida sem digitar credenciais no corpo do spec
    await expect(page).toHaveURL(/painel\.html$/);
    await expect(lojistaPage.tituloPagina).toBeVisible();
    await expect(lojistaPage.tituloPagina).toHaveText('Painel do Lojista');
    await expect(lojistaPage.badgePerfil).toHaveText('SELLER');
    await expect(lojistaPage.identificadorUsuario).toContainText('SELLER');
    await expect(lojistaPage.botaoLogout).toBeVisible();

    // Executa ação de logout e valida retorno para estado deslogado na vitrine
    await lojistaPage.logout();

    await expect(page).toHaveURL(/loja\.html$/);
    await expect(lojistaPage.linkEntrarVitrine).toBeVisible();

    const tokenRemanescente = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenRemanescente).toBeNull();
  });

  test('CT-E2E-02: Deve cadastrar produto na loja, editar estoque e excluir na tabela gerencial (CRUD + Teardown)', async ({
    lojistaPage,
  }) => {
    const sufixoUnico = Date.now();
    const nomeProduto = `Webcam QA FullHD ${sufixoUnico}`;
    produtoPendenteTeardown = nomeProduto;

    // 1. CREATE — Cadastro de novo produto pelo formulário do lojista
    await lojistaPage.cadastrarProduto({
      nome: nomeProduto,
      categoria: 'Periféricos',
      preco: '249.90',
      estoque: '10',
      descricao: 'Produto temporário criado pela suíte automatizada E2E Playwright.',
      imagemUrl: 'https://placehold.co/200x200/17221c/ffffff?text=Webcam+QA',
    });

    await expect(
      lojistaPage.obterMensagemFeedback('Produto cadastrado com sucesso!')
    ).toBeVisible();

    // Filtra na tabela gerencial para localizar rapidamente o produto criado
    await lojistaPage.filtrarProdutoNaTabela(nomeProduto);
    const cardProduto = lojistaPage.obterCardProduto(nomeProduto);

    await expect(cardProduto).toBeVisible();
    await expect(cardProduto).toContainText('Em Estoque (10 un)');
    await expect(cardProduto).toContainText('249,90');

    // 2. UPDATE — Edição da quantidade em estoque de 10 para 25 unidades
    await lojistaPage.editarEstoqueProduto(nomeProduto, '25');

    await expect(
      lojistaPage.obterMensagemFeedback('Produto atualizado com sucesso!')
    ).toBeVisible();
    await expect(cardProduto).toContainText('Em Estoque (25 un)');

    // 3. DELETE (Teardown) — Exclusão física na tabela gerencial
    const statusExclusao = await lojistaPage.excluirProdutoNaTabela(nomeProduto);

    expect(statusExclusao).toBe(200);
    await expect(
      lojistaPage.obterMensagemFeedback(/excluído com sucesso/i)
    ).toBeVisible();
    await expect(cardProduto).toHaveCount(0);

    // Como o próprio teste removeu o produto, desativa a limpeza de emergência
    produtoPendenteTeardown = null;
  });

  test('CT-E2E-03: [Negativo] Deve impedir a exclusão na tabela gerencial de produto oficial do Seed (Trava 403)', async ({
    lojistaPage,
  }) => {
    const nomeProdutoSeed = 'Teclado Mecânico Aurora RGB';

    await lojistaPage.filtrarProdutoNaTabela(nomeProdutoSeed);
    const cardSeed = lojistaPage.obterCardProduto(nomeProdutoSeed);
    await expect(cardSeed).toBeVisible();

    // Tenta excluir o item protegido da base oficial da turma
    const statusExclusao = await lojistaPage.excluirProdutoNaTabela(nomeProdutoSeed);

    expect(statusExclusao).toBe(403);
    await expect(
      lojistaPage.obterMensagemFeedback(
        /produtos padrão do catálogo oficial não podem ser excluídos/i
      )
    ).toBeVisible();

    // Garante que o item permanece íntegro na tabela gerencial
    await expect(cardSeed).toBeVisible();
  });
});
