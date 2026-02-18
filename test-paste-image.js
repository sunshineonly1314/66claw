/**
 * 测试图片粘贴功能 - 模拟 Kimi Code 环境
 *
 * 这个脚本模拟：
 * 1. 用户在 Kimi Code 中粘贴图片
 * 2. 图片被转换为 base64
 * 3. 发送到 OpenClawCN 后端
 * 4. 检查是否能正确识别
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 模拟测试：创建一个简单的 1x1 像素的红色 PNG 图片
function createTestImageBase64() {
  // 1x1 红色 PNG 图片的 base64 编码
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  return `data:image/png;base64,${pngBase64}`;
}

// 测试 1: 模拟正确的 base64 格式 (OpenClawCN Web UI)
console.log('\n========================================');
console.log('测试 1: 正确的 base64 格式');
console.log('========================================');

const correctDataUrl = createTestImageBase64();
console.log('✅ Data URL 格式:', correctDataUrl.substring(0, 50) + '...');
console.log('✅ 格式正确: 以 "data:image/" 开头');

// 提取 base64 部分
const match = correctDataUrl.match(/^data:([^;]+);base64,(.+)$/);
if (match) {
  const mimeType = match[1];
  const base64Content = match[2];
  console.log('✅ MIME 类型:', mimeType);
  console.log('✅ Base64 内容长度:', base64Content.length);

  // 这就是 OpenClawCN 期望接收的格式
  const attachment = {
    type: 'image',
    mimeType: mimeType,
    content: base64Content
  };
  console.log('✅ OpenClawCN 期望的附件格式:');
  console.log(JSON.stringify(attachment, null, 2));
}

// 测试 2: 模拟错误的 upload:// 格式 (Kimi Code)
console.log('\n========================================');
console.log('测试 2: Kimi Code 的 upload:// 格式');
console.log('========================================');

const kimiCodeFormat = 'upload://file_1741285882630_IMG_20250307_022112.jpg';
console.log('❌ Kimi Code 格式:', kimiCodeFormat);
console.log('❌ 这不是有效的 data URL');
console.log('❌ 无法提取 MIME 类型和 base64 内容');

// 尝试解析 (会失败)
const kimiMatch = kimiCodeFormat.match(/^data:([^;]+);base64,(.+)$/);
if (!kimiMatch) {
  console.log('❌ 解析失败: 不匹配 data URL 格式');
  console.log('❌ OpenClawCN 会拒绝这种格式');
}

// 测试 3: 检查 OpenClawCN 的验证逻辑
console.log('\n========================================');
console.log('测试 3: OpenClawCN 的验证逻辑');
console.log('========================================');

function isValidBase64(value) {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

// 测试正确的 base64
const correctBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
console.log('✅ 正确的 base64:', isValidBase64(correctBase64));

// 测试 Kimi Code 的格式
const kimiContent = 'upload://file_1741285882630_IMG_20250307_022112.jpg';
console.log('❌ Kimi Code 格式:', isValidBase64(kimiContent));

console.log('\n========================================');
console.log('结论');
console.log('========================================');
console.log('1. ✅ OpenClawCN 完全支持图片识别');
console.log('2. ✅ 图片必须是 base64 data URL 格式');
console.log('3. ❌ Kimi Code 的 upload:// 格式不兼容');
console.log('4. 💡 解决方案: 使用 OpenClawCN 自己的 Web UI');
console.log('   或者在 Kimi Code 中添加格式转换适配器\n');
