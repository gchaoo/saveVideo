import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { detectPlatform } from './platforms.js';

export const WEB_MEDIA_DIR = path.resolve('.cache', 'media');
export const DEFAULT_OUTPUT_DIR = '/Users/gch/Downloads';
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome',
  'chromium',
  'chromium-browser'
].filter(Boolean);
const DESKTOP_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
};
const DOUYIN_HEADLESS_VIRTUAL_TIME_BUDGETS_MS = [1000, 3000, 8000];

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '--:--';
  }

  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function parseJsonLines(output) {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // keep scanning
    }
  }

  return null;
}

async function findDownloadedFile(id, outputDir) {
  const files = await fs.readdir(outputDir);
  const match = files.find((file) => file.startsWith(`${id}.`) && !file.endsWith('.part') && !file.endsWith('.info.json'));

  if (!match) {
    throw new Error('下载完成，但未找到输出文件');
  }

  return match;
}

function inferType(filename, info) {
  const extension = path.extname(filename).slice(1).toUpperCase();

  if (extension) {
    return extension;
  }

  return String(info.ext || 'MP4').toUpperCase();
}

function buildSourceLabel(platform) {
  if (platform.id === 'direct') {
    return '公开网页视频直链';
  }

  return `${platform.label} 解析结果`;
}

function parseJsonCandidate(rawValue) {
  if (!rawValue) {
    return null;
  }

  const candidate = rawValue.trim();

  if (!candidate) {
    return null;
  }

  const variants = [candidate];

  try {
    variants.push(decodeURIComponent(candidate));
  } catch {
    // ignore decode failure
  }

  for (const value of variants) {
    try {
      return JSON.parse(value);
    } catch {
      // keep trying
    }
  }

  return null;
}

function extractScriptBlock(html, pattern) {
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

function extractScriptBlocks(html) {
  return Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), (match) => match[1]);
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function pickFirstNonEmpty(values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function inferExtFromUrl(mediaUrl) {
  try {
    const parsed = new URL(mediaUrl);
    const extension = path.extname(parsed.pathname).slice(1).toLowerCase();
    return extension || 'mp4';
  } catch {
    return 'mp4';
  }
}

function stripDouyinTitleSuffix(title) {
  return title.replace(/\s*-\s*抖音\s*$/, '').trim();
}

function extractAssignedJson(scriptContent, assignmentName) {
  const assignmentIndex = scriptContent.indexOf(assignmentName);

  if (assignmentIndex === -1) {
    return null;
  }

  const startIndex = scriptContent.indexOf('{', assignmentIndex);

  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = startIndex; index < scriptContent.length; index += 1) {
    const character = scriptContent[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = '';
      }

      continue;
    }

    if (character === '"' || character === '\'') {
      quote = character;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return scriptContent.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function findDouyinItem(payload) {
  const queue = [payload];
  const visited = new Set();

  while (queue.length > 0) {
    const node = queue.shift();

    if (!node || typeof node !== 'object' || visited.has(node)) {
      continue;
    }

    visited.add(node);

    if (Array.isArray(node.item_list) && node.item_list[0]?.video) {
      return node.item_list[0];
    }

    if (node.video && (node.desc || node.title || node.share_title)) {
      return node;
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
}

export function normalizeDouyinVideoUrl(rawUrl) {
  if (!rawUrl) {
    return '';
  }

  return rawUrl.replace('/playwm/', '/play/');
}

function buildDouyinPlayUrl(uri) {
  return `https://www.douyin.com/aweme/v1/play/?video_id=${encodeURIComponent(uri)}&ratio=1080p&line=0`;
}

function pickDouyinPlaybackUrl(video) {
  if (!video || typeof video !== 'object') {
    return '';
  }

  const bitrateCandidates = [
    ...(Array.isArray(video.bit_rate) ? video.bit_rate : []),
    ...(Array.isArray(video.bitRate) ? video.bitRate : []),
    ...(Array.isArray(video.bitRateList) ? video.bitRateList : [])
  ];

  const streamCandidates = [
    ...bitrateCandidates,
    video.play_addr,
    video.playAddr,
    video.download_addr,
    video.downloadAddr
  ];

  for (const candidate of streamCandidates) {
    if (!candidate) {
      continue;
    }

    const uri = candidate.uri || candidate.video_id || candidate.videoId;

    if (typeof uri === 'string' && uri) {
      return buildDouyinPlayUrl(uri);
    }

    const urlList = Array.isArray(candidate.url_list)
      ? candidate.url_list
      : Array.isArray(candidate.urlList)
        ? candidate.urlList
        : [];

    const firstUrl = urlList.find((url) => typeof url === 'string' && url);

    if (firstUrl) {
      return normalizeDouyinVideoUrl(firstUrl);
    }
  }

  return '';
}

function normalizeDouyinDuration(duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  return duration > 1000 ? duration / 1000 : duration;
}

export function extractDouyinMediaMetadata(html) {
  const renderData = parseJsonCandidate(
    extractScriptBlock(html, /<script[^>]*id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/i)
  );

  const routerData = extractScriptBlocks(html)
    .map((scriptBlock) => parseJsonCandidate(extractAssignedJson(scriptBlock, 'window._ROUTER_DATA')))
    .find(Boolean);

  const payload = renderData || routerData;

  if (!payload) {
    throw new Error('未找到抖音页面数据');
  }

  const item = findDouyinItem(payload);

  if (!item?.video) {
    throw new Error('未找到抖音视频信息');
  }

  const videoUrl = pickDouyinPlaybackUrl(item.video);

  if (!videoUrl) {
    throw new Error('未找到抖音视频地址');
  }

  return {
    title: item.desc || item.title || item.share_title || '抖音视频',
    duration: normalizeDouyinDuration(item.video.duration || item.duration),
    videoUrl
  };
}

export function extractDouyinRenderedMediaMetadata(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const sourceMatches = Array.from(
    html.matchAll(/<source[^>]+src="([^"]+)"/gi),
    (match) => decodeHtmlAttribute(match[1])
  ).filter(Boolean);

  const videoUrl =
    sourceMatches.find((candidate) => /douyin\.com\/aweme\/v1\/play/i.test(candidate)) ||
    sourceMatches[0] ||
    '';

  if (!videoUrl) {
    throw new Error('未找到抖音渲染后的视频地址');
  }

  return {
    title: stripDouyinTitleSuffix(titleMatch?.[1] || '抖音视频'),
    duration: 0,
    videoUrl
  };
}

export function extractGenericMediaMetadata(html) {
  const title =
    pickFirstNonEmpty([
      extractScriptBlock(html, /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i),
      extractScriptBlock(html, /<meta[^>]+name="title"[^>]+content="([^"]+)"/i),
      extractScriptBlock(html, /<title>([\s\S]*?)<\/title>/i)
    ]) || '公开页面媒体';

  const mediaCandidates = [
    ...Array.from(html.matchAll(/<(?:video|audio)[^>]+src="([^"]+)"/gi), (match) => decodeHtmlAttribute(match[1])),
    ...Array.from(html.matchAll(/<source[^>]+src="([^"]+)"/gi), (match) => decodeHtmlAttribute(match[1])),
    ...Array.from(
      html.matchAll(/https?:\/\/[^"'<>\\\s]+?\.(?:mp4|m3u8|mp3)(?:\?[^"'<>\\\s]*)?/gi),
      (match) => decodeHtmlAttribute(match[0])
    )
  ].filter(Boolean);

  const mediaUrl = mediaCandidates.find((candidate) => /^https?:\/\//i.test(candidate)) || '';

  if (!mediaUrl) {
    throw new Error('未找到公开页面中的可播放媒体地址');
  }

  return {
    title: title.trim(),
    duration: 0,
    mediaUrl,
    ext: inferExtFromUrl(mediaUrl)
  };
}

async function dumpDomWithHeadlessChrome(url) {
  let lastError = null;

  for (const virtualTimeBudgetMs of getHeadlessChromeVirtualTimeBudgets()) {
    for (const chromeBinary of CHROME_CANDIDATES) {
      try {
        return await new Promise((resolve, reject) => {
          const stdoutChunks = [];
          const stderrChunks = [];
          const child = spawn(chromeBinary, getHeadlessChromeArgs(url, virtualTimeBudgetMs), { cwd: process.cwd() });

          child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
          child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
          child.on('error', reject);
          child.on('close', (code) => {
            if (code === 0) {
              resolve(Buffer.concat(stdoutChunks).toString('utf8'));
              return;
            }

            const errorText = Buffer.concat(stderrChunks).toString('utf8').trim();
            reject(new Error(errorText || `${chromeBinary} exited with code ${code}`));
          });
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error('未找到可用的 Chrome/Chromium');
}

export function getHeadlessChromeVirtualTimeBudgets() {
  return [...DOUYIN_HEADLESS_VIRTUAL_TIME_BUDGETS_MS];
}

export function getHeadlessChromeArgs(url, virtualTimeBudgetMs = DOUYIN_HEADLESS_VIRTUAL_TIME_BUDGETS_MS[0]) {
  return [
    '--headless=new',
    '--disable-gpu',
    `--virtual-time-budget=${virtualTimeBudgetMs}`,
    '--dump-dom',
    url
  ];
}

async function downloadRemoteFile(url, outputPath, headers = {}) {
  const response = await fetch(url, {
    headers,
    redirect: 'follow'
  });

  if (!response.ok || !response.body) {
    throw new Error(`下载视频失败: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
}

async function resolveDouyinVideo(rawUrl, outputDir) {
  const pageResponse = await fetch(rawUrl, {
    headers: DESKTOP_HEADERS,
    redirect: 'follow'
  });

  if (!pageResponse.ok) {
    throw new Error(`抖音页面访问失败: ${pageResponse.status} ${pageResponse.statusText}`);
  }

  const pageHtml = await pageResponse.text();
  let metadata;

  try {
    metadata = extractDouyinMediaMetadata(pageHtml);
  } catch {
    const renderedHtml = await dumpDomWithHeadlessChrome(pageResponse.url || rawUrl);
    metadata = extractDouyinRenderedMediaMetadata(renderedHtml);
  }

  const requestId = randomUUID();
  const outputFile = `${requestId}.mp4`;
  const outputPath = path.join(outputDir, outputFile);

  await downloadRemoteFile(metadata.videoUrl, outputPath, {
    'user-agent': DESKTOP_HEADERS['user-agent'],
    referer: pageResponse.url
  });

  return buildResolvedMediaResult({
    rawUrl: pageResponse.url || rawUrl,
    info: {
      title: metadata.title,
      duration: metadata.duration,
      ext: 'mp4'
    },
    outputFile,
    outputDir
  });
}

async function resolveGenericMedia(rawUrl, outputDir) {
  const pageResponse = await fetch(rawUrl, {
    headers: DESKTOP_HEADERS,
    redirect: 'follow'
  });

  if (!pageResponse.ok) {
    throw new Error(`公开页面访问失败: ${pageResponse.status} ${pageResponse.statusText}`);
  }

  const pageHtml = await pageResponse.text();
  let metadata;

  try {
    metadata = extractGenericMediaMetadata(pageHtml);
  } catch {
    const renderedHtml = await dumpDomWithHeadlessChrome(pageResponse.url || rawUrl);
    metadata = extractGenericMediaMetadata(renderedHtml);
  }

  const requestId = randomUUID();
  const outputFile = `${requestId}.${metadata.ext}`;
  const outputPath = path.join(outputDir, outputFile);

  await downloadRemoteFile(metadata.mediaUrl, outputPath, {
    'user-agent': DESKTOP_HEADERS['user-agent'],
    referer: pageResponse.url || rawUrl
  });

  return buildResolvedMediaResult({
    rawUrl: pageResponse.url || rawUrl,
    info: {
      title: metadata.title,
      duration: metadata.duration,
      ext: metadata.ext
    },
    outputFile,
    outputDir
  });
}

export function buildResolvedMediaResult({ rawUrl, info, outputFile, outputDir }) {
  const platform = detectPlatform(rawUrl);

  return {
    title: info.fulltitle || info.title || outputFile,
    duration: formatDuration(info.duration),
    type: inferType(outputFile, info),
    expiresIn: '24h 后失效',
    source: buildSourceLabel(platform),
    platform: platform.id,
    fileName: outputFile,
    localFilePath: path.join(outputDir, outputFile)
  };
}

export function buildHttpResolveResult(media) {
  return {
    ...media,
    previewUrl: `/media/${encodeURIComponent(media.fileName)}`,
    downloadUrl: `/media/${encodeURIComponent(media.fileName)}?download=1`
  };
}

export async function resolveVideo(rawUrl, { outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  await fs.mkdir(outputDir, { recursive: true });

  const platform = detectPlatform(rawUrl);

  if (platform.id === 'douyin') {
    return resolveDouyinVideo(rawUrl, outputDir);
  }

  if (platform.id === 'generic') {
    return resolveGenericMedia(rawUrl, outputDir);
  }

  const requestId = randomUUID();
  const outputTemplate = path.join(outputDir, `${requestId}.%(ext)s`);
  const args = buildYtDlpArgs({ rawUrl, outputTemplate, platform });

  const stdoutChunks = [];
  const stderrChunks = [];

  await new Promise((resolve, reject) => {
    const child = spawn('python3', args, { cwd: process.cwd() });

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(Buffer.concat(stderrChunks).toString('utf8').trim() || `yt-dlp exited with code ${code}`));
    });
  });

  const info = parseJsonLines(Buffer.concat(stdoutChunks).toString('utf8'));

  if (!info) {
    throw new Error('解析成功，但未返回媒体信息');
  }

  const outputFile = await findDownloadedFile(requestId, outputDir);

  return buildResolvedMediaResult({
    rawUrl,
    info,
    outputFile,
    outputDir
  });
}

export function buildYtDlpArgs({ rawUrl, outputTemplate, platform = detectPlatform(rawUrl) }) {
  const args = [
    '-m',
    'yt_dlp',
    '--no-playlist',
    '--no-warnings',
    '--print-json',
    '--no-progress',
    '--newline',
    '--restrict-filenames',
    '--merge-output-format',
    'mp4'
  ];

  if (platform.id === 'bilibili') {
    // 优先拿系统和浏览器更容易直接预览的 H.264/AAC 组合，避免落到 AV1 兼容性坑里。
    args.push('-S', 'vcodec:h264,acodec:aac');
  }

  args.push('-o', outputTemplate, rawUrl);

  return args;
}
