#!/usr/bin/env node
/**
 * ClawdbotCN 本地 CI/CD Webhook 服务器
 * 监听 Gitee Webhook，触发自动化构建
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 读取配置
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const app = express();
app.use(bodyParser.json());

// 日志函数
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`),
};

// 验证 Gitee Webhook 签名
function verifyGiteeSignature(body, signature) {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', config.webhook.secret);
  hmac.update(JSON.stringify(body));
  const computed = hmac.digest('hex');

  return computed === signature;
}

// 解析构建指令
function parseBuildInstructions(payload) {
  const instructions = {
    trigger: 'unknown',
    platform: 'all',
    mode: 'standard',
    version: null,
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

      // 检查是否包含 [build] 或 [ci]
      if (!message.match(/\[build\]|\[ci\]/i)) {
        log.info(`No [build] tag in commit message, skipping`);
        return null;
      }

      // 从 commit message 推断平台
      if (message.match(/windows/i)) {
        instructions.platform = 'windows';
      } else if (message.match(/macos|mac/i)) {
        instructions.platform = 'macos';
      } else if (message.match(/linux/i)) {
        instructions.platform = 'linux';
      } else {
        instructions.platform = 'windows'; // 默认
      }

      // 检查是否是 full 模式
      if (message.match(/\[full\]/i)) {
        instructions.mode = 'full';
      }

      log.info(`Commit message: "${message}"`);
      log.info(`Build instructions: platform=${instructions.platform}, mode=${instructions.mode}`);
    }

    return instructions;
  }

  return null;
}

// 执行远程构建
function executeBuild(platform, instructions) {
  return new Promise((resolve, reject) => {
    const builderConfig = config.builders[platform];

    if (!builderConfig || !builderConfig.enabled) {
      log.warn(`Builder ${platform} is not configured or disabled`);
      return resolve({ success: false, reason: 'disabled' });
    }

    log.info(`Starting build on ${platform} (${builderConfig.host})...`);

    const scriptPath = path.join(__dirname, `build-${platform}.sh`);

    // 构建参数
    const args = [
      instructions.version || '',
      instructions.mode || 'standard',
    ];

    const child = spawn('bash', [scriptPath, ...args], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logFile = path.join(__dirname, 'logs', `build-${platform}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on('exit', (code) => {
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
      log.error(`Build ${platform} error: ${err.message}`);
      reject({ success: false, platform, error: err.message });
    });

    // 超时控制
    setTimeout(() => {
      child.kill('SIGTERM');
      log.error(`Build ${platform} timeout`);
      reject({ success: false, platform, reason: 'timeout' });
    }, builderConfig.timeout * 1000);
  });
}

// Webhook 端点
app.post('/webhook', async (req, res) => {
  log.info('Received webhook request');

  // 验证签名
  const signature = req.headers['x-gitee-token'];
  if (!verifyGiteeSignature(req.body, signature)) {
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
      // 并行构建所有平台
      const platforms = ['windows', 'macos'].filter(p => config.builders[p].enabled);

      log.info(`Triggering parallel build for platforms: ${platforms.join(', ')}`);

      const results = await Promise.allSettled(
        platforms.map(p => executeBuild(p, instructions))
      );

      results.forEach((result, i) => {
        const platform = platforms[i];
        if (result.status === 'fulfilled' && result.value.success) {
          log.info(`✅ ${platform} build completed`);
        } else {
          log.error(`❌ ${platform} build failed`);
        }
      });

      log.info('All builds completed');
    } else {
      // 单平台构建
      await executeBuild(instructions.platform, instructions);
    }
  } catch (err) {
    log.error(`Build execution error: ${err.message}`);
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    builders: Object.keys(config.builders).reduce((acc, name) => {
      acc[name] = {
        enabled: config.builders[name].enabled,
        host: config.builders[name].host,
      };
      return acc;
    }, {}),
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
        <h1>🚀 ClawdbotCN CI/CD Status</h1>

        <div class="section">
          <h2>Builders</h2>
          ${Object.entries(config.builders).map(([name, cfg]) => `
            <div class="builder">
              <strong>${name}</strong>:
              <span class="${cfg.enabled ? 'enabled' : 'disabled'}">
                ${cfg.enabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
              <br>Host: ${cfg.host}
            </div>
          `).join('')}
        </div>

        <div class="section">
          <h2>Recent Logs</h2>
          <ul>
            ${logs.map(log => `<li><a href="/logs/${log}">${log}</a></li>`).join('')}
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

// 日志查看端点
app.get('/logs/:filename', (req, res) => {
  const logFile = path.join(__dirname, 'logs', req.params.filename);

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
  log.info(`✅ Webhook server started`);
  log.info(`   Listening on: http://${host}:${port}`);
  log.info(`   Health check: http://localhost:${port}/health`);
  log.info(`   Status page: http://localhost:${port}/status`);
  log.info(`   Webhook URL: http://YOUR_IP:${port}/webhook`);
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
