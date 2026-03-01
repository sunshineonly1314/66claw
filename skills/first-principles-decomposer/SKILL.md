---
name: first-principles-decomposer  
name_zh: 第一性原理分解
description: 将任何问题拆解至其基本原理（fundamental truths），再从最基础的“原子”层面重新构建解决方案。当用户说出以下任一表述时启用本 skill：“firstp”、“first principles”（第一性原理）、“from scratch”（从零开始）、“what are we assuming”（我们正在假设什么）、“break this down”（对此进行拆解）、“atomic”（原子级）、“fundamental truth”（基本原理）、“physics thinking”（物理思维）、“Elon method”（埃隆方法）、“bedrock”（基石）、“ground up”（自下而上）、“core problem”（核心问题）、“strip away”（剥离表象），或质疑当前做事方式的既有假设时。
description_zh: 将任何问题拆解至其基本原理（fundamental truths），再从最基础的“原子”层面重新构建解决方案。当用户说出以下任一表述时启用本 skill：“firstp”、“first principles”（第一性原理）、“from scratch”（从零开始）、“what are we assuming”（我们正在假设什么）、“break this down”（对此进行拆解）、“atomic”（原子级）、“fundamental truth”（基本原理）、“physics thinking”（物理思维）、“Elon method”（埃隆方法）、“bedrock”（基石）、“ground up”（自下而上）、“core problem”（核心问题）、“strip away”（剥离表象），或质疑当前做事方式的既有假设时。

# First Principles Decomposer（第一性原理拆解器）

## 适用场景
- 设计新产品或新功能  
- 在复杂问题上陷入僵局  
- 现有解决方案显得过度复杂  
- 需要挑战既有假设  
- 启动任何新项目或新倡议  

## 拆解流程

### 第一阶段：识别假设  
提问：“我正在默认为真、但其实未必成立的假设是什么？”  
逐条列出当前方案中隐含的所有假设。

### 第二阶段：拆解至原子层级  
针对每一项假设，追问：“此处最根本的事实是什么？”  
持续追问“为什么？”，直至抵达不可再分的基石事实（bedrock facts）。

### 第三阶段：基于真理重建方案  
仅从已验证的基本原理出发，提问：  
“满足核心需求的最简解决方案是什么？”

## 交互流程  

当用户调用本 skill 时：

1. **澄清问题**（最多 1–2 个问题）  
2. **显化假设**——列出所有被理所当然接受的前提  
3. **拆解至基本原理**——呈现所识别出的原子级事实  
4. **重建解决方案**——自下而上地构建新方案  
5. **对比分析**——说明该方案与常规思路的关键差异  

## 输出格式  

```
PROBLEM: [stated problem]

ASSUMPTIONS IDENTIFIED:
1. [assumption] → Challenge: [why this might be wrong]
2. [assumption] → Challenge: [why this might be wrong]

FUNDAMENTAL TRUTHS:
• [bedrock fact 1]
• [bedrock fact 2]
• [bedrock fact 3]

REBUILT SOLUTION:
[New approach built only from fundamentals]

VS CONVENTIONAL:
[How this differs from the obvious approach]
```  

## 示例触发语句  
- “请用第一性原理拆解我们的家校沟通问题”  
- “我想从零开始重新思考我们如何开展 [X]”  
- “关于 [问题]，我们有哪些可能错误的假设？”  

## 集成能力  

本 skill 可与以下 skills 协同增强效果：  
- **inversion-strategist** —— 在基于基本原理重建方案后，运用逆向思维，推演何种条件将必然导致该新方案失败  
- **second-order-consequences** —— 预测实施重建后方案所引发的下游二级影响  
- **pre-mortem-analyst** —— 通过预设该重建方案已失败的情境，对其进行压力测试  
- **six-thinking-hats** —— 运用六顶思考帽框架，逐一验证所识别出的每一项基本原理  

## Skill 元数据  
**创建时间**：2026-01-06  
**最后更新**：2026-01-06  
**作者**：Artem  
**版本**：1.0  

---
  
详见 references/framework.md 获取详细方法论  
详见 references/examples.md 查阅 Artem 专属示例  
详见 references/integrated-frameworks.md 查阅斯坦福设计思维（Stanford Design Thinking）与麻省理工学院系统工程（MIT Systems Engineering）融合框架