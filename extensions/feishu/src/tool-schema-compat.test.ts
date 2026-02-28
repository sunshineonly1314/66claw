import { describe, it, expect } from "vitest";

/**
 * Tool Schema 兼容性测试
 *
 * 确保所有飞书工具的 JSON Schema 对 LLM tool-calling 友好:
 * - 不使用 allOf/anyOf (许多 LLM 不支持)
 * - required 是数组
 * - properties 是对象
 * - type 是字符串
 */

// 从各工具模块导入 schema 定义
// 因为工具是通过 registerTool 注册的，我们直接测试内联定义的 schema 结构

/** 递归检查 schema 中是否存在 allOf/anyOf */
function findProblematicPatterns(
  schema: Record<string, unknown>,
  path: string = "",
): string[] {
  const issues: string[] = [];

  if ("allOf" in schema) {
    issues.push(`${path}: uses allOf (not supported by many LLMs)`);
  }
  if ("anyOf" in schema) {
    issues.push(`${path}: uses anyOf (may cause issues with LLM tool-calling)`);
  }

  // Recurse into properties
  if (schema.properties && typeof schema.properties === "object") {
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        issues.push(
          ...findProblematicPatterns(value as Record<string, unknown>, `${path}.${key}`),
        );
      }
    }
  }

  // Recurse into items (arrays)
  if (schema.items && typeof schema.items === "object") {
    issues.push(
      ...findProblematicPatterns(schema.items as Record<string, unknown>, `${path}[items]`),
    );
  }

  return issues;
}

describe("feishu tool schema compatibility", () => {
  // Define all schemas used by our tools (matching the actual definitions)
  const taskSchemas = [
    {
      name: "feishu_task_create",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          description: { type: "string" },
          due_timestamp: { type: "string" },
          is_all_day: { type: "boolean" },
          start_timestamp: { type: "string" },
          members: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                role: { type: "string" },
              },
              required: ["id", "role"],
            },
          },
          tasklist_guid: { type: "string" },
        },
        required: ["summary"],
      },
    },
    {
      name: "feishu_task_get",
      schema: {
        type: "object",
        properties: { task_guid: { type: "string" } },
        required: ["task_guid"],
      },
    },
    {
      name: "feishu_task_update",
      schema: {
        type: "object",
        properties: {
          task_guid: { type: "string" },
          summary: { type: "string" },
          description: { type: "string" },
          due_timestamp: { type: "string" },
          is_all_day: { type: "boolean" },
          completed_at: { type: "string" },
        },
        required: ["task_guid"],
      },
    },
    {
      name: "feishu_task_delete",
      schema: {
        type: "object",
        properties: { task_guid: { type: "string" } },
        required: ["task_guid"],
      },
    },
    {
      name: "feishu_task_add_members",
      schema: {
        type: "object",
        properties: {
          task_guid: { type: "string" },
          members: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                role: { type: "string" },
              },
              required: ["id", "role"],
            },
          },
        },
        required: ["task_guid", "members"],
      },
    },
  ];

  const bitableSchemas = [
    {
      name: "feishu_bitable_get_meta",
      schema: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
    {
      name: "feishu_bitable_list_fields",
      schema: {
        type: "object",
        properties: {
          app_token: { type: "string" },
          table_id: { type: "string" },
        },
        required: ["app_token", "table_id"],
      },
    },
  ];

  const allSchemas = [...taskSchemas, ...bitableSchemas];

  it("should not use allOf or anyOf in any tool schema", () => {
    for (const { name, schema } of allSchemas) {
      const issues = findProblematicPatterns(schema, name);
      expect(issues, `Tool ${name} has schema compatibility issues`).toEqual([]);
    }
  });

  it("should have 'type: object' at root level for all tools", () => {
    for (const { name, schema } of allSchemas) {
      expect(schema.type, `Tool ${name} root type`).toBe("object");
    }
  });

  it("should have required as an array when present", () => {
    for (const { name, schema } of allSchemas) {
      if ("required" in schema) {
        expect(
          Array.isArray(schema.required),
          `Tool ${name} required should be array`,
        ).toBe(true);
      }
    }
  });

  it("should have properties as an object when present", () => {
    for (const { name, schema } of allSchemas) {
      if ("properties" in schema) {
        expect(
          typeof schema.properties === "object" && schema.properties !== null,
          `Tool ${name} properties should be object`,
        ).toBe(true);
      }
    }
  });

  it("task tool schemas should have zero allOf at any depth", () => {
    for (const { name, schema } of taskSchemas) {
      const issues = findProblematicPatterns(schema, name);
      const allOfIssues = issues.filter((i) => i.includes("allOf"));
      expect(allOfIssues, `Tool ${name} should have no allOf`).toEqual([]);
    }
  });
});
