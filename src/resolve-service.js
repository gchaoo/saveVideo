import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { detectPlatform } from './platforms.js';

const MEDIA_DIR = path.resolve('.cache', 'media');

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

async function findDownloadedFile(id) {
  const files = await fs.readdir(MEDIA_DIR);
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

export function buildResolveResult({ rawUrl, info, outputFile }) {
  const platform = detectPlatform(rawUrl);

  return {
    title: info.fulltitle || info.title || outputFile,
    duration: formatDuration(info.duration),
    type: inferType(outputFile, info),
    expiresIn: '24h 后失效',
    source: buildSourceLabel(platform),
    previewUrl: `/media/${encodeURIComponent(outputFile)}`,
    downloadUrl: `/media/${encodeURIComponent(outputFile)}?download=1`,
    platform: platform.id
  };
}

export async function resolveVideo(rawUrl) {
  await fs.mkdir(MEDIA_DIR, { recursive: true });

  const requestId = randomUUID();
  const outputTemplate = path.join(MEDIA_DIR, `${requestId}.%(ext)s`);

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
    'mp4',
    '-o',
    outputTemplate,
    rawUrl
  ];

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

  const outputFile = await findDownloadedFile(requestId);

  return buildResolveResult({
    rawUrl,
    info,
    outputFile
  });
}
