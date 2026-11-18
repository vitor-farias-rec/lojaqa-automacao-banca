import { type Locator, type Page } from '@playwright/test';

/** URL oficial do portal (site público externo à LojaQA). */
export const URL_DIARIO_DE_PERNAMBUCO = 'https://www.diariodepernambuco.com.br/';

/**
 * Page Object Model — Portal Diario de Pernambuco (site público externo)
 *
 * Boas práticas aplicadas:
 * - Injeção de dependência estrita no construtor: constructor(private page: Page)
 * - Seletores semânticos como primeira escolha (getByRole/getByImg), com
 *   fallback documentado por classe/id da própria aplicação onde ela não expõe
 *   papel ARIA (cards da grid editorial, data de publicação, corpo da matéria).
 * - Nenhuma asserção e nenhuma pausa fixa dentro do Page Object: a espera é
 *   sempre por estado de tela (waitForURL / waitFor / auto-waiting do Playwright).
 * - O Page Object não conhece regras de negócio do teste: expõe leitura de
 *   resultados de busca, dados da matéria (data/autoria) e metadados; quem valida
 *   os valores esperados é o spec.
 */
export class DiarioPage {
  // --- Identidade do portal (home) ---
  readonly manchetePrincipal: Locator;

  // --- Consentimento de cookies (banner de terceiro, intermitente) ---
  readonly avisoDeCookies: Locator;
  readonly botaoAceitarCookies: Locator;

  // --- Busca do portal (Google Programmable Search) ---
  readonly botaoAbrirBusca: Locator;
  readonly campoBusca: Locator;
  readonly botaoPesquisar: Locator;
  readonly tituloBusca: Locator;
  readonly resultadosDaBusca: Locator;

  // --- Página da matéria ---
  readonly tituloMateria: Locator;
  readonly dataPublicacao: Locator;
  readonly assinaturaAutor: Locator;
  readonly metaPublicacao: Locator;
  readonly metaAutor: Locator;

  constructor(private page: Page) {
    // Identidade: o h1 da home é a manchete principal do dia
    this.manchetePrincipal = this.page.getByRole('heading', { level: 1 }).first();

    // Consentimento (WP Cookie Consent) — nem sempre é exibido
    this.avisoDeCookies = this.page.locator('#divCookieConsent');
    this.botaoAceitarCookies = this.avisoDeCookies.getByRole('link', {
      name: 'Aceitar',
      exact: true,
    });

    // Busca: botão do cabeçalho abre o formulário; os resultados são renderizados
    // pelo Google Programmable Search e usam as classes .gs-* (fallback documentado)
    this.botaoAbrirBusca = this.page.getByRole('button', { name: 'Buscar no Portal' });
    this.campoBusca = this.page.getByRole('searchbox');
    this.botaoPesquisar = this.page.getByRole('button', { name: 'Pesquisar', exact: true }).first();
    this.tituloBusca = this.page.getByRole('heading', { name: 'Busca no portal', level: 1 });
    this.resultadosDaBusca = this.page.locator('a.gs-title').filter({ visible: true });

    // Matéria: h1 é a manchete; data, assinatura e corpo são marcados por classe
    this.tituloMateria = this.page.getByRole('heading', { level: 1 }).first();
    this.dataPublicacao = this.page.locator('.publicacaoNot').first();
    this.assinaturaAutor = this.page.locator('.assinaturaNot');

    // Contrato de metadados (Open Graph / SEO) usado para cruzar com o que a UI mostra
    this.metaPublicacao = this.page.locator('meta[property="article:published_time"]');
    this.metaAutor = this.page.locator('meta[name="author"]').first();
  }

  // ---------------------------------------------------------------------------
  // Navegação
  // ---------------------------------------------------------------------------

  /**
   * Abre a home do portal e aguarda a manchete principal (h1) estar renderizada.
   */
  async acessarHome(): Promise<void> {
    await this.page.goto(URL_DIARIO_DE_PERNAMBUCO, { waitUntil: 'domcontentloaded' });
    await this.manchetePrincipal.waitFor({ state: 'visible' });
  }

  /**
   * Dispensa o banner de consentimento de cookies quando ele é exibido.
   *
   * O banner é de um serviço de terceiro (WP Cookie Consent) e aparece de forma
   * intermitente; quando surge, é uma camada flutuante que pode interceptar
   * cliques nos links do portal. Não há asserção sobre ele: é apenas higiene de
   * sessão para manter a navegação determinística.
   */
  async dispensarAvisoDeCookies(): Promise<void> {
    try {
      await this.botaoAceitarCookies.waitFor({ state: 'visible', timeout: 4_000 });
      await this.botaoAceitarCookies.click({ timeout: 4_000 });
      await this.avisoDeCookies.waitFor({ state: 'hidden', timeout: 4_000 });
    } catch {
      // Sem banner, o fluxo segue normalmente; se houver camada residual,
      // remove apenas essa camada de terceiro do DOM.
      await this.avisoDeCookies.evaluate((elemento) => elemento.remove()).catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Busca do portal
  // ---------------------------------------------------------------------------

  /**
   * Abre o formulário de busca do cabeçalho e aguarda o campo ficar visível.
   */
  async abrirBusca(): Promise<void> {
    await this.botaoAbrirBusca.click();
    await this.campoBusca.waitFor({ state: 'visible' });
  }

  /**
   * Pesquisa um termo no portal e aguarda a página de resultados
   * (`capa_busca.html?q=<termo>`) com o título "Busca no portal".
   */
  async pesquisarPor(termo: string): Promise<void> {
    await this.abrirBusca();
    await this.campoBusca.fill(termo);
    await this.botaoPesquisar.click();

    await this.page.waitForURL(
      (url) =>
        url.pathname.endsWith('/capa_busca.html') && url.searchParams.get('q') === termo
    );
    await this.tituloBusca.waitFor({ state: 'visible' });
  }

  /**
   * Quantidade de resultados exibidos na página de busca.
   */
  async contarResultadosDaBusca(): Promise<number> {
    return this.resultadosDaBusca.count();
  }

  /**
   * Localiza o título de um resultado da busca pelo trecho da URL da matéria
   * (ex.: o ID numérico da publicação, como '11729214').
   */
  obterResultadoDaBuscaPorUrl(trechoUrl: string): Locator {
    return this.page.locator(`a.gs-title[href*="${trechoUrl}"]`).filter({ visible: true }).first();
  }

  /**
   * Abre um resultado da busca e devolve um Page Object apontando para a aba da matéria.
   *
   * Os resultados do Google Programmable Search são abertos com target="_blank";
   * por isso capturamos a nova aba do contexto antes de clicar, em vez de assumir
   * que a navegação ocorre na aba atual.
   */
  async abrirResultadoDaBusca(trechoUrl: string): Promise<DiarioPage> {
    const resultado = this.obterResultadoDaBuscaPorUrl(trechoUrl);
    await resultado.waitFor({ state: 'visible' });

    const [novaAba] = await Promise.all([
      this.page.context().waitForEvent('page'),
      resultado.click(),
    ]);

    await novaAba.waitForLoadState('domcontentloaded');

    const paginaDaMateria = new DiarioPage(novaAba);
    await paginaDaMateria.tituloMateria.waitFor({ state: 'visible' });
    return paginaDaMateria;
  }

  // ---------------------------------------------------------------------------
  // Leitura da matéria
  // ---------------------------------------------------------------------------

  /**
   * Texto exibido na assinatura do autor (ex.: 'Estadão Conteúdo').
   */
  async obterAssinaturaDoAutor(): Promise<string[]> {
    const textos = await this.assinaturaAutor.allInnerTexts();
    return textos.map((texto) => texto.trim()).filter(Boolean);
  }

  /**
   * URL atual da página representada por este Page Object.
   */
  obterUrlAtual(): string {
    return this.page.url();
  }

  /**
   * Fecha a aba atual (usado para encerrar abas abertas pela busca).
   */
  async fecharAba(): Promise<void> {
    await this.page.close();
  }

  /**
   * Conteúdo (atributo `content`) de uma ou mais meta tags — a página pode
   * declarar `article:published_time` repetido (data e data+hora).
   */
  async obterConteudoMeta(meta: Locator): Promise<string[]> {
    return (await meta.evaluateAll((elementos) =>
      elementos.map((elemento) => elemento.getAttribute('content') ?? '')
    ))
      .map((valor) => valor.trim())
      .filter(Boolean);
  }
}
