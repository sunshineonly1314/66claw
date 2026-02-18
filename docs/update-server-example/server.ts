/**
 * OpenClawCN Update Server
 *
 * 提供版本检查、增量计算、文件下载等更新服务
 *
 * Deploy: node --import tsx server.ts
 */

import express from "express";
import cors from "cors";
import compression from "compression";
import OSS from "ali-oss";

const app = express();

// 中间件
app.use(cors());
app.use(compression());
app.use(express.json());

// 阿里云 OSS 客户端
const oss = new OSS({
  region: process.env.ALIYUN_OSS_REGION || "oss-cn-hangzhou",
  bucket: process.env.ALIYUN_OSS_BUCKET || "openclawcn-updates",
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
});

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET /api/check-update
 *
 * 检查是否有可用的更新
 *
 * Query Params:
 *   - version: 当前版本号 (e.g., "2026.2.15")
 *   - platform: 平台 (windows/macos/linux)
 *
 * Response:
 *   {
 *     hasUpdate: boolean,
 *     current: string,
 *     latest?: string,
 *     downloadSize?: number,
 *     changelog?: object,
 *     releaseDate?: string,
 *     critical?: boolean
 *   }
 */
app.get("/api/check-update", async (req, res) => {
  try {
    const currentVersion = req.query.version as string;
    const platform = req.query.platform as string;

    if (!currentVersion) {
      return res.status(400).json({ error: "Missing version parameter" });
    }

    // 从 OSS 读取最新版本信息
    const latestObj = await oss.get("releases/latest.json");
    const latest = JSON.parse(latestObj.content.toString());

    // 没有更新
    if (latest.version === currentVersion) {
      return res.json({
        hasUpdate: false,
        current: currentVersion,
      });
    }

    // 有更新 - 读取详细信息
    const manifestObj = await oss.get(`releases/${latest.version}/manifest.json`);
    const manifest = JSON.parse(manifestObj.content.toString());

    // 尝试计算增量大小
    let downloadSize = manifest.files.size;  // 默认为完整包大小

    try {
      const deltaPath = `releases/${latest.version}/delta-from-${currentVersion}/delta.json`;
      const deltaObj = await oss.get(deltaPath);
      const delta = JSON.parse(deltaObj.content.toString());
      downloadSize = delta.totalSize;
    } catch (err) {
      // 没有增量包,使用完整包
    }

    res.json({
      hasUpdate: true,
      current: currentVersion,
      latest: latest.version,
      downloadSize,
      changelog: manifest.changelog,
      releaseDate: manifest.buildTime,
      critical: manifest.critical || false,
    });

  } catch (error) {
    console.error("Check update error:", error);
    res.status(500).json({
      error: "Failed to check for updates",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/compute-delta
 *
 * 计算两个版本之间的增量更新
 *
 * Body:
 *   {
 *     fromVersion: string,
 *     toVersion: string
 *   }
 *
 * Response:
 *   {
 *     files: Array<{ path, sha256, size, url }>,
 *     removed: string[],
 *     totalSize: number
 *   }
 *   或
 *   {
 *     fullPackage: true,
 *     url: string
 *   }
 */
app.post("/api/compute-delta", async (req, res) => {
  try {
    const { fromVersion, toVersion } = req.body;

    if (!fromVersion || !toVersion) {
      return res.status(400).json({
        error: "Missing fromVersion or toVersion",
      });
    }

    const deltaPath = `releases/${toVersion}/delta-from-${fromVersion}/delta.json`;

    try {
      // 尝试读取增量包
      const deltaObj = await oss.get(deltaPath);
      const delta = JSON.parse(deltaObj.content.toString());

      // 为每个文件生成签名 URL (1小时有效)
      const files = [];

      for (const file of delta.added) {
        const objectKey = `releases/${toVersion}/delta-from-${fromVersion}/added/${file.path}`;
        const url = oss.signatureUrl(objectKey, { expires: 3600 });
        files.push({ ...file, url });
      }

      for (const file of delta.modified) {
        const objectKey = `releases/${toVersion}/delta-from-${fromVersion}/modified/${file.path}`;
        const url = oss.signatureUrl(objectKey, { expires: 3600 });
        files.push({ ...file, url });
      }

      res.json({
        files,
        removed: delta.removed,
        totalSize: delta.totalSize,
      });

    } catch (deltaErr) {
      // 没有增量包,返回完整包下载链接
      const fullPackageKey = `releases/${toVersion}/full-package.tar.gz`;
      const url = oss.signatureUrl(fullPackageKey, { expires: 3600 });

      res.json({
        fullPackage: true,
        url,
      });
    }

  } catch (error) {
    console.error("Compute delta error:", error);
    res.status(500).json({
      error: "Failed to compute delta",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/dependencies/:version
 *
 * 获取指定版本的依赖清单
 *
 * Response:
 *   {
 *     npm: { changed: [], added: [], removed: [] },
 *     skills: { updated: [], added: [] },
 *     mcp: { updated: [], added: [] }
 *   }
 */
app.get("/api/dependencies/:version", async (req, res) => {
  try {
    const { version } = req.params;

    const manifestObj = await oss.get(`releases/${version}/manifest.json`);
    const manifest = JSON.parse(manifestObj.content.toString());

    res.json({
      npm: manifest.dependencies.npm,
      skills: manifest.dependencies.skills,
      mcp: manifest.dependencies.mcp,
    });

  } catch (error) {
    console.error("Get dependencies error:", error);
    res.status(500).json({
      error: "Failed to get dependencies",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /registry/:scope/:package/:version
 *
 * Skills NPM 镜像代理
 *
 * 从 OSS 下载 Skills 的 tarball 包
 */
app.get("/registry/:scope/:package/:version", async (req, res) => {
  try {
    const { scope, package: pkg, version } = req.params;
    const tarballPath = `skills-mirror/${scope}/${pkg}-${version}.tgz`;

    const result = await oss.getStream(tarballPath);
    result.stream.pipe(res);

  } catch (error) {
    console.error("Registry proxy error:", error);
    res.status(404).json({
      error: "Package not found",
    });
  }
});

/**
 * GET /health
 *
 * 健康检查端点
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = Number(process.env.UPDATE_API_PORT) || 3000;
const HOST = process.env.UPDATE_API_HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log("");
  console.log("🚀 OpenClawCN Update Server");
  console.log(`   Running on http://${HOST}:${PORT}`);
  console.log(`   OSS Bucket: ${oss.options.bucket}`);
  console.log(`   Region: ${oss.options.region}`);
  console.log("");
  console.log("📡 API Endpoints:");
  console.log(`   GET  /api/check-update?version=X.Y.Z&platform=win32`);
  console.log(`   POST /api/compute-delta`);
  console.log(`   GET  /api/dependencies/:version`);
  console.log(`   GET  /registry/:scope/:package/:version`);
  console.log(`   GET  /health`);
  console.log("");
});
