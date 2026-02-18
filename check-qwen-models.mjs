#!/usr/bin/env node
/**
 * 检查 Qwen 系列模型的实际能力
 * 参考: https://help.aliyun.com/zh/dashscope/developer-reference/model-introduction
 */

console.log('📊 Qwen (通义千问) 模型能力对照表\n');
console.log('=' .repeat(80));

const qwenModels = [
  {
    name: 'Qwen-Max',
    official: 'qwen-max',
    capabilities: {
      text: '✅ 高级文本理解和生成',
      vision: '❌ 不支持图片',
      video: '❌ 不支持视频',
      audio: '❌ 不支持音频',
      code: '✅ 代码理解和生成',
    },
    note: '纯文本模型，不支持多模态',
    pricing: '0.04元/千tokens（输入）+ 0.12元/千tokens（输出）'
  },
  {
    name: 'Qwen-Plus',
    official: 'qwen-plus',
    capabilities: {
      text: '✅ 文本理解和生成',
      vision: '❌ 不支持图片',
      video: '❌ 不支持视频',
      audio: '❌ 不支持音频',
      code: '✅ 代码理解',
    },
    note: '纯文本模型，性价比高',
    pricing: '0.004元/千tokens（输入）+ 0.02元/千tokens（输出）'
  },
  {
    name: 'Qwen-Turbo',
    official: 'qwen-turbo',
    capabilities: {
      text: '✅ 文本理解',
      vision: '❌ 不支持图片',
      video: '❌ 不支持视频',
      audio: '❌ 不支持音频',
      code: '⚠️ 基础代码',
    },
    note: '纯文本模型，速度快',
    pricing: '0.002元/千tokens（输入）+ 0.006元/千tokens（输出）'
  },
  {
    name: 'Qwen-VL-Plus (已废弃)',
    official: 'qwen-vl-plus',
    capabilities: {
      text: '✅ 文本理解',
      vision: '✅ 图片理解',
      video: '❌ 不支持视频',
      audio: '❌ 不支持音频',
      code: '⚠️ 基础',
    },
    note: '⚠️ 已于 2024 年废弃，不建议使用',
    pricing: 'N/A（已停用）'
  },
  {
    name: 'Qwen-VL-Max',
    official: 'qwen-vl-max',
    capabilities: {
      text: '✅ 高级文本理解',
      vision: '✅ 高级图片理解（OCR、图表、场景）',
      video: '❌ 不支持视频',
      audio: '❌ 不支持音频',
      code: '⚠️ 基础代码',
    },
    note: '✅ 多模态视觉模型，支持图片分析',
    pricing: '0.02元/千tokens（输入）+ 0.02元/千tokens（输出）'
  },
  {
    name: 'Qwen2-VL-7B/72B',
    official: 'qwen2-vl-7b-instruct / qwen2-vl-72b-instruct',
    capabilities: {
      text: '✅ 文本理解',
      vision: '✅ 图片和视频理解',
      video: '✅ 视频理解（帧分析）',
      audio: '❌ 不支持音频',
      code: '✅ 代码理解',
    },
    note: '✅ 最新多模态模型，支持图片+视频',
    pricing: '开源模型，需自行部署或使用DashScope API'
  },
];

console.log('\n模型对照表：\n');

qwenModels.forEach((model, idx) => {
  console.log(`${idx + 1}. ${model.name}`);
  console.log(`   官方标识: ${model.official}`);
  console.log(`   能力:`);
  Object.entries(model.capabilities).forEach(([key, value]) => {
    console.log(`     • ${key.padEnd(8)}: ${value}`);
  });
  console.log(`   说明: ${model.note}`);
  console.log(`   定价: ${model.pricing}`);
  console.log('');
});

console.log('=' .repeat(80));
console.log('\n📌 关键发现：\n');
console.log('❌ Qwen-Max  - 纯文本模型，**不支持图片**');
console.log('❌ Qwen-Plus - 纯文本模型，**不支持图片**');
console.log('❌ Qwen-Turbo - 纯文本模型，**不支持图片**');
console.log('');
console.log('✅ Qwen-VL-Max - **支持图片分析**（推荐）');
console.log('✅ Qwen2-VL-7B/72B - **支持图片+视频**（最新）');
console.log('');
console.log('=' .repeat(80));

console.log('\n🔧 OpenClawCN 配置建议：\n');
console.log('如果需要图片识别能力，请配置：');
console.log('```json');
console.log('{');
console.log('  "agents": {');
console.log('    "authProfiles": [');
console.log('      {');
console.log('        "provider": "dashscope",  // 或 "qwen"');
console.log('        "model": "qwen-vl-max",   // ✅ 支持 vision');
console.log('        "apiKey": "sk-..."');
console.log('      },');
console.log('      {');
console.log('        "provider": "dashscope",');
console.log('        "model": "qwen-max",      // ❌ 仅文本，无 vision');
console.log('        "apiKey": "sk-..."');
console.log('      }');
console.log('    ]');
console.log('  }');
console.log('}');
console.log('```');
console.log('');

console.log('💡 注意事项：');
console.log('1. Qwen-Max 虽然名字有 "Max"，但它是纯文本模型');
console.log('2. 带 "VL" (Vision-Language) 的才支持图片：Qwen-VL-Max');
console.log('3. Qwen2-VL 系列是最新的，支持图片和视频');
console.log('4. 如果只配置了 Qwen-Max，发送图片会失败');
console.log('');
