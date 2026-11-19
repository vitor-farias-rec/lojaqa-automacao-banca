import { type Locator, type Page } from '@playwright/test';

export class ClientePage {
  // --- Autenticação (login.html) ---
  readonly campoEmailLogin: Locator;
  readonly campoSenhaLogin: Locator;
  readonly botaoEntrar: Locator;

  // --- Área autenticada do cliente (painel.html) ---
  readonly identificadorUsuario: Locator;
  readonly tituloPainel: Locator;
  readonly badgePerfil: Locator;
  readonly botaoLogout: Locator;
  readonly linkEntrarVitrine: Locator;

  // --- Navegação e listagem do módulo Pedidos ---
  readonly linkMenuMeusPedidos: Locator;
  readonly secaoPedidos: Locator;
  readonly tituloMeusPedidos: Locator;
  readonly listaPedidos: Locator;
  readonly estadoVazioPedidos: Locator;

  // --- Modal de detalhes do pedido (timeline de rastreio + comprovante) ---
  readonly modalDetalhesPedido: Locator;
  readonly tituloPedidoModal: Locator;
  readonly idApiPedidoModal: Locator;
  readonly dataPedidoModal: Locator;
  readonly badgeStatusModal: Locator;
  readonly stepperRastreio: Locator;
  readonly passosRastreio: Locator;
  readonly previsaoEntregaModal: Locator;
  readonly modalidadeFreteModal: Locator;
  readonly formaPagamentoModal: Locator;
  readonly enderecoEntregaModal: Locator;
  readonly itensPedidoModal: Locator;
  readonly subtotalModal: Locator;
  readonly freteModal: Locator;
  readonly totalPagoModal: Locator;
  readonly botaoImprimirComprovante: Locator;
  readonly botaoFecharModal: Locator;

  constructor(private page: Page) {
    // Mapeamento semântico — Tela de Login
    this.campoEmailLogin = this.page.getByRole('textbox', { name: 'E-mail' });
    this.campoSenhaLogin = this.page.getByRole('textbox', { name: 'Senha' });
    this.botaoEntrar = this.page.getByRole('button', { name: 'Entrar' });

    // Mapeamento semântico — Cabeçalho e área protegida
    // O cabeçalho exibe "Usuário Padrão · USER": identificamos o perfil pelo texto do banner.
    this.identificadorUsuario = this.page.getByRole('banner').getByText(/·\s*USER/i);
    this.tituloPainel = this.page.getByRole('heading', { name: 'Minha Conta', level: 1 });
    this.badgePerfil = this.page.getByRole('complementary').getByText('USER', { exact: true });
    this.botaoLogout = this.page.getByRole('button', { name: 'Sair' });
    this.linkEntrarVitrine = this.page.getByRole('link', { name: 'Entrar' });

    // Mapeamento do módulo Pedidos.
    // O elemento <section id="ordersSection"> não expõe landmark ARIA nomeado, então o
    // container é ancorado pelo id estável do markup e o título acessível é usado nas
    // asserções — evitando que o seletor capture seções ancestrais da mesma página.
    this.secaoPedidos = this.page.locator('#ordersSection');
    this.tituloMeusPedidos = this.secaoPedidos.getByRole('heading', { name: 'Meus pedidos', level: 2 });
    this.linkMenuMeusPedidos = this.page
      .getByRole('navigation')
      .getByRole('link', { name: 'Meus Pedidos' });
    this.listaPedidos = this.secaoPedidos.getByRole('article');
    this.estadoVazioPedidos = this.secaoPedidos.getByText(/Você ainda não realizou nenhum pedido/i);

    // Mapeamento do modal — ancorado pelo título acessível "Pedido PED-00000"
    this.modalDetalhesPedido = this.page
      .locator('.modal-backdrop')
      .filter({ has: this.page.getByRole('heading', { name: /^Pedido PED-\d{5}$/ }) });
    this.tituloPedidoModal = this.modalDetalhesPedido.getByRole('heading', { level: 2 });
    // Elementos abaixo não possuem papel ARIA exposto pela aplicação:
    // usamos o id estável do markup como fallback documentado.
    this.idApiPedidoModal = this.modalDetalhesPedido.locator('#modalOrderRawId');
    this.dataPedidoModal = this.modalDetalhesPedido.locator('#modalOrderDate');
    this.badgeStatusModal = this.modalDetalhesPedido.locator('#modalOrderStatusBadge');
    this.previsaoEntregaModal = this.modalDetalhesPedido.locator('#modalOrderDelivery');
    this.modalidadeFreteModal = this.modalDetalhesPedido.locator('#modalOrderShippingType');
    this.formaPagamentoModal = this.modalDetalhesPedido.locator('#modalOrderPayment');
    this.enderecoEntregaModal = this.modalDetalhesPedido.locator('#modalOrderAddress');
    this.itensPedidoModal = this.modalDetalhesPedido.locator('#modalOrderItemsList');
    this.subtotalModal = this.modalDetalhesPedido.locator('#modalOrderSubtotal');
    this.freteModal = this.modalDetalhesPedido.locator('#modalOrderFreight');
    this.totalPagoModal = this.modalDetalhesPedido.locator('#modalOrderTotal');

    // Timeline de rastreio (stepper visual) — estado exposto por classe CSS
    this.stepperRastreio = this.modalDetalhesPedido.locator('.tracking-stepper');
    this.passosRastreio = this.stepperRastreio.locator('.step');

    // Ações do rodapé do modal
    this.botaoImprimirComprovante = this.modalDetalhesPedido.getByRole('button', {
      name: 'Imprimir Comprovante',
    });
    this.botaoFecharModal = this.modalDetalhesPedido
      .locator('.modal-footer')
      .getByRole('button', { name: 'Fechar' });
  }

  /** Navega para a página de login da LojaQA. */
  async irParaLogin(): Promise<void> {
    await this.page.goto('login.html');
  }

  /**
   * Autentica o cliente com credenciais válidas, aguarda o redirecionamento para
   * a área restrita (painel.html), a resposta de GET /orders/me e a renderização
   * da listagem (ou do estado vazio) antes de liberar o teste.
   */
  async autenticarComoCliente(email: string, senha: string): Promise<void> {
    const respostaPedidos = this.page
      .waitForResponse(
        (res) => res.url().includes('/api/orders/me') && res.request().method() === 'GET',
        { timeout: 45_000 }
      )
      .catch(() => null);

    await this.campoEmailLogin.fill(email);
    await this.campoSenhaLogin.fill(senha);
    await this.botaoEntrar.click();

    await this.page.waitForURL('**/painel.html');
    await this.tituloPainel.waitFor({ state: 'visible' });
    await respostaPedidos;

    // Só devolve o controle quando a listagem terminou de renderizar.
    await this.listaPedidos
      .first()
      .or(this.estadoVazioPedidos)
      .first()
      .waitFor({ state: 'visible', timeout: 45_000 });
  }

  /** Executa a saída segura e devolve a aplicação ao estado deslogado (vitrine).*/
  async logout(): Promise<void> {
    await this.botaoLogout.click();
    await this.page.waitForURL('**/loja.html');
  }

  /** Aciona o atalho de menu "Meus Pedidos" e aguarda o título da seção ficar visível.*/
  async acessarModuloPedidos(): Promise<void> {
    await this.linkMenuMeusPedidos.click();
    await this.tituloMeusPedidos.waitFor({ state: 'visible' });
  }

  /**
   * Localiza a linha (article) de um pedido na listagem pelo ObjectId cru
   * exibido no badge de identificação.
   */
  obterLinhaPedidoPorIdApi(idApi: string): Locator {
    return this.listaPedidos.filter({ has: this.page.getByText(idApi, { exact: true }) });
  }

  /** Localiza a linha do pedido pela posição na listagem (0 = mais recente). */
  obterLinhaPedidoPorPosicao(indice: number): Locator {
    return this.listaPedidos.nth(indice);
  }

  /** Identificador visual amigável do pedido (padrão PED-00000) dentro da linha.*/
  obterIdVisualPedido(linha: Locator): Locator {
    return linha.getByText(/^PED-\d{5}$/);
  }

  /** Badge de status exibido na linha da listagem (ex.: PENDING, DELIVERED).*/
  obterStatusPedidoNaLinha(linha: Locator): Locator {
    return linha.locator('.status');
  }

  /** Botão de ação "Ver Detalhes" da linha do pedido.*/
  obterBotaoVerDetalhes(linha: Locator): Locator {
    return linha.getByRole('button', { name: /Ver Detalhes/i });
  }

  /**
   * Abre o modal de detalhes de um pedido a partir da listagem e aguarda a
   * timeline de rastreio estar pronta.
   */
  async abrirDetalhesDoPedido(idApi: string): Promise<void> {
    const linha = this.obterLinhaPedidoPorIdApi(idApi);
    await this.obterBotaoVerDetalhes(linha).click();

    await this.modalDetalhesPedido.waitFor({ state: 'visible' });
    await this.stepperRastreio.waitFor({ state: 'visible' });
  }

  /** Fecha o modal de detalhes pelo botão de rodapé "Fechar".*/
  async fecharDetalhesDoPedido(): Promise<void> {
    await this.botaoFecharModal.click();
    await this.modalDetalhesPedido.waitFor({ state: 'hidden' });
  }

  /**
   * Retorna um passo da timeline de rastreio pelo rótulo exibido
   * (ex.: 'Pagamento Aprovado', 'Em Preparação', 'A Caminho', 'Entregue').
   */
  obterPassoRastreio(rotulo: string | RegExp): Locator {
    return this.passosRastreio.filter({ hasText: rotulo });
  }

  /** Marca (bolinha) de um passo da timeline — alvo da validação visual do stepper.*/
  obterMarcadorDoPasso(passo: Locator): Locator {
    return passo.locator('.dot');
  }

  /**
   * Instala um stub de window.print antes do clique em "Imprimir Comprovante".
   *
   * Sem o stub, o clique dispara o diálogo nativo de impressão do SO, que trava
   * a execução headless. O contador permite validar que a ação foi disparada
   * exatamente uma vez pelo botão do comprovante.
   */
  async instrumentarDialogoDeImpressao(): Promise<void> {
    await this.page.evaluate(() => {
      const escopo = window as unknown as { __impressoesDisparadas?: number };
      escopo.__impressoesDisparadas = 0;
      window.print = () => {
        escopo.__impressoesDisparadas = (escopo.__impressoesDisparadas ?? 0) + 1;
      };
    });
  }

  /** Aciona o botão "Imprimir Comprovante" do modal de detalhes do pedido.*/
  async imprimirComprovante(): Promise<void> {
    await this.botaoImprimirComprovante.click();
  }

  /** Quantidade de vezes que window.print() foi disparado na página.*/
  async contarImpressoesDisparadas(): Promise<number> {
    return this.page.evaluate(
      () => (window as unknown as { __impressoesDisparadas?: number }).__impressoesDisparadas ?? 0
    );
  }

  /** Emula a mídia de impressão (equivalente ao "Visualizar impressão" do navegador).*/
  async emularMidiaDeImpressao(): Promise<void> {
    await this.page.emulateMedia({ media: 'print' });
  }

  /** Restaura a emulação para a mídia de tela.*/
  async restaurarMidiaDeTela(): Promise<void> {
    await this.page.emulateMedia({ media: 'screen' });
  }
}
