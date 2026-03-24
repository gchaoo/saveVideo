import { renderApp } from './render.js';
import { createViewModel } from './ui-state.js';

const root = document.querySelector('#app');

let state = {
  status: 'idle',
  inputValue: '',
  activeStep: 1,
  failedStep: 1,
  errorMessage: '',
  media: null
};

let pendingTimers = [];

function clearTimers() {
  pendingTimers.forEach((timer) => window.clearTimeout(timer));
  pendingTimers = [];
}

function schedule(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  pendingTimers.push(timer);
}

function setState(nextState) {
  state = {
    ...state,
    ...nextState
  };

  render();
}

function getView() {
  return createViewModel({
    status: state.status,
    inputValue: state.inputValue,
    activeStep: state.activeStep,
    failedStep: state.failedStep,
    errorMessage: state.errorMessage,
    media: state.media || undefined
  });
}

function render() {
  root.innerHTML = renderApp(getView());

  const input = root.querySelector('#source-url');
  const resolveButton = root.querySelector('#resolve-button');
  const downloadButton = root.querySelector('[data-action="download"]');
  const copyButton = root.querySelector('[data-action="copy"]');
  const retryButton = root.querySelector('[data-action="retry"]');

  if (input) {
    input.addEventListener('input', (event) => {
      setState({
        inputValue: event.target.value
      });
    });
  }

  if (resolveButton) {
    resolveButton.addEventListener('click', startResolveFlow);
  }

  if (downloadButton) {
    downloadButton.addEventListener('click', () => {
      if (!state.media?.downloadUrl) {
        return;
      }

      window.open(state.media.downloadUrl, '_blank', 'noopener');
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      if (!state.media?.downloadUrl) {
        return;
      }

      try {
        await navigator.clipboard.writeText(state.media.downloadUrl);
      } catch {
        window.prompt('复制下载链接', state.media.downloadUrl);
      }
    });
  }

  if (retryButton) {
    retryButton.addEventListener('click', () => {
      clearTimers();
      setState({
        status: 'idle',
        activeStep: 1,
        failedStep: 1,
        errorMessage: '',
        media: null
      });
    });
  }
}

async function startResolveFlow() {
  const url = state.inputValue.trim();

  if (!url || state.status === 'processing') {
    return;
  }

  clearTimers();
  setState({
    status: 'processing',
    activeStep: 1,
    failedStep: 1,
    errorMessage: '',
    media: null
  });

  schedule(() => {
    setState({ activeStep: 2 });
  }, 700);

  try {
    const response = await fetch('/api/resolve', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    const payload = await response.json();

    if (!response.ok) {
      clearTimers();
      setState({
        status: 'error',
        failedStep: 2,
        errorMessage: payload.error || '未找到可用视频或转码失败',
        media: null
      });
      return;
    }

    clearTimers();
    setState({
      status: 'success',
      activeStep: 3,
      errorMessage: '',
      media: payload
    });
  } catch {
    clearTimers();
    setState({
      status: 'error',
      failedStep: 2,
      errorMessage: '解析请求失败，请稍后重试'
    });
  }
}

render();
