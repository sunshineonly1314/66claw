// 快速验证 volcengine-ark 模型解析修复
import { resolveModel } from './dist/agents/pi-embedded-runner/model.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

console.log('=== 测试 volcengine-ark 模型解析修复 ===\n');

// 创建临时测试目录
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-volcengine-'));

try {
  // 测试 1: 没有配置时应该使用内置配置
  console.log('测试 1: 没有配置时使用内置 VOLCENGINE_ARK_BUILTIN');
  const result1 = resolveModel('volcengine-ark', 'doubao-seed-1-8-251228', testDir, {});
  
  if (result1.error) {
    console.error('❌ 失败:', result1.error);
    process.exit(1);
  }
  
  if (!result1.model) {
    console.error('❌ 失败: model 为 undefined');
    process.exit(1);
  }
  
  console.log('✅ 成功: 模型已解析');
  console.log('   Provider:', result1.model.provider);
  console.log('   Model ID:', result1.model.id);
  console.log('   Base URL:', result1.model.baseUrl);
  console.log('   API:', result1.model.api);
  
  // 测试 2: 验证模型配置正确
  if (result1.model.provider !== 'volcengine-ark') {
    console.error('❌ Provider 不正确:', result1.model.provider);
    process.exit(1);
  }
  
  if (result1.model.id !== 'doubao-seed-1-8-251228') {
    console.error('❌ Model ID 不正确:', result1.model.id);
    process.exit(1);
  }
  
  if (result1.model.baseUrl !== 'https://ark.cn-beijing.volces.com/api/v3') {
    console.error('❌ Base URL 不正确:', result1.model.baseUrl);
    process.exit(1);
  }
  
  console.log('\n测试 2: 验证模型配置正确');
  console.log('✅ 所有字段验证通过');
  
  // 测试 3: 测试另一个豆包模型
  console.log('\n测试 3: 测试 doubao-seed-1-6-251015 模型');
  const result2 = resolveModel('volcengine-ark', 'doubao-seed-1-6-251015', testDir, {});
  
  if (result2.error || !result2.model) {
    console.error('❌ 失败:', result2.error || 'model 为 undefined');
    process.exit(1);
  }
  
  console.log('✅ 成功: doubao-seed-1-6-251015 模型已解析');
  
  console.log('\n=== 所有测试通过 ===');
  console.log('修复验证成功！volcengine-ark 模型现在可以正确解析了。');
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  process.exit(1);
} finally {
  // 清理临时目录
  fs.rmSync(testDir, { recursive: true, force: true });
}
