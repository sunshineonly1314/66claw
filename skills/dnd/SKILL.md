---
name: dnd
name_zh: D&D
description: 面向玩家与地下城主（DM）的《龙与地下城》第五版（D&D 5e）工具包。掷骰子、查询法术与怪物、生成角色、构建遭遇战、生成非玩家角色（NPC）。使用官方 D&D 5e SRD API。
description_zh: 面向玩家与地下城主（DM）的《龙与地下城》第五版（D&D 5e）工具包。掷骰子、查询法术与怪物、生成角色、构建遭遇战、生成非玩家角色（NPC）。使用官方 D&D 5e SRD API。
version: 1.0.0
author: captmarbles
---
# 《龙与地下城》第五版（D&D 5e）工具包

您专属的《龙与地下城》第五版全能助手！查询法术、怪物，掷骰子，生成角色、遭遇战及 NPC。

## 功能

🎲 **骰子掷投器** — 支持任意骰子及修正值  
✨ **法术查询** — 检索整套 SRD 法术列表  
👹 **怪物属性** — 获取任意生物的完整属性栏  
⚔️ **角色生成器** — 随机生成含属性值的角色  
🗡️ **遭遇战构建器** — 按挑战等级（CR）生成平衡的遭遇战  
👤 **NPC 生成器** — 创建带个性特征的随机 NPC  

## 使用方法

所有命令均调用 `dnd.py` 脚本。

### 掷骰子

```bash
# Roll 2d6 with +3 modifier
python3 dnd.py roll 2d6+3

# Roll d20
python3 dnd.py roll 1d20

# Roll with negative modifier
python3 dnd.py roll 1d20-2

# Roll multiple dice
python3 dnd.py roll 8d6
```

**输出：**  
```
🎲 Rolling 2d6+3
   Rolls: [4 + 5] +3
   Total: 12
```

### 查询法术

```bash
# Search for a spell
python3 dnd.py spell --search fireball

# Direct lookup
python3 dnd.py spell fire-bolt

# List all spells
python3 dnd.py spell --list
```

**输出：**  
```
✨ Fireball
   Level: 3 Evocation
   Casting Time: 1 action
   Range: 150 feet
   Components: V, S, M
   Duration: Instantaneous
   
   A bright streak flashes from your pointing finger to a point 
   you choose within range and then blossoms with a low roar into 
   an explosion of flame...
```

### 查询怪物

```bash
# Search for a monster
python3 dnd.py monster --search dragon

# Direct lookup
python3 dnd.py monster ancient-red-dragon

# List all monsters
python3 dnd.py monster --list
```

**输出：**  
```
👹 Adult Red Dragon
   Huge Dragon, chaotic evil
   CR 17 (18,000 XP)
   
   AC: 19
   HP: 256 (19d12+133)
   Speed: walk 40 ft., climb 40 ft., fly 80 ft.
   
   STR 27 | DEX 10 | CON 25
   INT 16 | WIS 13 | CHA 21
   
   Special Abilities:
   • Legendary Resistance (3/Day): If the dragon fails a saving throw...
   
   Actions:
   • Multiattack: The dragon can use its Frightful Presence...
```

### 生成随机角色

```bash
# Generate character with rolled stats
python3 dnd.py character
```

**输出：**  
```
⚔️  Elara
   Race: Elf
   Class: Wizard
   
   Stats:
   STR: 10 (+0)
   DEX: 15 (+2)
   CON: 12 (+1)
   INT: 16 (+3)
   WIS: 13 (+1)
   CHA: 8 (-1)
```

### 生成随机遭遇战

```bash
# Generate encounter with challenge rating
python3 dnd.py encounter --cr 5

# Random CR
python3 dnd.py encounter
```

**输出：**  
```
🎲 Random Encounter (CR ~5)

   2x Troll (CR 5)
      AC 15, HP 84
   1x Ogre (CR 2)
      AC 11, HP 59
```

### 生成随机 NPC

```bash
python3 dnd.py npc
```

**输出：**  
```
👤 Finn Shadowend
   Race: Halfling
   Occupation: Merchant
   Trait: Curious
```

## Clawdbot 示例提示词

- *“掷 2d20 并取优势”*（我将掷两次！）  
- *“查询火球术（Fireball）法术”*  
- *“显示夺心魔（Beholder）的属性数据”*  
- *“生成一个随机角色”*  
- *“为五级队伍创建一场遭遇战”*  
- *“为我的酒馆场景提供一名 NPC”*

## JSON 输出格式

在任意命令后添加 `--json` 参数，即可获得结构化输出：

```bash
python3 dnd.py roll 2d6 --json
python3 dnd.py spell --search fireball --json
python3 dnd.py character --json
```

## API 数据源

使用官方 [D&D 5e API](https://www.dnd5eapi.co/)，该 API 包含全部《系统参考文档》（SRD）内容。

## 使用提示

- **法术名称** 须小写并以连字符分隔：`fireball`、`magic-missile`、`cure-wounds`  
- **怪物名称** 格式相同：`ancient-red-dragon`、`goblin`、`beholder`  
- 若不确定确切名称，可使用 **模糊搜索**：`--search dragon` 将列出所有龙类生物  
- **骰子格式** 灵活支持：`1d20`、`2d6+5`、`3d8-2`、`100d100`  

## 未来构想

- 先攻顺序追踪器  
- 宝藏生成器  
- 任务/剧情钩子生成器  
- 随机地下城生成器  
- 队伍管理器  
- 战役笔记功能  

祝您冒险愉快！ 🐉⚔️✨