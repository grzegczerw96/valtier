// Production-like static server for local testing: brotli/gzip, immutable caching
// for hashed assets, clean URLs (/on-field -> on-field.html), byte ranges for video.
//   node apps/web/scripts/serve.mjs [port]
import http from 'node:http';
import http2 from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = +(process.argv[2] || 4330);
// Optional HTTP/2 + TLS (like production CDNs): node serve.mjs 4331 --h2 key.pem cert.pem
const H2 = process.argv[3] === '--h2';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon',
};
const COMPRESSIBLE = /\.(html|css|js|json|svg|txt|xml)$/;
const cache = new Map();

// Mirror the Astro `base` (GitHub Pages serves the site under /valtier/).
const BASE = '/valtier';

function resolve(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === BASE) p = '/';
  else if (p.startsWith(BASE + '/')) p = p.slice(BASE.length);
  else return null;
  if (p.endsWith('/')) p += 'index';
  const candidates = [p, `${p}.html`, path.join(p, 'index.html')];
  for (const c of candidates) {
    const f = path.join(ROOT, c);
    if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

const handler = (req, res) => {
  const file = resolve(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }
  const ext = path.extname(file);
  const headers = { 'content-type': TYPES[ext] || 'application/octet-stream', vary: 'accept-encoding' };
  headers['cache-control'] = file.includes(`${path.sep}_astro${path.sep}`) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=86400';
  const stat = fs.statSync(file);
  if (req.headers.range && !COMPRESSIBLE.test(ext)) {
    const [s, e] = req.headers.range.replace('bytes=', '').split('-');
    const start = +s, end = e ? +e : stat.size - 1;
    res.writeHead(206, { ...headers, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  const ae = String(req.headers['accept-encoding'] || '');
  if (COMPRESSIBLE.test(ext) && /\b(br|gzip)\b/.test(ae)) {
    const enc = ae.includes('br') ? 'br' : 'gzip';
    const key = `${file}:${enc}:${stat.mtimeMs}`;
    let body = cache.get(key);
    if (!body) {
      const raw = fs.readFileSync(file);
      body = enc === 'br' ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }) : zlib.gzipSync(raw, { level: 9 });
      cache.set(key, body);
    }
    res.writeHead(200, { ...headers, 'content-encoding': enc, 'content-length': body.length });
    return res.end(body);
  }
  res.writeHead(200, { ...headers, 'accept-ranges': 'bytes', 'content-length': stat.size });
  fs.createReadStream(file).pipe(res);
};
const server = H2
  ? http2.createSecureServer({ key: fs.readFileSync(process.argv[4]), cert: fs.readFileSync(process.argv[5]), allowHTTP1: true }, handler)
  : http.createServer(handler);
server.listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on ${H2 ? 'https' : 'http'}://127.0.0.1:${PORT}`));
