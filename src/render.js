function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderResultPreview(view) {
  if (view.result.showPlayer) {
    const isAudio = /^(MP3|M4A|AAC|WAV|OGG)$/i.test(view.result.meta.type);

    if (isAudio) {
      return `
        <div class="preview-panel is-player">
          <audio
            class="preview-audio"
            controls
            preload="metadata"
            src="${escapeHtml(view.result.meta.previewUrl)}"
          ></audio>
        </div>
      `;
    }

    return `
      <div class="preview-panel is-player">
        <video
          class="preview-video"
          controls
          playsinline
          preload="metadata"
          src="${escapeHtml(view.result.meta.previewUrl)}"
        ></video>
      </div>
    `;
  }

  if (view.result.showError) {
    return `
      <div class="preview-panel is-error">
        <div class="preview-empty">
          <div class="preview-empty-title">预览不可用</div>
          <div class="preview-empty-text">当前任务没有生成可播放文件</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="preview-panel ${view.result.showSkeleton ? 'is-skeleton' : ''}">
      <div class="preview-empty">
        <div class="preview-empty-title">视频播放器区域</div>
        <div class="preview-empty-text">解析完成后在这里预览视频</div>
      </div>
    </div>
  `;
}

function renderActionButton(label, kind, enabled = true, visible = true) {
  if (!visible) {
    return '';
  }

  const disabled = enabled ? '' : 'disabled';
  return `<button class="action-button ${kind}" type="button" data-action="${kind}" ${disabled}>${label}</button>`;
}

export function renderStepOne(view) {
  const inputValue = view.inputHasValue ? escapeHtml(view.inputDisplay) : '';
  const placeholder = view.inputHasValue ? '' : escapeHtml(view.inputDisplay);
  const disabled = view.primaryActionDisabled ? 'disabled' : '';

  return `
    <section class="panel panel-step panel-step-one">
      <div class="step-one-header">
        <div class="step-one-title">
          <div class="step-label">步骤 1</div>
          <h2>输入链接</h2>
        </div>
        <div class="step-one-input-wrap">
          <input
            id="source-url"
            class="source-input"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="${placeholder}"
            value="${inputValue}"
          >
        </div>
        <button class="primary-button" id="resolve-button" type="button" ${disabled}>${view.primaryActionLabel}</button>
      </div>
    </section>
  `;
}

export function renderStepTwo(view) {
  const items = view.steps
    .map(
      (step) => `
        <div class="process-item" data-step-state="${step.state}">
          <div class="process-index">${step.id}</div>
          <div class="process-copy">
            <div class="process-title">${step.title}</div>
            <div class="process-text">${step.description}</div>
          </div>
        </div>
      `
    )
    .join('');

  return `
    <section class="panel panel-step panel-step-two">
      <div class="step-two-layout">
        <div class="step-two-title">
          <div class="step-label">步骤 2</div>
          <h2>处理过程</h2>
        </div>
        <div class="process-row">
          ${items}
        </div>
      </div>
    </section>
  `;
}

export function renderResultSection(view) {
  const meta = view.result.meta;
  const errorBlock = view.result.showError
    ? `<div class="error-card">${escapeHtml(view.result.errorMessage || '未找到可用视频或转码失败')}</div>`
    : '';

  return `
    <section class="panel panel-step panel-result">
      <div class="result-header">
        <div>
          <div class="step-label">步骤 3 / 4</div>
          <h2>预览与下载</h2>
        </div>
        <div class="result-header-note">左预览，右信息与动作</div>
      </div>

      <div class="result-layout">
        ${renderResultPreview(view)}

        <div class="result-side">
          <div class="meta-card">
            <div class="meta-title">${escapeHtml(meta.title)}</div>
            <dl class="meta-list">
              <div><dt>时长</dt><dd>${escapeHtml(meta.duration)}</dd></div>
              <div><dt>类型</dt><dd>${escapeHtml(meta.type)}</dd></div>
              <div><dt>有效期</dt><dd>${escapeHtml(meta.expiresIn)}</dd></div>
              <div><dt>来源</dt><dd>${escapeHtml(meta.source)}</dd></div>
            </dl>
          </div>

          <div class="actions-card">
            <div class="actions-label">操作</div>
            ${errorBlock}
            <div class="actions-group">
              ${renderActionButton('下载到本地', 'download', view.result.actions.download.enabled)}
              ${renderActionButton('复制下载链接', 'copy', view.result.actions.copy.enabled)}
              ${renderActionButton('重新解析', 'retry', true, view.result.actions.retry.visible)}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderApp(view) {
  return `
    <header class="app-header">
      <div class="brand">
        <div class="brand-name">SaveVideo</div>
        <div class="brand-tagline">支持 Bilibili、抖音、小红书和公开视频链接解析、预览、下载</div>
      </div>
      <div class="header-badges">
        <span class="badge">内部工具</span>
        <span class="badge badge-outline">24h 自动清理</span>
      </div>
    </header>

    ${renderStepOne(view)}
    ${renderStepTwo(view)}
    ${renderResultSection(view)}
  `;
}
