import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrollIntent } from '../src/navigation/scroll.ts';

const catalog = { pathname: '/products', search: '?q=phone&page=2', hash: '' };
test('route scroll distinguishes page navigation, filter changes, anchors and history restoration', () => {
  assert.equal(scrollIntent(null, catalog, 'POP', false), 'top');
  assert.equal(scrollIntent(catalog, { ...catalog, pathname: '/login', search: '' }, 'PUSH', false), 'top');
  assert.equal(scrollIntent(catalog, { ...catalog, search: '?q=phone&page=3' }, 'PUSH', false), 'results');
  assert.equal(scrollIntent(catalog, { ...catalog, search: '?q=phone&category=smartphones' }, 'PUSH', false), 'preserve');
  assert.equal(scrollIntent(catalog, { ...catalog, search: '?q=apple' }, 'REPLACE', false), 'preserve');
  assert.equal(scrollIntent(catalog, { ...catalog, search: '?q=phone&sort=price-asc' }, 'PUSH', false), 'preserve');
  assert.equal(scrollIntent(catalog, { ...catalog, hash: '#catalog-search' }, 'PUSH', false), 'anchor');
  assert.equal(scrollIntent(catalog, { ...catalog, hash: '#catalog-search' }, 'POP', true), 'restore');
  assert.equal(scrollIntent(catalog, { ...catalog, search: '?q=phone' }, 'REPLACE', false), 'results');
  const sameAnchor = { pathname: '/', search: '', hash: '#perspective' };
  assert.equal(scrollIntent(sameAnchor, sameAnchor, 'PUSH', false), 'anchor');
});
