const MODEL_COST_MAP = {
  // cheap
  "deepseek/deepseek-chat": 1,
  "qwen/qwen-turbo": 0.3,
  "qwen/qwen-plus": 1.2,
  "zhipu/glm-4-plus": 1,
  "doubao/doubao-seed-1-6-lite-251015": 0.5,
  // mid
  "deepseek/deepseek-reasoner": 2,
  "openai/gpt-4o": 9,
  "anthropic/claude-sonnet-4-5": 13,
  "zhipu/glm-5": 3,
  "doubao/doubao-seed-1-8-251228": 4,
  "kimi-coding/kimi-for-coding": 6,
  "qwen/qwen-max": 6,
  // sota
  "anthropic/claude-opus-4-6": 65,
  "openai/o3": 36
};
const VOLUME_TOKENS = {
  low: 5e4,
  // ~50K tokens/day
  medium: 2e5,
  // ~200K tokens/day
  high: 8e5
  // ~800K tokens/day
};
function estimateAgentDailyCost(capabilities, volume) {
  const modelId = capabilities.model.primary;
  const costPer1M = MODEL_COST_MAP[modelId] ?? 2;
  const tokensPerDay = VOLUME_TOKENS[volume] ?? VOLUME_TOKENS.medium;
  return tokensPerDay / 1e6 * costPer1M;
}
function estimateTeamDailyCost(agents, volume) {
  let total = 0;
  for (const agent of agents) {
    if (agent.inferredCapabilities) {
      total += estimateAgentDailyCost(agent.inferredCapabilities, volume);
    }
  }
  return total;
}
function formatCost(costCNY) {
  if (costCNY < 0.01) return "< \xA50.01";
  if (costCNY < 1) return `\xA5${costCNY.toFixed(2)}`;
  if (costCNY < 10) return `\xA5${costCNY.toFixed(1)}`;
  return `\xA5${Math.round(costCNY)}`;
}
function formatCostRange(costCNY) {
  const low = costCNY * 0.5;
  const high = costCNY * 1.5;
  return `${formatCost(low)}-${formatCost(high)}`;
}
export {
  estimateAgentDailyCost,
  estimateTeamDailyCost,
  formatCostRange
};
