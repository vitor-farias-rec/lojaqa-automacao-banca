import { test, expect } from '@playwright/test';
import { DiarioPage } from '../../pages/DiarioPage';

/**
 * UI Externa (E2E) — Portal Diario de Pernambuco
 *
 * Cenário: **busca de conteúdo** — o leitor usa o campo de pesquisa do portal
 * para localizar uma publicação específica e conferir, na matéria aberta, a
 * data de publicação e a autoria (a assinatura do conteúdo).
 *
 * Por que este fluxo importa: a busca é a porta de entrada de quem procura um
 * fato já noticiado. Se ela devolve o link errado, engole um resultado ou abre
 * uma matéria com data/autor incorretos, a credibilidade editorial do veículo
 * (e a rastreabilidade da fonte) fica comprometida.
 *
 * O cenário é read-only: não cria conta, não comenta e não assina nada. Os
 * valores de referência são fixos de propósito — trata-se de uma verificação de
 * regressão de uma publicação já existente, cujo conteúdo não deve mudar.
 */

/** Matéria de referência do cenário de busca (conteúdo fixo, já publicado). */
const MATERIA_ALVO = {
  id: '11729214',
  url: 'https://www.diariodepernambuco.com.br/viver/2026/11/11729214-prefeito-de-capital-no-nordeste-anuncia-show-de-shakira-em-janeiro-de-2027-saiba-qual.html',
  titulo: 'Prefeito de capital do Nordeste anuncia show de Shakira em janeiro de 2027; saiba qual',
  termoBusca: 'Shakira',
  trechoTituloNoResultado: 'show de Shakira em janeiro',
  dataPublicacao: 'Publicado: 16/11/2026 às 06:29',
  autoria: 'Estadão Conteúdo',
} as const;

test.describe('UI Externa (E2E) — Diario de Pernambuco: Busca de Conteúdo', () => {
  test('CT-EXT-E2E-02: Deve localizar a matéria pela busca do portal e validar data de publicação e autoria', async ({
    page,
  }) => {
    const diarioPage = new DiarioPage(page);

    await test.step('Home: abrir o portal', async () => {
      await diarioPage.acessarHome();
      await diarioPage.dispensarAvisoDeCookies();
    });

    await test.step('Busca: pesquisar o termo "Shakira" no portal', async () => {
      await diarioPage.pesquisarPor(MATERIA_ALVO.termoBusca);

      expect(page.url()).toContain(`/capa_busca.html?q=${MATERIA_ALVO.termoBusca}`);
      await expect(diarioPage.tituloBusca).toHaveText('Busca no portal');

      await expect(diarioPage.resultadosDaBusca.first()).toBeVisible();
      const totalResultados = await diarioPage.contarResultadosDaBusca();
      expect(totalResultados).toBeGreaterThan(0);

      console.log('\n[CT-EXT-E2E-02 | BUSCA NO PORTAL DIARIO DE PERNAMBUCO]');
      console.log(`  • Termo pesquisado  : ${MATERIA_ALVO.termoBusca}`);
      console.log(`  • URL de resultados : ${page.url()}`);
      console.log(`  • Resultados        : ${totalResultados}`);
    });

    await test.step('Busca: a matéria esperada aparece entre os resultados', async () => {
      const resultado = diarioPage.obterResultadoDaBuscaPorUrl(MATERIA_ALVO.id);

      await expect(resultado).toBeVisible();
      await expect(resultado).toContainText(MATERIA_ALVO.trechoTituloNoResultado);

      console.log(`  • Resultado alvo    : ${await resultado.innerText()}`);
    });

    // Os resultados da busca abrem em nova aba (target="_blank")
    const paginaMateria = await diarioPage.abrirResultadoDaBusca(MATERIA_ALVO.id);

    await test.step('Matéria: abre na URL e com o título esperados', async () => {
      expect(paginaMateria.obterUrlAtual()).toBe(MATERIA_ALVO.url);
      await expect(paginaMateria.tituloMateria).toHaveText(MATERIA_ALVO.titulo);
    });

    await test.step('Matéria: data de publicação 16/11/2026 às 06:29', async () => {
      // Asserção com retry (o template carrega os metadados do artigo de forma assíncrona)
      await expect(paginaMateria.dataPublicacao).toContainText(MATERIA_ALVO.dataPublicacao);
      // Comparação exata do texto exibido ao leitor
      expect((await paginaMateria.dataPublicacao.innerText()).trim()).toBe(
        MATERIA_ALVO.dataPublicacao
      );

      // A meta tag de publicação deve refletir a mesma data e hora
      const metasDePublicacao = await paginaMateria.obterConteudoMeta(
        paginaMateria.metaPublicacao
      );
      expect(metasDePublicacao.some((valor) => valor.startsWith('2026-11-16'))).toBe(true);
      expect(metasDePublicacao.join(' ')).toContain('06:29');

      console.log(`  • Publicação (UI)   : ${MATERIA_ALVO.dataPublicacao}`);
      console.log(`  • Publicação (meta) : ${metasDePublicacao.join(' | ')}`);
    });

    await test.step('Matéria: autoria Estadão Conteúdo', async () => {
      // Assinatura exibida no corpo da matéria
      const assinatura = await paginaMateria.obterAssinaturaDoAutor();
      expect(assinatura.join(' ')).toBe(MATERIA_ALVO.autoria);
      await expect(paginaMateria.assinaturaAutor.first()).toHaveText(MATERIA_ALVO.autoria);

      // Metadado de autoria (SEO) deve apontar para o mesmo jornal
      const autorMeta = await paginaMateria.obterConteudoMeta(paginaMateria.metaAutor);
      expect(autorMeta[0]).toBe(MATERIA_ALVO.autoria);

      console.log(`  • Autoria (UI)      : ${assinatura.join(' ')}`);
      console.log(`  • Autoria (meta)    : ${autorMeta[0]}`);
    });

    await test.step('Encerrar a aba da matéria aberta pela busca', async () => {
      await paginaMateria.fecharAba();
    });
  });
});
