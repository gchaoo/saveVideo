import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHttpResolveResult,
  buildResolvedMediaResult,
  buildYtDlpArgs,
  extractGenericMediaMetadata,
  extractDouyinMediaMetadata,
  extractDouyinRenderedMediaMetadata,
  getHeadlessChromeArgs,
  getHeadlessChromeVirtualTimeBudgets,
  normalizeDouyinVideoUrl
} from '../src/resolve-service.js';

test('buildResolvedMediaResult formats bilibili media response for shared core usage', () => {
  const result = buildResolvedMediaResult({
    rawUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    info: {
      title: 'Bilibili Test Video',
      duration: 92.4,
      ext: 'mp4'
    },
    outputFile: 'abc123.mp4',
    outputDir: '/Users/gch/Downloads'
  });

  assert.equal(result.title, 'Bilibili Test Video');
  assert.equal(result.duration, '01:32');
  assert.equal(result.type, 'MP4');
  assert.equal(result.source, 'Bilibili 解析结果');
  assert.equal(result.platform, 'bilibili');
  assert.equal(result.fileName, 'abc123.mp4');
  assert.equal(result.localFilePath, '/Users/gch/Downloads/abc123.mp4');
});

test('buildHttpResolveResult adds preview and download urls for web usage', () => {
  const result = buildHttpResolveResult({
    title: 'Bilibili Test Video',
    duration: '01:32',
    type: 'MP4',
    expiresIn: '24h 后失效',
    source: 'Bilibili 解析结果',
    platform: 'bilibili',
    fileName: 'abc123.mp4',
    localFilePath: '/Users/gch/worlspace/saveVideo/.cache/media/abc123.mp4'
  });

  assert.equal(result.previewUrl, '/media/abc123.mp4');
  assert.equal(result.downloadUrl, '/media/abc123.mp4?download=1');
  assert.equal(result.localFilePath, '/Users/gch/worlspace/saveVideo/.cache/media/abc123.mp4');
});

test('buildResolvedMediaResult formats direct video links as direct source', () => {
  const result = buildResolvedMediaResult({
    rawUrl: 'https://cdn.example.com/video.mp4',
    info: {
      title: 'Direct Source',
      duration: 10,
      ext: 'mp4'
    },
    outputFile: 'direct-file.mp4',
    outputDir: '/Users/gch/Downloads'
  });

  assert.equal(result.source, '公开网页视频直链');
  assert.equal(result.platform, 'direct');
  assert.equal(result.localFilePath, '/Users/gch/Downloads/direct-file.mp4');
});

test('extractDouyinMediaMetadata reads RENDER_DATA payload and builds a playable url', () => {
  const payload = {
    loaderData: {
      'video_(id)/page': {
        videoInfoRes: {
          item_list: [
            {
              desc: '抖音测试视频',
              video: {
                duration: 15800,
                play_addr: {
                  uri: 'v0300test',
                  url_list: [
                    'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v0300test&ratio=720p&line=0'
                  ]
                }
              }
            }
          ]
        }
      }
    }
  };

  const result = extractDouyinMediaMetadata(`
    <html>
      <body>
        <script id="RENDER_DATA" type="application/json">${encodeURIComponent(JSON.stringify(payload))}</script>
      </body>
    </html>
  `);

  assert.equal(result.title, '抖音测试视频');
  assert.equal(result.duration, 15.8);
  assert.equal(result.videoUrl, 'https://www.douyin.com/aweme/v1/play/?video_id=v0300test&ratio=1080p&line=0');
});

test('extractDouyinMediaMetadata reads window._ROUTER_DATA payload', () => {
  const payload = {
    loaderData: {
      'video_(id)/page': {
        videoInfoRes: {
          item_list: [
            {
              desc: '第二条抖音视频',
              video: {
                duration: 9.2,
                play_addr: {
                  url_list: [
                    'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v0500demo&ratio=540p'
                  ]
                }
              }
            }
          ]
        }
      }
    }
  };

  const result = extractDouyinMediaMetadata(`
    <script>
      window._ROUTER_DATA = ${JSON.stringify(payload)}
    </script>
  `);

  assert.equal(result.title, '第二条抖音视频');
  assert.equal(result.duration, 9.2);
  assert.equal(result.videoUrl, 'https://aweme.snssdk.com/aweme/v1/play/?video_id=v0500demo&ratio=540p');
});

test('normalizeDouyinVideoUrl removes watermark path', () => {
  assert.equal(
    normalizeDouyinVideoUrl('https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v0300watermark&ratio=720p'),
    'https://aweme.snssdk.com/aweme/v1/play/?video_id=v0300watermark&ratio=720p'
  );
});

test('extractDouyinRenderedMediaMetadata reads title and prefers aweme play source from rendered DOM', () => {
  const result = extractDouyinRenderedMediaMetadata(`
    <html>
      <head>
        <title>《关于公司管理人员多这件事》 #内容过于真实 - 抖音</title>
      </head>
      <body>
        <video>
          <source src="https://v26-web.douyinvod.com/example-expiring.mp4?token=one" type="">
          <source src="https://www.douyin.com/aweme/v1/play/?video_id=v0200fg10000d6ue1f7og65o45cdo790&amp;aid=6383&amp;__vid=7619212789407583530" type="">
        </video>
      </body>
    </html>
  `);

  assert.equal(result.title, '《关于公司管理人员多这件事》 #内容过于真实');
  assert.equal(
    result.videoUrl,
    'https://www.douyin.com/aweme/v1/play/?video_id=v0200fg10000d6ue1f7og65o45cdo790&aid=6383&__vid=7619212789407583530'
  );
});

test('extractGenericMediaMetadata reads audio source from a public transcript page', () => {
  const result = extractGenericMediaMetadata(`
    <html>
      <head>
        <meta property="og:title" content="千问实时记录">
      </head>
      <body>
        <audio src="https://cdn.example.com/media/session.mp3?token=abc"></audio>
      </body>
    </html>
  `);

  assert.deepEqual(result, {
    title: '千问实时记录',
    duration: 0,
    mediaUrl: 'https://cdn.example.com/media/session.mp3?token=abc',
    ext: 'mp3'
  });
});

test('buildYtDlpArgs prefers broadly compatible bilibili formats', () => {
  const args = buildYtDlpArgs({
    rawUrl: 'https://www.bilibili.com/video/BV1e8wDzQE7T',
    outputTemplate: '/tmp/demo.%(ext)s'
  });

  assert.deepEqual(args, [
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
    '-S',
    'vcodec:h264,acodec:aac',
    '-o',
    '/tmp/demo.%(ext)s',
    'https://www.bilibili.com/video/BV1e8wDzQE7T'
  ]);
});

test('getHeadlessChromeVirtualTimeBudgets retries with broader budgets after the fast path', () => {
  assert.deepEqual(getHeadlessChromeVirtualTimeBudgets(), [1000, 3000, 8000]);
});

test('getHeadlessChromeArgs builds fallback args with an explicit render budget', () => {
  const args = getHeadlessChromeArgs('https://www.douyin.com/video/7619212789407583530', 3000);

  assert.deepEqual(args, [
    '--headless=new',
    '--disable-gpu',
    '--virtual-time-budget=3000',
    '--dump-dom',
    'https://www.douyin.com/video/7619212789407583530'
  ]);
});
