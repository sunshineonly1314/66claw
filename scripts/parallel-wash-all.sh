#!/bin/bash
# 超快并发清洗 - 直接并行运行 11 个批次
# 每批 300 个技能，共 3061 个

cd "$(dirname "$0")/.."

echo "🚀 启动 11 个批次并行清洗..."

for batch in {1..11}; do
  echo "  启动批次 $batch"
  node scripts/unified-skill-wash.mjs --batch $batch > "batch-$batch.log" 2>&1 &
done

echo "✅ 所有批次已启动，查看进度:"
echo "   tail -f batch-1.log"
echo "   tail -f batch-2.log"
echo "   ..."

wait
echo "🎉 全部完成！"
