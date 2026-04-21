import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { detectPlatform, normalizeVideoInput } from './src/platforms.js';
import { buildHttpResolveResult, resolveVideo, WEB_MEDIA_DIR } from './src/resolve-service.js';

const PORT = Number(process.env.PORT || 4173);
const ROOT = process.cwd();
const MEDIA_DIR = WEB_MEDIA_DIR;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ogg': 'audio/ogg',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function toPublicError(error) {
  const message = String(error.message || error);

  if (/unsupported url|unsupported site|unable to extract|sign in|required|login/i.test(message)) {
    return '当前链接暂时无法解析，可能需要登录态或平台验证';
  }

  if (/network|timed out|timed-out|timeout/i.test(message)) {
    return '解析超时，请稍后重试';
  }

  return '未找到可用视频或转码失败';
}

function getStaticPath(urlPath) {
  if (urlPath === '/') {
    return path.join(ROOT, 'index.html');
  }

  const normalized = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  return path.join(ROOT, normalized);
}

async function serveFile(filePath, response, extraHeaders = {}) {
  const file = await fs.readFile(filePath);
  const extension = path.extname(filePath);

  response.writeHead(200, {
    'content-type': MIME_TYPES[extension] || 'application/octet-stream',
    ...extraHeaders
  });
  response.end(file);
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'POST' && requestUrl.pathname === '/api/resolve') {
      const body = await readJson(request);
      const rawUrl = normalizeVideoInput(body.url);

      if (!rawUrl) {
        sendJson(response, 400, { error: '请输入视频链接' });
        return;
      }

      const platform = detectPlatform(rawUrl);

      if (platform.id === 'invalid') {
        sendJson(response, 400, { error: '请输入有效的视频链接' });
        return;
      }

      const media = await resolveVideo(rawUrl, { outputDir: MEDIA_DIR });
      sendJson(response, 200, buildHttpResolveResult(media));
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname.startsWith('/media/')) {
      const filename = decodeURIComponent(requestUrl.pathname.replace('/media/', ''));
      const filePath = path.join(MEDIA_DIR, path.basename(filename));

      const headers = {};
      if (requestUrl.searchParams.get('download') === '1') {
        headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filename))}`;
      }

      await serveFile(filePath, response, headers);
      return;
    }

    if (request.method === 'GET') {
      const filePath = getStaticPath(requestUrl.pathname);
      await serveFile(filePath, response);
      return;
    }

    sendJson(response, 404, { error: 'Not Found' });
  } catch (error) {
    if (request.url?.startsWith('/api/resolve')) {
      sendJson(response, 500, {
        error: toPublicError(error)
      });
      return;
    }

    if (error.code === 'ENOENT') {
      sendJson(response, 404, { error: 'Not Found' });
      return;
    }

    sendJson(response, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`SaveVideo server listening on http://127.0.0.1:${PORT}`);
});
