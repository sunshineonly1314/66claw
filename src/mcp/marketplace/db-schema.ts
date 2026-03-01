/**
 * MCP Marketplace SQLite Database Schema
 * CN-ONLY FILE - 完全独立实现，不影响上游 OpenClaw
 */

import { runDbMigrations, type DbMigration } from "../../db/migrate.js";

export const MCP_DB_SCHEMA = {
  // 主表：存储所有 MCP 元数据
  items: `
    CREATE TABLE IF NOT EXISTS mcp_items (
      server_id TEXT PRIMARY KEY,
      friendly_name TEXT NOT NULL,
      friendly_name_cn TEXT,
      description TEXT,
      description_cn TEXT,
      category TEXT,
      tags TEXT,  -- JSON array
      tags_cn TEXT,  -- JSON array
      version TEXT,
      requires_api_key INTEGER DEFAULT 0,  -- boolean
      platforms TEXT,  -- JSON array
      is_official INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,
      tool_count INTEGER DEFAULT 0,
      source TEXT,
      source_url TEXT,

      -- 安装方式字段
      npm_package TEXT,
      pypi_package TEXT,
      sse_url TEXT,

      -- AI 增强字段
      china_friendly_score INTEGER,  -- 0-100
      requires_vpn INTEGER DEFAULT 0,
      china_block_reasons TEXT,  -- JSON array
      runtime_deps TEXT,  -- JSON array
      system_deps TEXT,  -- JSON array
      platform_notes TEXT,
      category_enhanced TEXT,  -- JSON array of {category, confidence}

      -- 推荐评分
      beginner_friendly INTEGER,  -- 0-100
      enterprise_ready INTEGER,  -- 0-100
      community_activity INTEGER,  -- 0-100

      -- 元数据
      enhanced_at TEXT,
      ai_model TEXT,
      ai_version INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // FTS5 全文搜索表（中文优化）
  searchIndex: `
    CREATE VIRTUAL TABLE IF NOT EXISTS mcp_search USING fts5(
      server_id UNINDEXED,
      friendly_name_cn,
      description_cn,
      tags_cn,
      content='mcp_items',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    )
  `,

  // FTS 触发器：自动同步
  searchTriggers: [
    // INSERT 触发器
    `
    CREATE TRIGGER IF NOT EXISTS mcp_search_insert AFTER INSERT ON mcp_items BEGIN
      INSERT INTO mcp_search(rowid, server_id, friendly_name_cn, description_cn, tags_cn)
      VALUES (new.rowid, new.server_id, new.friendly_name_cn, new.description_cn, new.tags_cn);
    END
    `,
    // UPDATE 触发器（FTS5 external content 表必须用 delete+insert 而非直接 SET，
    // 否则 token 索引不会更新，导致搜索结果错误）
    `
    CREATE TRIGGER IF NOT EXISTS mcp_search_update AFTER UPDATE ON mcp_items BEGIN
      INSERT INTO mcp_search(mcp_search, rowid, server_id, friendly_name_cn, description_cn, tags_cn)
      VALUES ('delete', old.rowid, old.server_id, old.friendly_name_cn, old.description_cn, old.tags_cn);
      INSERT INTO mcp_search(rowid, server_id, friendly_name_cn, description_cn, tags_cn)
      VALUES (new.rowid, new.server_id, new.friendly_name_cn, new.description_cn, new.tags_cn);
    END
    `,
    // DELETE 触发器
    `
    CREATE TRIGGER IF NOT EXISTS mcp_search_delete AFTER DELETE ON mcp_items BEGIN
      DELETE FROM mcp_search WHERE rowid = old.rowid;
    END
    `,
  ],

  // 同步元数据表（记录导入状态，防止重复导入）
  syncMeta: `
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `,

  // 索引优化
  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_category ON mcp_items(category)`,
    `CREATE INDEX IF NOT EXISTS idx_china_friendly ON mcp_items(china_friendly_score)`,
    `CREATE INDEX IF NOT EXISTS idx_requires_vpn ON mcp_items(requires_vpn)`,
    `CREATE INDEX IF NOT EXISTS idx_is_official ON mcp_items(is_official)`,
    `CREATE INDEX IF NOT EXISTS idx_source ON mcp_items(source)`,
    `CREATE INDEX IF NOT EXISTS idx_updated_at ON mcp_items(updated_at DESC)`,
  ],
};

/** Whether FTS5 search index was successfully created */
export let mcpFtsAvailable = false;

const MCP_DB_MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    label: "mcp_items + sync_meta + indexes",
    up: (db) => {
      db.exec(MCP_DB_SCHEMA.items);
      db.exec(MCP_DB_SCHEMA.syncMeta);
      for (const index of MCP_DB_SCHEMA.indexes) {
        db.exec(index);
      }
      // Install columns (idempotent for existing databases)
      const newColumns = ["npm_package TEXT", "pypi_package TEXT", "sse_url TEXT"];
      for (const colDef of newColumns) {
        try {
          db.exec(`ALTER TABLE mcp_items ADD COLUMN ${colDef}`);
        } catch {
          // Column already exists — ignore
        }
      }
    },
  },
  {
    version: 2,
    label: "FTS5 mcp_search + triggers",
    noTransaction: true,
    up: (db) => {
      try {
        db.exec(MCP_DB_SCHEMA.searchIndex);
        for (const trigger of MCP_DB_SCHEMA.searchTriggers) {
          db.exec(trigger);
        }
        mcpFtsAvailable = true;
      } catch {
        mcpFtsAvailable = false;
        // Clean up residual FTS5 triggers/tables to prevent INSERT errors
        try {
          db.exec("DROP TRIGGER IF EXISTS mcp_search_insert");
          db.exec("DROP TRIGGER IF EXISTS mcp_search_update");
          db.exec("DROP TRIGGER IF EXISTS mcp_search_delete");
          db.exec("DROP TABLE IF EXISTS mcp_search");
        } catch {
          // best-effort cleanup
        }
      }
    },
  },
];

/**
 * 初始化数据库（创建所有表和索引）
 */
export function initializeSchema(db: any) {
  runDbMigrations(db, MCP_DB_MIGRATIONS);
}
