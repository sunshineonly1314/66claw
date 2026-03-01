---
name: cross-pollination-engine
name_zh: 跨域融合引擎
description: 系统性地从无关行业借鉴思路以解决问题。创新往往源自邻近领域。当用户说出“跨领域借鉴”、“X 会如何解决这个问题”、“从……借鉴思路”、“我们能向……学习什么”、“跳出思维定式”、“迪士尼/苹果/亚马逊会怎么做”、“不同行业”或“借鉴创意”时启用。
description_zh: 系统性地从无关行业借鉴思路以解决问题。创新往往源自邻近领域。当用户说出“跨领域借鉴”、“X 会如何解决这个问题”、“从……借鉴思路”、“我们能向……学习什么”、“跳出思维定式”、“迪士尼/苹果/亚马逊会怎么做”、“不同行业”或“借鉴创意”时启用。
---
# 跨领域借鉴引擎

## 核心洞见

大多数“创新”本质上是将某一领域已验证有效的解决方案，迁移到另一领域应用。
- 阻力轮 → 直排轮滑鞋（Rollerblades）  
- 游戏中的经验值（XP）系统 → Duolingo  
- 酒店礼宾服务 → 软件新手引导流程  

## 实施流程

1. **定义核心任务**（剥离行业背景）  
2. **寻找其他解决该任务的主体**（常来自出人意料的行业）  
3. **提炼底层原则**（而非表面功能）  
4. **适配至自身场景**（重在转化，而非照搬）  

## 行业灵感库

| 需求 | 可参考行业 | 原因 |
|------|------------|------|
| **信任建立** | 银行业、医疗健康、航空业 | 身份核验、资质认证、检查清单机制 |
| **用户参与度** | 游戏、健身类 App、流媒体平台 | 经验值（XP）、连续打卡（streaks）、个性化推荐、进度可视化 |
| **新手引导** | 酒店、主题公园、高端零售 | 礼宾式服务、预期管理、个性化触达 |
| **简洁性** | 苹果、宜家（IKEA）、谷歌 | 功能精简、复杂性隐藏 |
| **紧迫感营造** | 电商、航空公司、快餐业 | 稀缺性提示、锚定效应、时效承诺 |
| **社区建设** | CrossFit、哈雷戴维森（Harley-Davidson）、Peloton | 部落身份认同、共享体验 |

## 输出格式

```
PROBLEM: [What you're solving]
CORE JOB: [Stripped to fundamentals]

FROM [Industry 1]:
How they solve it: [x]
Key principle: [y]
Applied to us: [z]

FROM [Industry 2]:
How they solve it: [x]
Key principle: [y]
Applied to us: [z]

SYNTHESIS: [Combined approach]
NEXT STEP: [Concrete action]
```

## 提示词启动句式

- “迪士尼会如何设计我们的新手引导流程？”  
- “亚马逊会如何处理我们的数据？”  
- “如果这是一款游戏，它会如何运作？”  
- “高端酒店是如何让用户感到特别的？”  

## 集成能力

可与以下 agent 协同使用：
- **jtbd-analyzer** → 先厘清用户任务（job to be done），再寻找其他解决者  
- **first-principles-decomposer** → 剥离表层语境，定位根本需求  
- **six-thinking-hats** → 绿帽思维天然适配跨领域借鉴  
- **app-planning-skill** → 将借鉴所得模式应用于新应用的设计  

---
参见 references/examples.md 获取 Artem 专属的跨领域借鉴案例