import { test, expect } from '@playwright/test';

const DUMMYJSON_BASE_URL = 'https://dummyjson.com';

interface ProdutoDummyJson {
  id: number;
  title: string;
  category: string;
  price: number;
  stock: number;
}

test.describe('API REST Externa ({ request }) — DummyJSON Products', () => {
  test('CT-EXT-API-01: Deve cadastrar produto simulado no endpoint público POST /products/add e validar status, headers e payload', async ({
    request,
  }) => {
    const payloadEnviado = {
      title: 'Teclado Mecânico Compacto QA',
      category: 'laptops',
      price: 299.9,
      stock: 20,
    };

    const response = await request.post(`${DUMMYJSON_BASE_URL}/products/add`, {
      headers: { 'Content-Type': 'application/json' },
      data: payloadEnviado,
    });

    const contentType = response.headers()['content-type'];
    const corpoJson = (await response.json()) as ProdutoDummyJson;

    console.log('\n[CT-EXT-API-01 | API EXTERNA DUMMYJSON - POST /products/add]');
    console.log(`  • Status Code : ${response.status()} (Esperado: 201 Created)`);
    console.log(`  • Header      : content-type = ${contentType}`);
    console.log(`  • Response    : ${JSON.stringify(corpoJson)}`);

    expect(response.status()).toBe(201);
    expect(contentType).toContain('application/json');
    expect(corpoJson.id).toEqual(expect.any(Number));
    expect(corpoJson.title).toBe(payloadEnviado.title);
    expect(corpoJson.category).toBe(payloadEnviado.category);
    expect(corpoJson.price).toBe(payloadEnviado.price);
    expect(corpoJson.stock).toBe(payloadEnviado.stock);
  });
});
