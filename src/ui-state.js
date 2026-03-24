const STEP_LABELS = [
  { id: 1, title: '校验链接', description: '检查可访问性' },
  { id: 2, title: '提取并抓取', description: '解析并转存' },
  { id: 3, title: '文件就绪', description: '可预览下载' }
];

const DEFAULT_MEDIA = {
  title: '等待解析结果',
  duration: '--:--',
  type: '--',
  expiresIn: '24h 后失效',
  source: 'Bilibili / 抖音 / 小红书 / 公开网页视频',
  previewUrl: '',
  downloadUrl: ''
};

const INPUT_PLACEHOLDER = '支持 Bilibili / 抖音 / 小红书 / mp4 / m3u8';

function mapStepState(status, stepId, activeStep, failedStep) {
  if (status === 'idle') {
    return 'idle';
  }

  if (status === 'processing') {
    if (stepId < activeStep) {
      return 'done';
    }

    if (stepId === activeStep) {
      return 'active';
    }

    return 'idle';
  }

  if (status === 'success') {
    return 'done';
  }

  if (status === 'error') {
    if (stepId < failedStep) {
      return 'done';
    }

    if (stepId === failedStep) {
      return 'error';
    }

    return 'idle';
  }

  return 'idle';
}

export function createViewModel({
  status = 'idle',
  inputValue = '',
  activeStep = 1,
  failedStep = 1,
  errorMessage = '',
  media = DEFAULT_MEDIA
} = {}) {
  const hasValue = inputValue.trim().length > 0;
  const resolvedMedia = { ...DEFAULT_MEDIA, ...media };
  const steps = STEP_LABELS.map((step) => ({
    ...step,
    state: mapStepState(status, step.id, activeStep, failedStep)
  }));

  return {
    status,
    inputDisplay: hasValue ? inputValue : INPUT_PLACEHOLDER,
    inputHasValue: hasValue,
    primaryActionLabel: status === 'processing' ? '解析中...' : '开始解析',
    primaryActionDisabled: status === 'processing',
    steps,
    result: {
      showPlayer: status === 'success',
      showSkeleton: status === 'processing' || status === 'idle',
      showError: status === 'error',
      errorMessage,
      meta: resolvedMedia,
      actions: {
        download: {
          enabled: status === 'success' && Boolean(resolvedMedia.downloadUrl)
        },
        copy: {
          enabled: status === 'success' && Boolean(resolvedMedia.downloadUrl)
        },
        retry: {
          visible: status === 'success' || status === 'error'
        }
      }
    }
  };
}
