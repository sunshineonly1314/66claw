$env:OSS_ACCESS_KEY_ID = "LTAI5tGbuzYX98dppnUcs2tU"
$env:OSS_ACCESS_KEY_SECRET = "1k2GQB7r3wNqsmxivnJWZ6D4PYr1da"
$env:OSS_BUCKET = "chuhai-tecbin"
$env:OSS_REGION = "oss-cn-hangzhou"
Set-Location D:\cicd-workspace\openclawcn

Write-Host "=== Upload Installer to OSS ==="

$script = @'
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Buffer = globalThis.Buffer || require("buffer").Buffer;
const OSS = require("ali-oss");

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
});

const localPath = "E:\\clawdbuild\\ClawdbotCN-Setup-2026.2.15-x64.exe";
const ossKey = "releases/2026.2.15/installers/ClawdbotCN-Setup-2026.2.15-x64.exe";

const size = fs.statSync(localPath).size;
console.log(`Uploading: ${localPath}`);
console.log(`  Size: ${(size / 1024 / 1024).toFixed(1)} MB`);
console.log(`  To: ${ossKey}`);

const result = await client.multipartUpload(ossKey, localPath, {
  progress: (p) => {
    const pct = Math.round(p * 100);
    if (pct % 10 === 0) process.stdout.write(`  Progress: ${pct}%\r`);
  },
});
console.log(`\nUpload complete!`);
console.log(`  URL: https://dl.obplugins.cn/${ossKey}`);
'@

$tmpFile = "D:\cicd-workspace\openclawcn\_upload-installer.mjs"
$script | Out-File -FilePath $tmpFile -Encoding UTF8
node $tmpFile 2>&1
$exitCode = $LASTEXITCODE
Remove-Item $tmpFile -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "=== Upload Exit: $exitCode ==="
exit $exitCode
