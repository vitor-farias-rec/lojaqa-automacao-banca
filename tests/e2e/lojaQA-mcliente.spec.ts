import {
  test,
  expect,
  CREDENCIAIS_CLIENTE,
  type PedidoApi,
} from '../../fixtures/auth.fixture';

/**
 * Módulo Painel do Cliente: Pedidos & Rastreio (E2E UI)
 *
 * Estratégia de massa de dados:
 * Os cenários são READ-ONLY e idempotentes — não criam pedidos (POST /orders
 * decrementa estoque real e a API não expõe rota de exclusão de pedidos, o que
 * poluiria permanentemente o banco compartilhado da turma). A massa utilizada é
 * o histórico real do próprio cliente, lido via GET /orders/me pelo fixture
 * `pedidosDoCliente`, que atua como fonte da verdade para as asserções da UI
 * (evitando valores "chumbados" no spec).
 */

/** Rótulos oficiais da timeline de rastreio, na ordem exibida pelo stepper. */
const PASSOS_RASTREIO = [
  '1. Pedido Criado',
  '2. Pagamento Aprovado',
  '3. Em Preparação',
  '4. A Caminho',
  '5. Entregue',
] as const;

/** Formata valores em Real no mesmo padrão pt-BR utilizado pela aplicação. */
function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(valor)
    .replace(/\u00a0/g, ' ');
}

/**
 * Deriva a expectativa VISUAL (correta) do stepper a partir do status da API.
 *
 * Regra de negócio esperada:
 * - pending/paid ......... passos 1 e 2 concluídos, passo 3 ativo (Em Preparação)
 * - shipped/enviado ...... passos 1 a 3 concluídos, passo 4 ativo (A Caminho)
 * - delivered/entregue ... passos 1 a 5 concluídos, passo 5 ativo (Entregue)
 */
function expectativaDoRastreio(statusApi: string): {
  indiceUltimoConcluido: number;
  indiceAtivo: number;
} {
  const status = statusApi.toLowerCase();
  const entregue = status === 'delivered';
  const enviado = status === 'shipped' || entregue;
  const indiceAtivo = entregue ? 4 : enviado ? 3 : 2;

  return {
    indiceAtivo,
    indiceUltimoConcluido: entregue ? 4 : indiceAtivo - 1,
  };
}

/** Localiza na massa da API o primeiro pedido que atende ao filtro de status. */
function primeiroPedidoComStatus(
  pedidos: PedidoApi[],
  statuses: string[]
): PedidoApi | undefined {
  return pedidos.find((pedido) => statuses.includes(pedido.status.toLowerCase()));
}

test.describe('Painel do Cliente (E2E UI) — Pedidos, Rastreio & Comprovante', () => {
  test('CT-E2E-CL-01: Deve listar os pedidos do cliente autenticado com ID visual, status e total sincronizados com a API', async ({
    clientePage,
    page,
    pedidosDoCliente,
  }) => {
    // 1. Área protegida — prova de que o teste inicia autenticado via fixture
    await expect(page).toHaveURL(/painel\.html$/);
    await expect(clientePage.tituloPainel).toBeVisible();
    await expect(clientePage.tituloPainel).toHaveText('Minha Conta');
    await expect(clientePage.badgePerfil).toHaveText('USER');
    await expect(clientePage.identificadorUsuario).toContainText('USER');
    await expect(clientePage.linkMenuMeusPedidos).toBeVisible();

    // 2. Navegação até o módulo de pedidos
    await clientePage.acessarModuloPedidos();
    await expect(clientePage.tituloMeusPedidos).toBeVisible();
    await expect(clientePage.estadoVazioPedidos).toHaveCount(0);

    const totalLinhas = await clientePage.listaPedidos.count();
    expect(totalLinhas).toBeGreaterThan(0);

    console.log('\n[CT-E2E-CL-01 | LISTAGEM DE PEDIDOS]');
    console.log(`  • Cliente autenticado : ${CREDENCIAIS_CLIENTE.email} (role: USER)`);
    console.log(`  • Pedidos na API      : ${pedidosDoCliente.length}`);
    console.log(`  • Pedidos na UI       : ${totalLinhas}`);

    // 3. Contrato visual de cada pedido conferido contra a API (amostra dos 3 mais recentes)
    for (const pedido of pedidosDoCliente.slice(0, 3)) {
      const linha = clientePage.obterLinhaPedidoPorIdApi(pedido._id);

      await expect(linha, `Pedido ${pedido._id} deve constar na listagem`).toBeVisible();
      // Identificador amigável no padrão PED-00000 e ObjectId cru preservado
      await expect(clientePage.obterIdVisualPedido(linha)).toHaveText(/^PED-\d{5}$/);
      await expect(linha).toContainText(pedido._id);
      // Status e valor espelham exatamente o retorno de GET /orders/me
      await expect(clientePage.obterStatusPedidoNaLinha(linha)).toHaveText(
        pedido.status.toUpperCase()
      );
      await expect(linha).toContainText(formatarMoeda(pedido.total));
      // Ação de detalhamento disponível para o pedido
      await expect(clientePage.obterBotaoVerDetalhes(linha)).toBeEnabled();

      console.log(
        `  • ${pedido._id} → status ${pedido.status.toUpperCase()} · total ${formatarMoeda(pedido.total)} · ${pedido.items.length} item(ns)`
      );
    }

    // 4. Ordenação: o contrato garante os mais recentes primeiro, logo a primeira
    //    linha deve ser o pedido com maior createdAt do histórico do cliente.
    const pedidoMaisRecente = pedidosDoCliente.reduce((maisRecente, atual) =>
      new Date(atual.createdAt) > new Date(maisRecente.createdAt) ? atual : maisRecente
    );
    await expect(clientePage.obterLinhaPedidoPorPosicao(0)).toContainText(pedidoMaisRecente._id);
  });

  test('CT-E2E-CL-02: Deve exibir a timeline de rastreio (stepper visual) coerente com o status do pedido em andamento', async ({
    clientePage,
    pedidosDoCliente,
  }) => {
    // Massa dinâmica: primeiro pedido em andamento (pending/paid) do histórico
    const pedido = primeiroPedidoComStatus(pedidosDoCliente, ['pending', 'paid']);
    test.skip(!pedido, 'Massa sem pedido em andamento (pending/paid) para validar a timeline.');

    const { indiceAtivo, indiceUltimoConcluido } = expectativaDoRastreio(pedido!.status);

    // 1. Abre o modal de detalhes a partir da listagem
    await clientePage.abrirDetalhesDoPedido(pedido!._id);

    await expect(clientePage.modalDetalhesPedido).toBeVisible();
    await expect(clientePage.tituloPedidoModal).toHaveText(/^Pedido PED-\d{5}$/);

    // 2. Cabeçalho do rastreio espelha o pedido selecionado (UI x API)
    await expect(clientePage.idApiPedidoModal).toHaveText(pedido!._id);
    await expect(clientePage.dataPedidoModal).toHaveText(/^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/);
    await expect(clientePage.badgeStatusModal).toHaveText(pedido!.status.toUpperCase());
    await expect(clientePage.previsaoEntregaModal).toHaveText(/^\d{2}\/\d{2} e \d{2}\/\d{2}$/);
    await expect(clientePage.modalidadeFreteModal).toContainText('Modalidade:');
    await expect(clientePage.formaPagamentoModal).not.toBeEmpty();
    await expect(clientePage.enderecoEntregaModal).toHaveText(pedido!.shippingAddress);

    // 3. Estrutura do stepper: 5 passos com os rótulos oficiais, na ordem correta
    await expect(clientePage.passosRastreio).toHaveCount(PASSOS_RASTREIO.length);
    for (let indice = 0; indice < PASSOS_RASTREIO.length; indice += 1) {
      await expect(clientePage.passosRastreio.nth(indice)).toContainText(
        PASSOS_RASTREIO[indice]
      );
    }

    // 4. Estado visual de cada passo (is-done / is-active) conferido contra a regra do status
    const estados: string[] = [];
    for (let indice = 0; indice < PASSOS_RASTREIO.length; indice += 1) {
      const passo = clientePage.passosRastreio.nth(indice);

      // O marcador (bolinha) precisa estar renderizado e visível em cada etapa
      await expect(clientePage.obterMarcadorDoPasso(passo)).toBeVisible();

      if (indice <= indiceUltimoConcluido) {
        await expect(passo).toHaveClass(/is-done/);
      } else {
        await expect(passo).not.toHaveClass(/is-done/);
      }

      if (indice === indiceAtivo) {
        await expect(passo).toHaveClass(/is-active/);
      } else {
        await expect(passo).not.toHaveClass(/is-active/);
      }

      estados.push(
        `${PASSOS_RASTREIO[indice]} [${
          indice <= indiceUltimoConcluido ? 'concluído' : 'pendente'
        }${indice === indiceAtivo ? '/ativo' : ''}]`
      );
    }

    // 5. Invariante visual: existe exatamente uma etapa ativa no stepper
    await expect(clientePage.stepperRastreio.locator('.step.is-active')).toHaveCount(1);

    // 6. Itens do pedido e resumo financeiro refletem o registro da API
    for (const item of pedido!.items) {
      await expect(clientePage.itensPedidoModal).toContainText(item.name);
    }
    await expect(clientePage.subtotalModal).not.toBeEmpty();
    await expect(clientePage.freteModal).not.toBeEmpty();
    await expect(clientePage.totalPagoModal).toHaveText(formatarMoeda(pedido!.total));

    console.log(`\n[CT-E2E-CL-02 | TIMELINE DE RASTREIO] Pedido ${pedido!._id}`);
    console.log(`  • Status API/UI       : ${pedido!.status.toUpperCase()}`);
    console.log(`  • Etapa ativa         : ${PASSOS_RASTREIO[indiceAtivo]}`);
    console.log(`  • Timeline            : ${estados.join(' → ')}`);

    // 7. O modal fecha sem deixar a timeline órfã na tela
    await clientePage.fecharDetalhesDoPedido();
    await expect(clientePage.modalDetalhesPedido).toBeHidden();
  });

  /**
   * DEFEITO CONHECIDO (BUG-01) — registrado com test.fixme para não travar o pipeline.
   *
   * A timeline de rastreio do front-end compara o status do pedido com os literais
   * em português "ENTREGUE"/"ENVIADO", porém GET /orders/me devolve o enum em inglês
   * ("delivered"/"shipped", conforme APILOJAQA.YAML). Resultado: um pedido entregue
   * exibe o badge DELIVERED, mas a timeline permanece travada em "3. Em Preparação".
   *
   * A expectativa abaixo é a CORRETA (comportamento de negócio). Ao corrigir o
   * front-end, basta remover a chamada test.fixme para o cenário entrar no pipeline.
   */
  test.fixme(
    'CT-E2E-CL-03: [Defeito conhecido] Deve concluir a timeline de rastreio para pedido com status delivered',
    async ({ clientePage, pedidosDoCliente }) => {
      const pedido = primeiroPedidoComStatus(pedidosDoCliente, ['delivered']);
      test.skip(!pedido, 'Massa sem pedido entregue (delivered) para validar a timeline.');

      const { indiceAtivo, indiceUltimoConcluido } = expectativaDoRastreio(pedido!.status);

      await clientePage.abrirDetalhesDoPedido(pedido!._id);

      await expect(clientePage.badgeStatusModal).toHaveText('DELIVERED');
      await expect(clientePage.passosRastreio).toHaveCount(PASSOS_RASTREIO.length);

      for (let indice = 0; indice < PASSOS_RASTREIO.length; indice += 1) {
        const passo = clientePage.passosRastreio.nth(indice);

        if (indice <= indiceUltimoConcluido) {
          await expect(passo).toHaveClass(/is-done/);
        }
        if (indice === indiceAtivo) {
          await expect(passo).toHaveClass(/is-active/);
        }
      }

      // A etapa 5 (Entregue) deve estar concluída e ativa para pedidos entregues
      await expect(clientePage.obterPassoRastreio('Entregue')).toHaveClass(/is-done/);
      await expect(clientePage.obterPassoRastreio('Entregue')).toHaveClass(/is-active/);
      await expect(clientePage.stepperRastreio.locator('.step.is-active')).toHaveCount(1);
    }
  );

  test('CT-E2E-CL-04: Deve imprimir o comprovante do pedido com os dados do registro e manter o modal aberto', async ({
    clientePage,
    pedidosDoCliente,
  }) => {
    const pedido = pedidosDoCliente[0];

    // 1. Abre o pedido mais recente do cliente
    await clientePage.abrirDetalhesDoPedido(pedido._id);
    await expect(clientePage.modalDetalhesPedido).toBeVisible();

    // 2. Instrumenta window.print para capturar o disparo da impressão
    //    (evita que o diálogo nativo do sistema operacional trave a execução headless)
    await clientePage.instrumentarDialogoDeImpressao();

    await expect(clientePage.botaoImprimirComprovante).toBeVisible();
    await expect(clientePage.botaoImprimirComprovante).toBeEnabled();
    expect(await clientePage.contarImpressoesDisparadas()).toBe(0);

    // 3. Aciona a impressão do comprovante
    await clientePage.imprimirComprovante();

    await expect
      .poll(() => clientePage.contarImpressoesDisparadas(), {
        message: 'O botão "Imprimir Comprovante" deve disparar window.print() uma única vez',
        timeout: 10_000,
      })
      .toBe(1);

    // 4. O comprovante corresponde ao pedido selecionado (rastreabilidade do documento)
    await expect(clientePage.tituloPedidoModal).toHaveText(/^Pedido PED-\d{5}$/);
    await expect(clientePage.idApiPedidoModal).toHaveText(pedido._id);
    await expect(clientePage.dataPedidoModal).toHaveText(/^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/);
    await expect(clientePage.badgeStatusModal).toHaveText(pedido.status.toUpperCase());
    await expect(clientePage.totalPagoModal).toHaveText(formatarMoeda(pedido.total));
    await expect(clientePage.subtotalModal).not.toBeEmpty();
    await expect(clientePage.freteModal).not.toBeEmpty();
    await expect(clientePage.enderecoEntregaModal).toHaveText(pedido.shippingAddress);
    for (const item of pedido.items) {
      await expect(clientePage.itensPedidoModal).toContainText(item.name);
    }

    // 5. A impressão não pode fechar o modal nem perder o contexto do pedido
    await expect(clientePage.modalDetalhesPedido).toBeVisible();
    await expect(clientePage.stepperRastreio).toBeVisible();
    await expect(clientePage.botaoFecharModal).toBeEnabled();

    // 6. Emulação de mídia de impressão: o comprovante permanece íntegro
    //    (equivalente a "Visualizar impressão" no navegador)
    await clientePage.emularMidiaDeImpressao();
    await expect(clientePage.modalDetalhesPedido).toBeVisible();
    await expect(clientePage.tituloPedidoModal).toBeVisible();
    await expect(clientePage.totalPagoModal).toBeVisible();
    await expect(clientePage.itensPedidoModal).toBeVisible();
    await clientePage.restaurarMidiaDeTela();

    console.log('\n[CT-E2E-CL-04 | IMPRESSÃO DE COMPROVANTE]');
    console.log(`  • Pedido impresso     : ${pedido._id}`);
    console.log(`  • Total no comprovante: ${formatarMoeda(pedido.total)}`);
    console.log('  • window.print()      : 1 disparo capturado (stub instrumentado)');
    console.log('  • Modal após impressão: permanece aberto com a timeline ativa');

    // 7. Encerra fechando o modal
    await clientePage.fecharDetalhesDoPedido();
    await expect(clientePage.modalDetalhesPedido).toBeHidden();
  });
});
