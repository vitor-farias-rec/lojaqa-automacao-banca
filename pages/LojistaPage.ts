import { type Locator, type Page } from '@playwright/test';

export interface DadosNovoProduto {
  nome: string;
  categoria: string;
  preco: string;
  estoque: string;
  descricao?: string;
  imagemUrl?: string;
}

/**
 * Page Object Model — Módulo Lojista: CRUD de Produtos & Teardown (LojaQA)
 *
 * Boas práticas aplicadas:
 * - Injeção de dependência estrita no construtor: constructor(private page: Page)
 * - Seletores 100% semânticos (getByRole, getByLabel, getByText)
 * - Nenhuma asserção dentro do Page Object (asserções ficam exclusivamente nos specs)
 * - Sincronização reativa por eventos de rede e estado de tela (sem pausas fixas)
 */
export class LojistaPage {
  // --- Elementos de Autenticação (login.html) ---
  readonly campoEmailLogin: Locator;
  readonly campoSenhaLogin: Locator;
  readonly botaoEntrar: Locator;

  // --- Elementos da Área Protegida (painel.html) ---
  readonly identificadorUsuario: Locator;
  readonly tituloPagina: Locator;
  readonly badgePerfil: Locator;
  readonly botaoLogout: Locator;
  readonly linkEntrarVitrine: Locator;

  // --- Elementos de Gestão de Produtos do Lojista ---
  readonly tituloGestaoEstoque: Locator;
  readonly resumoEstoque: Locator;
  readonly botaoNovoProduto: Locator;
  readonly campoNomeProduto: Locator;
  readonly campoCategoria: Locator;
  readonly campoPreco: Locator;
  readonly campoEstoque: Locator;
  readonly campoVisibilidade: Locator;
  readonly campoUrlImagem: Locator;
  readonly campoDescricao: Locator;
  readonly botaoCadastrarProduto: Locator;
  readonly botaoSalvarAlteracoes: Locator;
  readonly campoBuscaTabela: Locator;

  constructor(private page: Page) {
    // Mapeamento semântico — Tela de Login
    this.campoEmailLogin = this.page.getByRole('textbox', { name: 'E-mail' });
    this.campoSenhaLogin = this.page.getByRole('textbox', { name: 'Senha' });
    this.botaoEntrar = this.page.getByRole('button', { name: 'Entrar' });

    // Mapeamento semântico — Área Protegida (Cabeçalho, Painel e Logout)
    this.identificadorUsuario = this.page.getByRole('banner').getByText(/·\s*SELLER/i);
    this.tituloPagina = this.page.getByRole('heading', { name: 'Painel do Lojista', level: 1 });
    this.badgePerfil = this.page.getByRole('complementary').getByText('SELLER', { exact: true });
    this.botaoLogout = this.page.getByRole('button', { name: 'Sair' });
    this.linkEntrarVitrine = this.page.getByRole('link', { name: 'Entrar' });

    // Mapeamento semântico — Formulário e Tabela Gerencial de Estoque
    this.tituloGestaoEstoque = this.page.getByRole('heading', { name: /Gestão de Estoque/i, level: 2 });
    this.resumoEstoque = this.page.getByText(/Exibindo .* produtos no estoque/);
    this.botaoNovoProduto = this.page.getByRole('button', { name: 'Novo Produto' });
    this.campoNomeProduto = this.page.getByLabel('Nome do Produto *');
    this.campoCategoria = this.page.getByLabel('Categoria *');
    this.campoPreco = this.page.getByLabel('Preço de Venda (R$) *');
    this.campoEstoque = this.page.getByLabel('Quantidade em Estoque *');
    this.campoVisibilidade = this.page.getByLabel('Visibilidade na Vitrine');
    this.campoUrlImagem = this.page.getByLabel('URL da Imagem do Produto');
    this.campoDescricao = this.page.getByLabel('Descrição do Produto');
    this.botaoCadastrarProduto = this.page.getByRole('button', { name: 'Cadastrar Produto' });
    this.botaoSalvarAlteracoes = this.page.getByRole('button', { name: 'Salvar Alterações' });
    this.campoBuscaTabela = this.page.getByRole('searchbox', { name: /Buscar por nome/i });
  }

  /**
   * Navega para a página de login da LojaQA.
   */
  async irParaLogin(): Promise<void> {
    await this.page.goto('login.html');
  }

  /**
   * Preenche as credenciais válidas do lojista, submete o formulário
   * e realiza espera ativa pela URL restrita e pelo carregamento do catálogo.
   */
  async autenticarComoLojista(email: string, senha: string): Promise<void> {
    await this.campoEmailLogin.fill(email);
    await this.campoSenhaLogin.fill(senha);
    await this.botaoEntrar.click();

    await this.page.waitForURL('**/painel.html');
    await this.tituloPagina.waitFor({ state: 'visible' });
    await this.resumoEstoque.waitFor({ state: 'visible' });
  }

  /**
   * Executa a saída segura do sistema e devolve a aplicação para o estado deslogado (vitrine).
   */
  async logout(): Promise<void> {
    await this.botaoLogout.click();
    await this.page.waitForURL('**/loja.html');
  }

  /**
   * Localiza semanticamente o card/linha de um produto na tabela gerencial pelo título exato.
   */
  obterCardProduto(nomeProduto: string): Locator {
    return this.page
      .getByRole('article')
      .filter({ has: this.page.getByRole('heading', { name: nomeProduto, exact: true }) });
  }

  /**
   * Localiza uma mensagem de feedback/notificação exibida no painel.
   */
  obterMensagemFeedback(mensagem: string | RegExp): Locator {
    return this.page.getByText(mensagem);
  }

  /**
   * Filtra os itens na barra de pesquisa da tabela gerencial do lojista.
   */
  async filtrarProdutoNaTabela(termo: string): Promise<void> {
    await this.campoBuscaTabela.fill(termo);
    await this.campoBuscaTabela.blur();
  }

  /**
   * Cadastra um novo produto pelo formulário do Painel do Lojista e aguarda
   * a persistência na API + recarregamento da lista gerencial.
   */
  async cadastrarProduto(dados: DadosNovoProduto): Promise<void> {
    await this.botaoNovoProduto.click();
    await this.campoNomeProduto.fill(dados.nome);
    await this.campoCategoria.fill(dados.categoria);
    await this.campoPreco.fill(dados.preco);
    await this.campoEstoque.fill(dados.estoque);

    if (dados.imagemUrl) {
      await this.campoUrlImagem.fill(dados.imagemUrl);
    }
    if (dados.descricao) {
      await this.campoDescricao.fill(dados.descricao);
    }

    await Promise.all([
      this.page.waitForResponse(
        (res) =>
          res.url().includes('/api/seller/products') &&
          res.request().method() === 'POST'
      ),
      this.page.waitForResponse(
        (res) =>
          res.url().includes('/api/seller/products') &&
          res.request().method() === 'GET'
      ),
      this.botaoCadastrarProduto.click(),
    ]);
  }

  /**
   * Abre o modo de edição de um produto na tabela gerencial, altera sua quantidade
   * em estoque e salva as alterações aguardando a sincronização com o backend.
   */
  async editarEstoqueProduto(nomeProduto: string, novoEstoque: string): Promise<void> {
    const card = this.obterCardProduto(nomeProduto);
    await card.getByRole('button', { name: /Editar/i }).click();

    await this.campoEstoque.fill(novoEstoque);

    await Promise.all([
      this.page.waitForResponse(
        (res) =>
          res.url().includes('/api/seller/products/') &&
          res.request().method() === 'PUT'
      ),
      this.page.waitForResponse(
        (res) =>
          res.url().includes('/api/seller/products') &&
          res.request().method() === 'GET'
      ),
      this.botaoSalvarAlteracoes.click(),
    ]);
  }

  /**
   * Aciona a exclusão física (Hard Delete) de um produto na tabela gerencial,
   * aceita a caixa de confirmação nativa do navegador e retorna o HTTP status da operação.
   */
  async excluirProdutoNaTabela(nomeProduto: string): Promise<number> {
    const card = this.obterCardProduto(nomeProduto);

    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    const promessaRecarregamento = this.page
      .waitForResponse(
        (res) =>
          res.url().includes('/api/seller/products') &&
          res.request().method() === 'GET',
        { timeout: 15_000 }
      )
      .catch(() => null);

    const [respostaDelete] = await Promise.all([
      this.page.waitForResponse(
        (res) =>
          res.url().includes('/api/seller/products/') &&
          res.request().method() === 'DELETE'
      ),
      card.getByRole('button', { name: /Excluir/i }).click(),
    ]);

    if (respostaDelete.ok()) {
      await promessaRecarregamento;
    }

    return respostaDelete.status();
  }
}
