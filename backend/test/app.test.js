const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

test('serves the main page and the connected writing screens', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const html = await page.text();
    const assets = [...html.matchAll(/(?:href|src)="([^"]+\.(?:css|jpg|png|js))"/g)];
    assert.ok(assets.length > 0);
    for (const [, asset] of assets) {
      const response = await fetch(new URL(asset, page.url));
      assert.equal(response.status, 200, `Missing asset: ${asset}`);
    }
    for (const route of ['/html/create.html', '/html/detail.html', '/html/Mypage.html', '/html/admin.html']) {
      const screen = await fetch(base + route);
      assert.equal(screen.status, 200, route);
      const markup = await screen.text();
      const scripts = [...markup.matchAll(/src="([^"]+.js)"/g)];
      assert.ok(scripts.length > 0, route);
      for (const [, script] of scripts) {
        assert.equal((await fetch(new URL(script, screen.url))).status, 200, script);
      }
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
