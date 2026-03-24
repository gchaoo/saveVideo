import test from 'node:test';
import assert from 'node:assert/strict';

import { buildResolveResult } from '../src/resolve-service.js';

test('buildResolveResult formats bilibili media response for local playback', () => {
  const result = buildResolveResult({
    rawUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    info: {
      title: 'Bilibili Test Video',
      duration: 92.4,
      ext: 'mp4'
    },
    outputFile: 'abc123.mp4'
  });

  assert.equal(result.title, 'Bilibili Test Video');
  assert.equal(result.duration, '01:32');
  assert.equal(result.type, 'MP4');
  assert.equal(result.source, 'Bilibili 解析结果');
  assert.equal(result.previewUrl, '/media/abc123.mp4');
  assert.equal(result.downloadUrl, '/media/abc123.mp4?download=1');
  assert.equal(result.platform, 'bilibili');
});

test('buildResolveResult formats direct video links as direct source', () => {
  const result = buildResolveResult({
    rawUrl: 'https://cdn.example.com/video.mp4',
    info: {
      title: 'Direct Source',
      duration: 10,
      ext: 'mp4'
    },
    outputFile: 'direct-file.mp4'
  });

  assert.equal(result.source, '公开网页视频直链');
  assert.equal(result.platform, 'direct');
});
