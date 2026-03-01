/**
 * Skills Marketplace SQLite Database Schema
 * CN-ONLY FILE - 完全独立实现，不影响上游 OpenClaw
 */

import { runDbMigrations, type DbMigration } from "../../../db/migrate.js";

export const SKILLS_DB_SCHEMA = {
  // 主表：存储所有 skill 元数据
  items: `
    CREATE TABLE IF NOT EXISTS skills (
      skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_cn TEXT,
      description TEXT,
      description_cn TEXT,
      category TEXT,
      tags TEXT,                        -- JSON array
      emoji TEXT,
      author TEXT,
      version TEXT,
      path TEXT,

      -- QC 质控字段
      tier TEXT,                        -- "S" | "A" | "B" | "C"
      overall_score REAL,               -- 0-10
      cn_blocked INTEGER DEFAULT 0,
      cn_alternative TEXT,
      has_translation INTEGER DEFAULT 0,

      -- 安装状态
      installed INTEGER DEFAULT 0,

      -- 元数据
      source TEXT DEFAULT 'proxy',
      proxy_version INTEGER,
      sha256 TEXT,
      size_bytes INTEGER,

      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // 同步元数据表
  syncMeta: `
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `,

  // FTS5 全文搜索表（独立存储，不使用 content= 外部内容表以避免 rowid 不一致）
  searchIndex: `
    CREATE VIRTUAL TABLE IF NOT EXISTS skills_search USING fts5(
      skill_id,
      name_cn,
      description_cn,
      tags,
      category,
      tokenize='unicode61 remove_diacritics 2'
    )
  `,

  // FTS 触发器：自动同步（使用 DELETE + INSERT 而非 UPDATE 以确保一致性）
  searchTriggers: [
    // INSERT 触发器
    `
    CREATE TRIGGER IF NOT EXISTS skills_search_insert AFTER INSERT ON skills BEGIN
      INSERT INTO skills_search(skill_id, name_cn, description_cn, tags, category)
      VALUES (new.skill_id, new.name_cn, new.description_cn, new.tags, new.category);
    END
    `,
    // UPDATE 触发器（DELETE old + INSERT new）
    `
    CREATE TRIGGER IF NOT EXISTS skills_search_update AFTER UPDATE ON skills BEGIN
      DELETE FROM skills_search WHERE skill_id = old.skill_id;
      INSERT INTO skills_search(skill_id, name_cn, description_cn, tags, category)
      VALUES (new.skill_id, new.name_cn, new.description_cn, new.tags, new.category);
    END
    `,
    // DELETE 触发器
    `
    CREATE TRIGGER IF NOT EXISTS skills_search_delete AFTER DELETE ON skills BEGIN
      DELETE FROM skills_search WHERE skill_id = old.skill_id;
    END
    `,
  ],

  // 索引优化
  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)`,
    `CREATE INDEX IF NOT EXISTS idx_skills_tier ON skills(tier)`,
    `CREATE INDEX IF NOT EXISTS idx_skills_cn_blocked ON skills(cn_blocked)`,
    `CREATE INDEX IF NOT EXISTS idx_skills_installed ON skills(installed)`,
    `CREATE INDEX IF NOT EXISTS idx_skills_overall_score ON skills(overall_score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_skills_updated_at ON skills(updated_at DESC)`,
  ],
};

/** Whether FTS5 search index was successfully created */
export let skillsFtsAvailable = false;

const SKILLS_DB_MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    label: "skills + sync_meta + indexes + FTS5",
    noTransaction: true,
    up: (db) => {
      // Core tables + indexes (idempotent)
      db.exec(SKILLS_DB_SCHEMA.items);
      db.exec(SKILLS_DB_SCHEMA.syncMeta);
      for (const index of SKILLS_DB_SCHEMA.indexes) {
        db.exec(index);
      }

      // FTS5 search (may not be available)
      try {
        db.exec(SKILLS_DB_SCHEMA.searchIndex);
        for (const trigger of SKILLS_DB_SCHEMA.searchTriggers) {
          db.exec(trigger);
        }
        skillsFtsAvailable = true;
      } catch {
        skillsFtsAvailable = false;
        try {
          db.exec("DROP TRIGGER IF EXISTS skills_search_insert");
          db.exec("DROP TRIGGER IF EXISTS skills_search_update");
          db.exec("DROP TRIGGER IF EXISTS skills_search_delete");
          db.exec("DROP TABLE IF EXISTS skills_search");
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
  runDbMigrations(db, SKILLS_DB_MIGRATIONS);
}
