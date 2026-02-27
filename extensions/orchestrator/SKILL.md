# Agent Orchestrator

Intelligent multi-agent orchestration plugin. Plan, deploy, and coordinate teams of specialized AI agents through natural language conversation.

## Features

- **Conversational orchestration**: Describe what you need, get a team of agents
- **Scene templates**: Pre-built templates for common scenarios (daily assistant, finance, learning)
- **Model gate**: Ensures orchestration uses capable models (128K+ context)
- **Smart tool recommendations**: Auto-detects which tools each agent needs
- **Dependency ordering**: Agents deploy in the right order based on dependencies
- **Rollback support**: Clean up if something goes wrong

## Usage

Tell the main agent what kind of multi-agent system you want:

```
"帮我搞一套个人财务管理系统，要能记账、分析、提醒"
```

The orchestrator will:
1. Analyze your requirements
2. Match templates or generate custom agent blueprints
3. Show you the plan for approval
4. Deploy all agents via the gateway

## Tool Actions

| Action | Description |
|--------|-------------|
| `templates` | List available scene templates |
| `plan` | Create orchestration plan from requirements |
| `confirm` | Approve plan for deployment |
| `deploy` | Create all agents and configure them |
| `status` | Check deployment status |
| `rollback` | Delete all agents created by a plan |
