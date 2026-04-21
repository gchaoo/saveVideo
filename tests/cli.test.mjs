import test from 'node:test';
import assert from 'node:assert/strict';

import { runCli } from '../src/cli.js';

function createWritableBuffer() {
  let value = '';

  return {
    write(chunk) {
      value += String(chunk);
    },
    toString() {
      return value;
    }
  };
}

test('runCli resolves a link and prints shared result json', async () => {
  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();
  const calls = [];

  const exitCode = await runCli({
    argv: ['resolve', 'https://www.bilibili.com/video/BV1e8wDzQE7T'],
    stdout,
    stderr,
    resolveFn: async (url, options) => {
      calls.push({ url, options });
      return {
        title: 'Demo',
        duration: '01:00',
        type: 'MP4',
        expiresIn: '24h 后失效',
        source: 'Bilibili 解析结果',
        platform: 'bilibili',
        fileName: 'demo.mp4',
        localFilePath: '/Users/gch/Downloads/demo.mp4'
      };
    }
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.toString(), '');
  assert.deepEqual(calls, [
    {
      url: 'https://www.bilibili.com/video/BV1e8wDzQE7T',
      options: { outputDir: '/Users/gch/Downloads' }
    }
  ]);
  assert.deepEqual(JSON.parse(stdout.toString()), {
    title: 'Demo',
    duration: '01:00',
    type: 'MP4',
    expiresIn: '24h 后失效',
    source: 'Bilibili 解析结果',
    platform: 'bilibili',
    fileName: 'demo.mp4',
    localFilePath: '/Users/gch/Downloads/demo.mp4'
  });
});

test('runCli rejects empty resolve input', async () => {
  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();

  const exitCode = await runCli({
    argv: ['resolve', ''],
    stdout,
    stderr,
    resolveFn: async () => {
      throw new Error('should not be called');
    }
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.toString(), '');
  assert.match(stderr.toString(), /请输入视频链接/);
});
