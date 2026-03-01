---
name: duckdb-en
name_zh: DuckDB AI技能
description: DuckDB CLI 专家，专精 SQL 分析、数据处理与文件转换。适用于 SQL 查询、CSV/Parquet/JSON 数据分析、数据库查询或数据格式转换。当用户输入“duckdb”、“sql”、“query”、“data analysis”、“parquet”、“convert data”等关键词时触发。
description_zh: DuckDB CLI 专家，专精 SQL 分析、数据处理与文件转换。适用于 SQL 查询、CSV/Parquet/JSON 数据分析、数据库查询或数据格式转换。当用户输入“duckdb”、“sql”、“query”、“data analysis”、“parquet”、“convert data”等关键词时触发。
---
# DuckDB CLI 专家

协助通过 DuckDB CLI 完成数据分析、SQL 查询及文件转换任务。

## 快速入门

### 直接使用 SQL 读取数据文件
```bash
# CSV
duckdb -c "SELECT * FROM 'data.csv' LIMIT 10"

# Parquet
duckdb -c "SELECT * FROM 'data.parquet'"

# Multiple files with glob
duckdb -c "SELECT * FROM read_parquet('logs/*.parquet')"

# JSON
duckdb -c "SELECT * FROM read_json_auto('data.json')"
```

### 打开持久化数据库
```bash
# Create/open database
duckdb my_database.duckdb

# Read-only mode
duckdb -readonly existing.duckdb
```

## 命令行参数

### 输出格式（作为标志使用）
| 标志 | 格式 |
|------|------|
| `-csv` | 逗号分隔（CSV） |
| `-json` | JSON 数组 |
| `-table` | ASCII 表格 |
| `-markdown` | Markdown 表格 |
| `-html` | HTML 表格 |
| `-line` | 每行一个值 |

### 执行参数
| 参数 | 描述 |
|------|------|
| `-c COMMAND` | 执行 SQL 后退出 |
| `-f FILENAME` | 从文件运行脚本 |
| `-init FILE` | 使用替代的配置文件（非 ~/.duckdbrc） |
| `-readonly` | 以只读模式打开 |
| `-echo` | 执行前显示命令 |
| `-bail` | 遇到首个错误即停止 |
| `-header` / `-noheader` | 显示 / 隐藏列标题 |
| `-nullvalue TEXT` | NULL 值的显示文本 |
| `-separator SEP` | 列分隔符 |

## 数据转换

### CSV 转 Parquet
```bash
duckdb -c "COPY (SELECT * FROM 'input.csv') TO 'output.parquet' (FORMAT PARQUET)"
```

### Parquet 转 CSV
```bash
duckdb -c "COPY (SELECT * FROM 'input.parquet') TO 'output.csv' (HEADER, DELIMITER ',')"
```

### JSON 转 Parquet
```bash
duckdb -c "COPY (SELECT * FROM read_json_auto('input.json')) TO 'output.parquet' (FORMAT PARQUET)"
```

### 带过滤的数据转换
```bash
duckdb -c "COPY (SELECT * FROM 'data.csv' WHERE amount > 1000) TO 'filtered.parquet' (FORMAT PARQUET)"
```

## 点命令（Dot Commands）

### 模式（Schema）检查
| 命令 | 描述 |
|------|------|
| `.tables [pattern]` | 显示表（支持 LIKE 模式匹配） |
| `.schema [table]` | 显示 CREATE 语句 |
| `.databases` | 显示已挂载的数据库 |

### 输出控制
| 命令 | 描述 |
|------|------|
| `.mode FORMAT` | 更改输出格式 |
| `.output file` | 将输出发送至文件 |
| `.once file` | 下一次输出发送至文件 |
| `.headers on/off` | 显示 / 隐藏列标题 |
| `.separator COL ROW` | 设置分隔符 |

### 查询相关
| 命令 | 描述 |
|------|------|
| `.timer on/off` | 显示执行耗时 |
| `.echo on/off` | 执行前显示命令 |
| `.bail on/off` | 出错时停止 |
| `.read file.sql` | 从文件运行 SQL |

### 编辑相关
| 命令 | 描述 |
|------|------|
| `.edit` 或 `\e` | 在外部编辑器中打开查询 |
| `.help [pattern]` | 显示帮助信息 |

## 输出格式（共 18 种）

### 数据导出
- **csv** —— 逗号分隔，适用于电子表格  
- **tabs** —— 制表符分隔  
- **json** —— JSON 数组  
- **jsonlines** —— 每行一个 JSON 对象（流式处理）  

### 可读格式
- **duckbox**（默认） —— 使用 Unicode 框线绘制的美观 ASCII 表格  
- **table** —— 简单 ASCII 表格  
- **markdown** —— 适用于文档编写  
- **html** —— HTML 表格  
- **latex** —— 适用于学术论文  

### 专用格式
- **insert TABLE** —— 生成 SQL INSERT 语句  
- **column** —— 按列显示，宽度可调  
- **line** —— 每行一个值  
- **list** —— 管道符（|）分隔  
- **trash** —— 丢弃输出  

## 键盘快捷键（macOS/Linux）

### 导航
| 快捷键 | 动作 |
|--------|------|
| `Home` / `End` | 行首 / 行尾 |
| `Ctrl+Left/Right` | 按词跳转 |
| `Ctrl+A` / `Ctrl+E` | 缓冲区开头 / 结尾 |

### 历史记录
| 快捷键 | 动作 |
|--------|------|
| `Ctrl+P` / `Ctrl+N` | 上一条 / 下一条命令 |
| `Ctrl+R` | 搜索历史记录 |
| `Alt+<` / `Alt+>` | 历史记录第一条 / 最后一条 |

### 编辑
| 快捷键 | 动作 |
|--------|------|
| `Ctrl+W` | 向后删除一个词 |
| `Alt+D` | 向前删除一个词 |
| `Alt+U` / `Alt+L` | 将当前词转为大写 / 小写 |
| `Ctrl+K` | 删除至行尾 |

### 自动补全
| 快捷键 | 动作 |
|--------|------|
| `Tab` | 自动补全 / 下一项建议 |
| `Shift+Tab` | 上一项建议 |
| `Esc+Esc` | 撤销自动补全 |

## 自动补全

上下文感知的自动补全，通过 `Tab` 触发：
- **关键字** —— SQL 命令  
- **表名** —— 数据库对象  
- **列名** —— 字段与函数  
- **文件名** —— 路径补全  

## 数据库操作

### 从文件创建表
```sql
CREATE TABLE sales AS SELECT * FROM 'sales_2024.csv';
```

### 插入数据
```sql
INSERT INTO sales SELECT * FROM 'sales_2025.csv';
```

### 导出表
```sql
COPY sales TO 'backup.parquet' (FORMAT PARQUET);
```

## 分析示例

### 快速统计
```sql
SELECT
    COUNT(*) as count,
    AVG(amount) as average,
    SUM(amount) as total
FROM 'transactions.csv';
```

### 分组聚合
```sql
SELECT
    category,
    COUNT(*) as count,
    SUM(amount) as total
FROM 'data.csv'
GROUP BY category
ORDER BY total DESC;
```

### 文件关联（Join）
```sql
SELECT a.*, b.name
FROM 'orders.csv' a
JOIN 'customers.parquet' b ON a.customer_id = b.id;
```

### 数据描述
```sql
DESCRIBE SELECT * FROM 'data.csv';
```

## 管道（Pipe）与标准输入（stdin）

```bash
# Read from stdin
cat data.csv | duckdb -c "SELECT * FROM read_csv('/dev/stdin')"

# Pipe to another command
duckdb -csv -c "SELECT * FROM 'data.parquet'" | head -20

# Write to stdout
duckdb -c "COPY (SELECT * FROM 'data.csv') TO '/dev/stdout' (FORMAT CSV)"
```

## 配置

将常用设置保存在 `~/.duckdbrc` 文件中：
```sql
.timer on
.mode duckbox
.maxrows 50
.highlight on
```

### 语法高亮颜色
```sql
.keyword green
.constant yellow
.comment brightblack
.error red
```

## 外部编辑器

在您偏好的编辑器中打开复杂查询：
```sql
.edit
```

编辑器按以下顺序选取：`DUCKDB_EDITOR` → `EDITOR` → `VISUAL` → `vi`

## 安全模式

一种限制文件访问的安全模式。启用后：
- 禁止访问外部文件  
- 禁用 `.read`、`.output`、`.import`、`.sh` 等功能  
- **无法在同一会话中禁用该模式**  

## 使用技巧

- 对大型文件使用 `LIMIT` 快速预览  
- Parquet 格式比 CSV 更适合重复查询（性能更优）  
- `read_csv_auto` 和 `read_json_auto` 可自动推断列类型  
- 参数按顺序处理（与 SQLite CLI 行为一致）  
- 在部分 Ubuntu 版本的 WSL2 环境中，`memory_limit` 值可能显示不正确  