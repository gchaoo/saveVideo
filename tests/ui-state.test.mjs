import test from 'node:test';
import assert from 'node:assert/strict';

import { createViewModel } from '../src/ui-state.js';
import { renderStepOne, renderResultSection } from '../src/render.js';

test('empty state shows placeholder and disables result actions', () => {
  const view = createViewModel({
    status: 'idle',
    inputValue: ''
  });

  assert.equal(view.inputDisplay, '支持 Bilibili / 抖音 / 小红书 / mp4 / m3u8');
  assert.equal(view.inputHasValue, false);
  assert.equal(view.primaryActionLabel, '开始解析');
  assert.equal(view.primaryActionDisabled, false);
  assert.deepEqual(
    view.steps.map((step) => step.state),
    ['idle', 'idle', 'idle']
  );
  assert.equal(view.result.showPlayer, false);
  assert.equal(view.result.showError, false);
  assert.equal(view.result.actions.download.enabled, false);
  assert.equal(view.result.actions.retry.visible, false);
});

test('processing state keeps layout stable and advances the active step', () => {
  const view = createViewModel({
    status: 'processing',
    inputValue: 'https://example.com/video-page',
    activeStep: 2
  });

  assert.equal(view.inputDisplay, 'https://example.com/video-page');
  assert.equal(view.inputHasValue, true);
  assert.equal(view.primaryActionLabel, '解析中...');
  assert.equal(view.primaryActionDisabled, true);
  assert.deepEqual(
    view.steps.map((step) => step.state),
    ['done', 'active', 'idle']
  );
  assert.equal(view.result.showPlayer, false);
  assert.equal(view.result.showSkeleton, true);
  assert.equal(view.result.actions.download.enabled, false);
});

test('success state enables preview and download actions', () => {
  const view = createViewModel({
    status: 'success',
    inputValue: 'https://example.com/video-page',
    media: {
      title: 'sample-video.mp4',
      duration: '01:28',
      type: 'MP4',
      expiresIn: '24h 后失效',
      source: '公开网页视频',
      previewUrl: '/media/sample-video.mp4',
      downloadUrl: '/media/sample-video.mp4?download=1'
    }
  });

  assert.deepEqual(
    view.steps.map((step) => step.state),
    ['done', 'done', 'done']
  );
  assert.equal(view.result.showPlayer, true);
  assert.equal(view.result.showError, false);
  assert.equal(view.result.meta.title, 'sample-video.mp4');
  assert.equal(view.result.actions.download.enabled, true);
  assert.equal(view.result.actions.copy.enabled, true);
  assert.equal(view.result.actions.retry.visible, true);
});

test('failure state hides player and shows retry action with error text', () => {
  const view = createViewModel({
    status: 'error',
    inputValue: 'https://example.com/video-page',
    failedStep: 2,
    errorMessage: '未找到可用视频或转码失败'
  });

  assert.deepEqual(
    view.steps.map((step) => step.state),
    ['done', 'error', 'idle']
  );
  assert.equal(view.result.showPlayer, false);
  assert.equal(view.result.showError, true);
  assert.equal(view.result.errorMessage, '未找到可用视频或转码失败');
  assert.equal(view.result.actions.download.enabled, false);
  assert.equal(view.result.actions.retry.visible, true);
});

test('step one render keeps input to the right of the title and uses placeholder before input', () => {
  const view = createViewModel({
    status: 'idle',
    inputValue: ''
  });

  const markup = renderStepOne(view);

  assert.match(markup, /<div class="step-one-header">[\s\S]*<div class="step-one-title">/);
  assert.match(markup, /<input[^>]+placeholder="支持 Bilibili \/ 抖音 \/ 小红书 \/ mp4 \/ m3u8"/);
  assert.match(markup, /<button[^>]*>开始解析<\/button>/);
});

test('result section render keeps preview on the left and action panel on the right', () => {
  const view = createViewModel({
    status: 'success',
    inputValue: 'https://example.com/video-page',
    media: {
      title: 'sample-video.mp4',
      duration: '01:28',
      type: 'MP4',
      expiresIn: '24h 后失效',
      source: '公开网页视频',
      previewUrl: '/media/sample-video.mp4',
      downloadUrl: '/media/sample-video.mp4?download=1'
    }
  });

  const markup = renderResultSection(view);

  assert.match(markup, /class="result-layout"/);
  assert.match(markup, /class="preview-panel(?: [^"]+)?"/);
  assert.match(markup, /class="result-side"/);
  assert.match(markup, /下载到本地/);
  assert.match(markup, /复制下载链接/);
  assert.match(markup, /重新解析/);
});

test('result section renders audio preview for audio files from public pages', () => {
  const view = createViewModel({
    status: 'success',
    inputValue: 'https://www.qianwen.com/efficiency/doc/transcripts/demo',
    media: {
      title: 'meeting-record.mp3',
      duration: '56:08',
      type: 'MP3',
      expiresIn: '24h 后失效',
      source: '公开网页视频解析结果',
      previewUrl: '/media/meeting-record.mp3',
      downloadUrl: '/media/meeting-record.mp3?download=1'
    }
  });

  const markup = renderResultSection(view);

  assert.match(markup, /class="preview-audio"/);
  assert.match(markup, /<audio[\s\S]*src="\/media\/meeting-record\.mp3"/);
});
