#!/usr/bin/env node
/**
 * ClawdbotCN 本地 CI/CD Webhook 服务器
 * 监听 Gitee Webhook，触发自动化构建
 */

const express = require('express');
const crypto = require('crypto');
const { spawn } = require('child_process');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

// 读取配置
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// 确保 logs 和 artifacts 目录存在
for (const dir of ['logs', 'artifacts', 'artifacts/windows', 'artifacts/macos']) {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const app = express();
app.use(express.json());

// 日志函数
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`),
};

// ── hostname 动态解析 ────────────────────────────────────────────────────────
// 解决 Windows 重启后 DHCP 重新分配 IP 的问题
// config.json 中 host 字段支持 hostname（如 KEVINSUN）或 IP
function resolveHost(host) {
  return new Promise((resolve) => {
    // 如果已经是 IP 格式，直接返回
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host === 'localhost') {
      return resolve(host);
    }
    // 尝试 DNS 解析 hostname → IP
    dns.lookup(host, { family: 4 }, (err, address) => {
      if (err) {
        log.warn(`DNS lookup failed for ${host}: ${err.message}, using hostname directly`);
        return resolve(host);
      }
      log.info(`Resolved ${host} → ${address}`);
      resolve(address);
    });
  });
}

// ── Gitee Webhook 签名验证 ───────────────────────────────────────────────────
// Gitee Webhook 密码模式：X-Gitee-Token header 直接等于配置的 secret
// Gitee 签名模式：timestamp + "\n" + secret 做 HMAC-SHA256 Base64
function verifyGiteeSignature(req) {
  const token = req.headers['x-gitee-token'];
  const timestamp = req.headers['x-gitee-timestamp'];

  // 方式1：密码模式 — token 直接等于 secret
  if (token === config.webhook.secret) {
    return true;
  }

  // 方式2：签名模式 — HMAC-SHA256(timestamp + "\n" + secret)
  if (token && timestamp) {
    const stringToSign = `${timestamp}\n${config.webhook.secret}`;
    const hmac = crypto.createHmac('sha256', config.webhook.secret);
    hmac.update(stringToSign);
    const computed = hmac.digest('base64');
    if (computed === token) {
      return true;
    }
  }

  return false;
}

// ── 构建并发锁 ──────────────────────────────────────────────────────────────
const buildLock = { windows: false, macos: false };

// 解析构建指令
function parseBuildInstructions(payload) {
  const instructions = {
    trigger: 'unknown',
    platform: 'all',
    mode: 'standard',
    version: null,
    validate: false,      // [validate] tag → 安装后验证
  };

  // Tag push
  if (payload.ref && payload.ref.startsWith('refs/tags/')) {
    instructions.trigger = 'tag';
    const tag = payload.ref.replace('refs/tags/', '');

    // 从 tag 提取版本号
    if (tag.startsWith('v')) {
      instructions.version = tag.substring(1);
    } else if (tag.startsWith('release-')) {
      instructions.version = tag.substring(8);
    }

    // Tag 触发全平台构建
    instructions.platform = 'all';
    instructions.mode = 'standard';

    log.info(`Tag push detected: ${tag} → version ${instructions.version}`);
    return instructions;
  }

  // Branch push
  if (payload.ref && payload.ref.startsWith('refs/heads/')) {
    instructions.trigger = 'push';
    const branch = payload.ref.replace('refs/heads/', '');

    // 检查是否是配置的分支
    if (!config.webhook.auto_trigger.branches.includes(branch)) {
      log.info(`Branch ${branch} not in auto-trigger list, skipping`);
      return null;
    }

    // 分析最新 commit message
    const commits = payload.commits || [];
    if (commits.length > 0) {
      const lastCommit = commits[commits.length - 1];
      const message = lastCommit.message || '';

      // 检查是否包含 [build]、[build xxx]、[ci]
      if (!message.match(/\[build[\s\]]/i) && !message.match(/\[ci\]/i)) {
        log.info(`No [build] tag in commit message, skipping`);
        return null;
      }

      // 从 commit message 推断平台
      // [build windows] = 只打 Windows, [build macos] = 只打 macOS
      // [build] 或 [ci] 不指定平台 = 默认双平台并行
      if (message.match(/\[build\s+windows\]/i) || message.match(/\bwindows\s+only\b/i)) {
        instructions.platform = 'windows';
      } else if (message.match(/\[build\s+macos\]/i) || message.match(/\[build\s+mac\]/i) || message.match(/\bmacos\s+only\b/i)) {
        instructions.platform = 'macos';
      } else {
        instructions.platform = 'all'; // 默认双平台并行
      }

      // 检查是否是 full 模式
      if (message.match(/\[full\]/i)) {
        instructions.mode = 'full';
      }

      // 检查是否需要安装后验证 [validate]
      if (message.match(/\[validate\]/i)) {
        instructions.validate = true;
      }

      log.info(`Commit message: "${message}"`);
      log.info(`Build instructions: platform=${instructions.platform}, mode=${instructions.mode}, validate=${instructions.validate}`);
    }

    return instructions;
  }

  return null;
}

// 构建参数列表（统一使用命名参数，与 trigger-build.sh 一致）
function buildArgs(platform, instructions, extraFlags = []) {
  const args = [];
  if (platform === 'macos') {
    if (instructions.version) args.push('--version', instructions.version);
    args.push('--arch', 'universal');
    if (instructions.validate) args.push('--validate-full');
  } else {
    // Windows: 位置参数 VERSION MODE
    args.push(instructions.version || '', instructions.mode || 'standard');
  }
  args.push(...extraFlags);
  return args;
}

// 执行远程构建
function executeBuild(platform, instructions, extraFlags = []) {
  return new Promise((resolve, reject) => {
    const builderConfig = config.builders[platform];

    if (!builderConfig || !builderConfig.enabled) {
      log.warn(`Builder ${platform} is not configured or disabled`);
      return resolve({ success: false, reason: 'disabled' });
    }

    // 检查并发锁
    if (buildLock[platform]) {
      log.warn(`Builder ${platform} is already running, skipping`);
      return resolve({ success: false, reason: 'already_running' });
    }
    buildLock[platform] = true;

    log.info(`Starting build on ${platform} (${builderConfig.host})...`);

    const scriptPath = path.join(__dirname, `build-${platform}.sh`);
    const args = buildArgs(platform, instructions, extraFlags);

    const child = spawn('bash', [scriptPath, ...args], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logFile = path.join(__dirname, 'logs', `build-${platform}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n\n=== Build started: ${new Date().toISOString()} ===\n`);

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    let settled = false;

    // 超时控制 — 正常完成时清除定时器，避免 Promise 双重 settle
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        buildLock[platform] = false;
        child.kill();
        log.error(`Build ${platform} timeout after ${builderConfig.timeout}s`);
        logStream.end();
        reject({ success: false, platform, reason: 'timeout' });
      }
    }, builderConfig.timeout * 1000);

    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      buildLock[platform] = false;
      logStream.end();

      if (code === 0) {
        log.info(`Build ${platform} completed successfully`);
        resolve({ success: true, platform, code });
      } else {
        log.error(`Build ${platform} failed with code ${code}`);
        reject({ success: false, platform, code });
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      buildLock[platform] = false;
      logStream.end();
      log.error(`Build ${platform} error: ${err.message}`);
      reject({ success: false, platform, error: err.message });
    });
  });
}

// Webhook 端点
app.post('/webhook', async (req, res) => {
  log.info('Received webhook request');

  // 验证签名
  if (!verifyGiteeSignature(req)) {
    log.warn('Invalid webhook signature');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const payload = req.body;

  // 解析构建指令
  const instructions = parseBuildInstructions(payload);
  if (!instructions) {
    log.info('No build instructions, skipping');
    return res.json({ message: 'No build triggered' });
  }

  // 立即返回响应（避免 Gitee 超时）
  res.json({ message: 'Build triggered', instructions });

  // 异步执行构建
  try {
    if (instructions.platform === 'all') {
      // ── 双平台并行构建 + 串行 deploy ──
      // 构建阶段并行（SSH 到不同机器，完全独立），
      // OSS 上传阶段串行（OSS 无法并发上传同一版本）。
      const platforms = ['windows', 'macos'].filter(p => config.builders[p].enabled);

      // ── 预确定版本号（避免并行 bump 竞态） ──
      // 并行模式下两个 builder 同时 auto bump 会产生竞态（各自 bump 得到不同版本号）。
      // 如果 webhook 没有传入版本号，在启动构建前从 package.json 读取并 patch +1。
      if (!instructions.version) {
        try {
          const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
          const parts = pkgJson.version.split('.');
          parts[2] = String(Number(parts[2]) + 1);
          instructions.version = parts.join('.');
          log.info(`Pre-determined version for parallel build: ${pkgJson.version} → ${instructions.version}`);
        } catch (e) {
          log.warn(`Cannot read package.json for version pre-bump: ${e.message}`);
        }
      }

      // Phase 1: 并行构建（跳过 deploy）
      log.info(`Phase 1: Parallel build for ${platforms.join(', ')} (--skip-deploy)`);

      const buildResults = await Promise.allSettled(
        platforms.map(p => executeBuild(p, instructions, ['--skip-deploy']))
      );

      const buildSuccess = [];
      buildResults.forEach((result, i) => {
        const platform = platforms[i];
        if (result.status === 'fulfilled' && result.value.success) {
          log.info(`${platform} build completed`);
          buildSuccess.push(platform);
        } else {
          log.error(`${platform} build failed`);
        }
      });

      // Phase 2: 串行 deploy（只 deploy 构建成功的平台）
      if (buildSuccess.length > 0) {
        log.info(`Phase 2: Sequential deploy for ${buildSuccess.join(', ')} (--deploy-only)`);
        for (const platform of buildSuccess) {
          try {
            log.info(`Deploying ${platform}...`);
            await executeBuild(platform, instructions, ['--deploy-only']);
            log.info(`${platform} deploy completed`);
          } catch (err) {
            log.error(`${platform} deploy failed: ${err.message || JSON.stringify(err)}`);
          }
        }
      }

      log.info('All builds completed');
    } else {
      // 单平台构建（含 deploy，无需并行保护）
      await executeBuild(instructions.platform, instructions);
    }
  } catch (err) {
    log.error(`Build execution error: ${err.message || JSON.stringify(err)}`);
  }
});

// 健康检查端点
app.get('/health', async (req, res) => {
  // 动态解析 builder host，展示实际可达 IP
  const builders = {};
  for (const [name, cfg] of Object.entries(config.builders)) {
    const resolved = await resolveHost(cfg.host);
    builders[name] = {
      enabled: cfg.enabled,
      host: cfg.host,
      resolved_ip: resolved,
      building: buildLock[name] || false,
    };
  }
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    builders,
  });
});

// 状态页面
app.get('/status', (req, res) => {
  const logsDir = path.join(__dirname, 'logs');
  const artifactsDir = path.join(__dirname, 'artifacts');

  const logs = fs.existsSync(logsDir)
    ? fs.readdirSync(logsDir).filter(f => f.endsWith('.log'))
    : [];

  const artifacts = {};
  if (fs.existsSync(artifactsDir)) {
    ['windows', 'macos'].forEach(platform => {
      const platformDir = path.join(artifactsDir, platform);
      if (fs.existsSync(platformDir)) {
        artifacts[platform] = fs.readdirSync(platformDir);
      }
    });
  }

  res.send(`
    <html>
      <head>
        <title>ClawdbotCN CI/CD Status</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .builder { margin: 10px 0; padding: 10px; background: #f5f5f5; }
          .enabled { color: green; }
          .disabled { color: red; }
          ul { list-style: none; padding: 0; }
          li { margin: 5px 0; }
        </style>
      </head>
      <body>
        <h1>ClawdbotCN CI/CD Status</h1>

        <div class="section">
          <h2>Builders</h2>
          ${Object.entries(config.builders).map(([name, cfg]) => `
            <div class="builder">
              <strong>${name}</strong>:
              <span class="${cfg.enabled ? 'enabled' : 'disabled'}">
                ${cfg.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <br>Host: ${cfg.host}
              <br>Building: ${buildLock[name] ? 'YES' : 'idle'}
            </div>
          `).join('')}
        </div>

        <div class="section">
          <h2>Recent Logs</h2>
          <ul>
            ${logs.map(l => `<li><a href="/logs/${encodeURIComponent(l)}">${l}</a></li>`).join('')}
          </ul>
        </div>

        <div class="section">
          <h2>Artifacts</h2>
          ${Object.entries(artifacts).map(([platform, files]) => `
            <h3>${platform}</h3>
            <ul>
              ${files.map(f => `<li>${f}</li>`).join('') || '<li>No artifacts</li>'}
            </ul>
          `).join('')}
        </div>
      </body>
    </html>
  `);
});

// 日志查看端点 — 防止路径遍历
app.get('/logs/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const logFile = path.join(__dirname, 'logs', safeName);

  if (!fs.existsSync(logFile)) {
    return res.status(404).send('Log file not found');
  }

  res.setHeader('Content-Type', 'text/plain');
  fs.createReadStream(logFile).pipe(res);
});

// 启动服务器
const port = config.webhook.port;
const host = config.webhook.host;

app.listen(port, host, () => {
  log.info(`Webhook server started`);
  log.info(`   Listening on: http://${host}:${port}`);
  log.info(`   Health check: http://localhost:${port}/health`);
  log.info(`   Status page: http://localhost:${port}/status`);
  log.info(`   Webhook URL: http://YOUR_IP:${port}/webhook`);

  // 启动时预解析所有 builder host
  Object.entries(config.builders).forEach(([name, cfg]) => {
    resolveHost(cfg.host).then(ip => {
      log.info(`   Builder ${name}: ${cfg.host} → ${ip}`);
    });
  });
});

// 优雅退出
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
