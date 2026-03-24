const PLATFORM_RULES = [
  { id: 'bilibili', pattern: /(^|\.)bilibili\.com$|(^|\.)b23\.tv$/i, label: 'Bilibili' },
  { id: 'douyin', pattern: /(^|\.)douyin\.com$|(^|\.)iesdouyin\.com$/i, label: '抖音' },
  { id: 'xiaohongshu', pattern: /(^|\.)xiaohongshu\.com$|(^|\.)xhslink\.com$/i, label: '小红书' }
];

export function detectPlatform(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return { id: 'invalid', label: '无效链接' };
  }

  const host = parsed.hostname.toLowerCase();
  const rule = PLATFORM_RULES.find(({ pattern }) => pattern.test(host));

  if (rule) {
    return { id: rule.id, label: rule.label };
  }

  if (/\.(mp4|m3u8)(?:$|\?)/i.test(parsed.pathname + parsed.search)) {
    return { id: 'direct', label: '直链视频' };
  }

  return { id: 'generic', label: '公开网页视频' };
}

export function isSupportedPlatform(rawUrl) {
  return detectPlatform(rawUrl).id !== 'invalid';
}
