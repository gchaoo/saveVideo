import { DEFAULT_OUTPUT_DIR, resolveVideo } from './resolve-service.js';

function writeLine(stream, value) {
  stream.write(`${value}\n`);
}

export async function runCli({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  resolveFn = resolveVideo
} = {}) {
  const [command, rawUrl] = argv;

  if (command !== 'resolve') {
    writeLine(stderr, '用法: savevideo resolve "<url>"');
    return 1;
  }

  const url = String(rawUrl || '').trim();

  if (!url) {
    writeLine(stderr, '请输入视频链接');
    return 1;
  }

  try {
    const result = await resolveFn(url, { outputDir: DEFAULT_OUTPUT_DIR });
    writeLine(stdout, JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    writeLine(stderr, String(error.message || error));
    return 1;
  }
}
