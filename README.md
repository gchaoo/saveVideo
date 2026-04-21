# SaveVideo

SaveVideo 是一个单页的视频解析与下载工具，当前界面采用桌面端单屏布局：顶部信息、单行输入区、横向状态条、以及左预览右下载结果区都固定在同一个页面里，不跳转结果页。

## 当前能力

- 支持输入视频链接并调用后端解析接口
- 支持通过 CLI 直接解析并下载链接
- 页面内预览解析结果
- 下载到本地
- 当前平台识别覆盖：
  - `Bilibili`
  - `抖音`
  - `小红书`
  - `mp4 / m3u8` 直链
  - 其它公开网页视频链接

## 当前实现

- 前端：
  - 原生 `HTML + CSS + Vanilla JS`
  - 单页状态切换，不依赖前端框架
- 后端：
  - `Node.js` 原生 `http` 服务
  - `POST /api/resolve` 负责提交解析请求
  - `GET /media/:file` 提供预览和下载文件
- CLI：
  - `savevideo resolve "<url>"` 或 `node cli.js resolve "<url>"`
  - 默认将解析结果下载到 `/Users/gch/Downloads`
- 解析器：
  - 抖音优先走页面内嵌数据提取，直接下载可播放 `mp4`
  - 其它平台继续通过 `yt-dlp` 拉取平台视频
  - `yt-dlp` 需要时使用 `ffmpeg` 合并输出文件
  - 核心解析逻辑由 `src/resolve-service.js` 统一提供，网页和 CLI 共用一套实现
  - 网页入口默认写入项目内 `.cache/media/` 作为站内预览缓存
  - CLI 默认写入 `/Users/gch/Downloads`

## 页面结构

桌面端主界面固定为三段：

1. `步骤 1 输入链接`
2. `步骤 2 处理过程`
3. `步骤 3 / 4 预览与下载`

状态规则：

- 空态：输入框显示平台提示文案，结果区按钮禁用
- 处理中：按钮切到 `解析中...`，状态条从左到右推进
- 成功：左侧显示播放器，右侧显示信息和下载动作
- 失败：结果区显示错误提示，只保留重试动作

## 本地运行

要求：

- Node.js 24+
- Python 3.10+ 推荐
- `ffmpeg`
- `yt-dlp`

安装依赖：

```bash
/opt/homebrew/bin/python3.10 -m pip install --user yt-dlp curl-cffi
```

启动：

```bash
npm start
```

直接使用 CLI：

```bash
node cli.js resolve "https://www.bilibili.com/video/BV1e8wDzQE7T"
```

默认地址：

```bash
http://127.0.0.1:4173/
```

## 测试

运行测试：

```bash
npm test
```

当前测试覆盖：

- 平台识别
- 共核解析结果格式化
- 抖音页面内嵌数据提取与播放地址规范化
- CLI `resolve` 命令输出和错误处理
- 空态 / 处理中 / 成功 / 失败状态模型
- 单屏布局关键结构渲染

## 已知限制

- 平台视频解析依赖外部站点当前策略，成功率会受登录态、风控、地区和请求头影响
- 命令行网络栈在访问部分 Bilibili 页面时可能遇到 TLS 握手问题
- 小红书以及部分公开网页仍主要依赖通用解析链路，某些链接仍可能因平台校验失败
- 当前版本未接入持久任务队列、历史记录、账号体系和对象存储

## 目录结构

```text
.
├── cli.js
├── index.html
├── styles.css
├── server.js
├── src
│   ├── app.js
│   ├── cli.js
│   ├── platforms.js
│   ├── render.js
│   ├── resolve-service.js
│   └── ui-state.js
└── tests
    ├── cli.test.mjs
    ├── platforms.test.mjs
    ├── resolve-service.test.mjs
    └── ui-state.test.mjs
```
