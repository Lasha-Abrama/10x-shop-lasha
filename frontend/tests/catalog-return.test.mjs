import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeCatalogReturnTo } from '../src/catalog/returnTo.ts';

test('catalog return destinations preserve valid modes, sorting and pagination canonically', () => {
  for (const path of ['/products', '/products?q=eye', '/products?q=EYE&sort=title-asc&page=2', '/products?category=groceries&sort=price-desc&page=3']) {
    assert.equal(safeCatalogReturnTo(path), path);
  }
  assert.equal(safeCatalogReturnTo('/products?page=2&sort=title-asc&q=%20EYE%20&category=beauty'), '/products?q=EYE&sort=title-asc&page=2');
  assert.equal(safeCatalogReturnTo('/products?q=%20&category=beauty&page=0&sort=unknown&extra=discard'), '/products?category=beauty');
});

test('catalog returns reject external, arbitrary, malformed and missing destinations', () => {
  for (const value of [undefined, null, 3, {}, ['/products'], '', '/', '/cart', '/orders', '/products/5', '/products-extra',
    'https://evil.example/products', '//evil.example/products', 'javascript:alert(1)', '/\\evil.example/products',
    '/products#catalog-search', '/products?q=eye#fragment', '/products?x=\\evil.example', '/products?\nq=eye']) {
    assert.equal(safeCatalogReturnTo(value), '/products');
  }
});
