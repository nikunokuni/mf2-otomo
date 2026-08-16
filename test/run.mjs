/* 静的サーバーを立ててから、すべてのテストを順に実行する */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8811);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], {
      stdio: 'inherit',
      env: { ...process.env, BASE_URL: `http://localhost:${PORT}/` },
    });
    child.on('exit', resolve);
  });

server.listen(PORT, async () => {
  // npm start: サーバーだけ立てて、そのまま待ち受ける
  if (process.argv.includes('--serve-only')) {
    console.log(`http://localhost:${PORT}/ で配信中（Ctrl+C で終了）`);
    return;
  }

  let failed = 0;
  for (const file of ['./calc.test.mjs', './app.test.mjs', './migration.test.mjs']) {
    console.log(`\n===== ${file} =====`);
    failed += (await run(file)) ? 1 : 0;
  }
  server.close();
  console.log(failed ? `\n${failed}件のテストファイルが失敗しました` : '\nすべて成功しました');
  process.exit(failed ? 1 : 0);
});
