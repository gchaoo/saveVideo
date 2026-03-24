import test from 'node:test';
import assert from 'node:assert/strict';

import { detectPlatform } from '../src/platforms.js';

test('detectPlatform identifies bilibili links', () => {
  assert.deepEqual(detectPlatform('https://www.bilibili.com/video/BV1xx411c7mD'), {
    id: 'bilibili',
    label: 'Bilibili'
  });
});

test('detectPlatform identifies douyin links', () => {
  assert.deepEqual(detectPlatform('https://www.douyin.com/video/7422222222222222222'), {
    id: 'douyin',
    label: '抖音'
  });
});

test('detectPlatform identifies xiaohongshu links', () => {
  assert.deepEqual(detectPlatform('https://www.xiaohongshu.com/explore/66c123456789abcdef012345'), {
    id: 'xiaohongshu',
    label: '小红书'
  });
});

test('detectPlatform falls back to generic public page for unknown hosts', () => {
  assert.deepEqual(detectPlatform('https://example.com/watch/alpha'), {
    id: 'generic',
    label: '公开网页视频'
  });
});
