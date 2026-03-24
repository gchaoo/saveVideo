import test from 'node:test';
import assert from 'node:assert/strict';

import { detectPlatform, normalizeVideoInput } from '../src/platforms.js';

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

test('normalizeVideoInput extracts url from share text', () => {
  assert.equal(
    normalizeVideoInput('复制打开抖音，看看【李什么闯的作品】《关于公司管理人员多这件事》 # 内容过于真实 #... https://v.douyin.com/Gl4Ia01_LWo/ dnq:/ 08/30 z@g.Bt'),
    'https://v.douyin.com/Gl4Ia01_LWo/'
  );
});

test('detectPlatform identifies douyin share text after normalization', () => {
  assert.deepEqual(
    detectPlatform('复制打开抖音，看看【李什么闯的作品】《关于公司管理人员多这件事》 # 内容过于真实 #... https://v.douyin.com/Gl4Ia01_LWo/ dnq:/ 08/30 z@g.Bt'),
    {
      id: 'douyin',
      label: '抖音'
    }
  );
});
