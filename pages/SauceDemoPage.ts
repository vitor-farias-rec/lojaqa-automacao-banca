import { type Locator, type Page } from '@playwright/test';

export interface DadosCompradorSauce {
  nome: string;
  sobrenome: string;
  cep: string;
}

/**
 * Page Object Model — Site Público Externo (SauceDemo)
 *
 * Boas práticas aplicadas:
 * - Construtor com injeção de dependência estrita: constructor(private page: Page)
 * - Seletores semânticos via getByTestId (atributo data-test) e getByRole
 * - Nenhuma asserção ou pausa fixa dentro do Page Object
 */
export class SauceDemoPage {
  readonly campoUsuario: Locator;
  readonly campoSenha: Locator;
  readonly botaoLogin: Locator;
  readonly botaoAdicionarMochila: Locator;
  readonly linkCarrinho: Locator;
  readonly botaoCheckout: Locator;
  readonly campoNome: Locator;
  readonly campoSobrenome: Locator;
  readonly campoCep: Locator;
  readonly botaoContinuar: Locator;
  readonly botaoFinalizar: Locator;
  readonly tituloPedidoConcluido: Locator;

  constructor(private page: Page) {
    this.campoUsuario = this.page.getByTestId('username');
    this.campoSenha = this.page.getByTestId('password');
    this.botaoLogin = this.page.getByTestId('login-button');
    this.botaoAdicionarMochila = this.page.getByTestId('add-to-cart-sauce-labs-backpack');
    this.linkCarrinho = this.page.getByTestId('shopping-cart-link');
    this.botaoCheckout = this.page.getByTestId('checkout');
    this.campoNome = this.page.getByTestId('firstName');
    this.campoSobrenome = this.page.getByTestId('lastName');
    this.campoCep = this.page.getByTestId('postalCode');
    this.botaoContinuar = this.page.getByTestId('continue');
    this.botaoFinalizar = this.page.getByTestId('finish');
    this.tituloPedidoConcluido = this.page.getByRole('heading', { name: 'Thank you for your order!' });
  }

  async acessarSite(): Promise<void> {
    await this.page.goto('https://www.saucedemo.com/');
  }

  async realizarLogin(usuario: string, senha: string): Promise<void> {
    await this.campoUsuario.fill(usuario);
    await this.campoSenha.fill(senha);
    await this.botaoLogin.click();
    await this.page.waitForURL('**/inventory.html');
  }

  async adicionarMochilaEAbrirCarrinho(): Promise<void> {
    await this.botaoAdicionarMochila.click();
    await this.linkCarrinho.click();
    await this.page.waitForURL('**/cart.html');
  }

  async concluirCheckout(comprador: DadosCompradorSauce): Promise<void> {
    await this.botaoCheckout.click();
    await this.page.waitForURL('**/checkout-step-one.html');

    await this.campoNome.fill(comprador.nome);
    await this.campoSobrenome.fill(comprador.sobrenome);
    await this.campoCep.fill(comprador.cep);
    await this.botaoContinuar.click();
    await this.page.waitForURL('**/checkout-step-two.html');

    await this.botaoFinalizar.click();
    await this.page.waitForURL('**/checkout-complete.html');
  }
}
