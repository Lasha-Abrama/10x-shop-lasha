import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'The initial HTML must contain the early homepage preload script.');

function initialPreloads(pathname) {
  const links = [];
  runInNewContext(script, {
    window: { location: { pathname } },
    document: {
      createElement: (tag) => { assert.equal(tag, 'link'); return {}; },
      head: { append: (link) => links.push(link) },
    },
  });
  return links;
}

test('initial homepage HTML creates one high-priority responsive WebP preload without a fixed fallback URL', () => {
  const links = initialPreloads('/');
  assert.equal(links.length, 1);
  const [link] = links;
  assert.equal(link.rel, 'preload');
  assert.equal(link.as, 'image');
  assert.equal(link.type, 'image/webp');
  assert.equal(link.fetchPriority, 'high');
  assert.ok(link.imageSrcset && link.imageSizes);
  assert.equal(link.href, undefined);
});

test('direct non-homepage visits do not preload an unused homepage image', () => {
  for (const path of ['/products', '/products/1', '/cart', '/login', '/orders']) {
    assert.equal(initialPreloads(path).length, 0, path);
  }
});
