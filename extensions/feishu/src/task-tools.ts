/**
 * 飞书任务管理工具
 * Feishu Task Tools (v2 API)
 *
 * 支持任务的创建/读取/更新/删除，以及子任务、任务列表、评论
 * 参考 m1heng/clawdbot-feishu (MIT License)
 */

import type { ClawdbotPluginApi } from "openclawcn/plugin-sdk";
import { createFeishuClient } from "./client.js";
import type { FeishuChannelConfig } from "./types.js";
import { resolveToolsConfig } from "./tools-config.js";

// ============================================================================
// 辅助函数
// ============================================================================

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

// ============================================================================
// Schema 定义
// ============================================================================

const CreateTaskSchema = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description: "Task title / 任务标题",
    },
    description: {
      type: "string",
      description: "Task description in plain text / 任务描述（纯文本）",
    },
    due_timestamp: {
      type: "string",
      description: "Due date as Unix timestamp in seconds (e.g. '1709251200'). Use is_all_day=true for date-only tasks",
    },
    is_all_day: {
      type: "boolean",
      description: "Whether the due date is an all-day event (default false)",
    },
    start_timestamp: {
      type: "string",
      description: "Start date as Unix timestamp in seconds",
    },
    members: {
      type: "array",
      description: "Task members. Each member has id (open_id) and role ('assignee' or 'follower')",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "User open_id" },
          role: { type: "string", description: "'assignee' or 'follower'" },
        },
        required: ["id", "role"],
      },
    },
    tasklist_guid: {
      type: "string",
      description: "Tasklist GUID to add the task to upon creation",
    },
  },
  required: ["summary"],
};

const GetTaskSchema = {
  type: "object" as const,
  properties: {
    task_guid: {
      type: "string",
      description: "Task GUID to retrieve",
    },
  },
  required: ["task_guid"],
};

const UpdateTaskSchema = {
  type: "object" as const,
  properties: {
    task_guid: {
      type: "string",
      description: "Task GUID to update",
    },
    summary: {
      type: "string",
      description: "New task title",
    },
    description: {
      type: "string",
      description: "New task description",
    },
    due_timestamp: {
      type: "string",
      description: "New due date as Unix timestamp in seconds. Set to '0' to clear",
    },
    is_all_day: {
      type: "boolean",
      description: "Whether the due date is an all-day event",
    },
    completed_at: {
      type: "string",
      description: "Set to current Unix timestamp (seconds) to mark complete, or '0' to reopen",
    },
  },
  required: ["task_guid"],
};

const DeleteTaskSchema = {
  type: "object" as const,
  properties: {
    task_guid: {
      type: "string",
      description: "Task GUID to delete",
    },
  },
  required: ["task_guid"],
};

const AddTaskMembersSchema = {
  type: "object" as const,
  properties: {
    task_guid: {
      type: "string",
      description: "Task GUID",
    },
    members: {
      type: "array",
      description: "Members to add",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "User open_id" },
          role: { type: "string", description: "'assignee' or 'follower'" },
        },
        required: ["id", "role"],
      },
    },
  },
  required: ["task_guid", "members"],
};

const CreateTasklistSchema = {
  type: "object" as const,
  properties: {
    name: {
      type: "string",
      description: "Tasklist name",
    },
  },
  required: ["name"],
};

const GetTasklistSchema = {
  type: "object" as const,
  properties: {
    tasklist_guid: {
      type: "string",
      description: "Tasklist GUID",
    },
  },
  required: ["tasklist_guid"],
};

const ListTasklistsSchema = {
  type: "object" as const,
  properties: {
    page_size: {
      type: "number",
      description: "Items per page (max 100, default 50)",
    },
    page_token: {
      type: "string",
      description: "Pagination token from previous response",
    },
  },
};

const UpdateTasklistSchema = {
  type: "object" as const,
  properties: {
    tasklist_guid: {
      type: "string",
      description: "Tasklist GUID to update",
    },
    name: {
      type: "string",
      description: "New tasklist name",
    },
  },
  required: ["tasklist_guid", "name"],
};

const DeleteTasklistSchema = {
  type: "object" as const,
  properties: {
    tasklist_guid: {
      type: "string",
      description: "Tasklist GUID to delete",
    },
  },
  required: ["tasklist_guid"],
};

const CreateCommentSchema = {
  type: "object" as const,
  properties: {
    task_guid: {
      type: "string",
      description: "Task GUID to comment on",
    },
    content: {
      type: "string",
      description: "Comment text content",
    },
    reply_to_comment_id: {
      type: "string",
      description: "Comment ID to reply to (optional, for threaded replies)",
    },
  },
  required: ["task_guid", "content"],
};

const ListCommentsSchema = {
  type: "object" as const,
  properties: {
    task_guid: {
      type: "string",
      description: "Task GUID whose comments to list",
    },
    page_size: {
      type: "number",
      description: "Items per page (max 100, default 50)",
    },
    page_token: {
      type: "string",
      description: "Pagination token from previous response",
    },
  },
  required: ["task_guid"],
};

// ============================================================================
// 工具注册
// ============================================================================

export function registerFeishuTaskTools(api: ClawdbotPluginApi) {
  const feishuCfg = api.config?.channels?.feishu as FeishuChannelConfig | undefined;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_task] 飞书凭证未配置，跳过任务工具注册");
    return;
  }

  const toolsCfg = resolveToolsConfig(feishuCfg.advanced?.tools);
  if (!toolsCfg.task) {
    api.logger.debug?.("[feishu_task] task 工具已在配置中禁用");
    return;
  }

  const getClient = () => createFeishuClient(feishuCfg);

  // ---- 任务 CRUD ----

  api.registerTool(
    {
      name: "feishu_task_create",
      label: "飞书创建任务",
      description:
        "Create a new task in Feishu/Lark Task. Returns the created task with guid, url, and status.",
      parameters: CreateTaskSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          summary: string;
          description?: string;
          due_timestamp?: string;
          is_all_day?: boolean;
          start_timestamp?: string;
          members?: Array<{ id: string; role: string }>;
          tasklist_guid?: string;
        };
        try {
          const client = getClient();
          const res = await client.task.v2.task.create({
            data: {
              summary: p.summary,
              ...(p.description && { description: p.description }),
              ...(p.due_timestamp && {
                due: {
                  timestamp: p.due_timestamp,
                  is_all_day: p.is_all_day ?? false,
                },
              }),
              ...(p.start_timestamp && {
                start: {
                  timestamp: p.start_timestamp,
                  is_all_day: p.is_all_day ?? false,
                },
              }),
              ...(p.members && {
                members: p.members.map((m) => ({ id: m.id, role: m.role, type: "user" })),
              }),
              ...(p.tasklist_guid && {
                tasklists: [{ tasklist_guid: p.tasklist_guid }],
              }),
            },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ task: res.data?.task });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_task_create" },
  );

  api.registerTool(
    {
      name: "feishu_task_get",
      label: "飞书获取任务",
      description:
        "Get details of a Feishu/Lark task by its GUID. Returns summary, description, due date, members, status, subtask_count, etc.",
      parameters: GetTaskSchema,
      async execute(_toolCallId, params) {
        const { task_guid } = params as { task_guid: string };
        try {
          const client = getClient();
          const res = await client.task.v2.task.get({
            path: { task_guid },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ task: res.data?.task });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_task_get" },
  );

  api.registerTool(
    {
      name: "feishu_task_update",
      label: "飞书更新任务",
      description:
        "Update an existing Feishu/Lark task. Can change summary, description, due date, or mark as completed. Only specified fields are updated.",
      parameters: UpdateTaskSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          task_guid: string;
          summary?: string;
          description?: string;
          due_timestamp?: string;
          is_all_day?: boolean;
          completed_at?: string;
        };
        try {
          const client = getClient();
          const updateFields: string[] = [];
          const task: Record<string, unknown> = {};

          if (p.summary !== undefined) {
            task.summary = p.summary;
            updateFields.push("summary");
          }
          if (p.description !== undefined) {
            task.description = p.description;
            updateFields.push("description");
          }
          if (p.due_timestamp !== undefined) {
            task.due = {
              timestamp: p.due_timestamp,
              is_all_day: p.is_all_day ?? false,
            };
            updateFields.push("due");
          }
          if (p.completed_at !== undefined) {
            task.completed_at = p.completed_at;
            updateFields.push("completed_at");
          }

          if (updateFields.length === 0) {
            return json({ error: "No fields to update. Provide at least one of: summary, description, due_timestamp, completed_at" });
          }

          const res = await client.task.v2.task.patch({
            path: { task_guid: p.task_guid },
            data: { task: task as any, update_fields: updateFields },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ task: res.data?.task });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_task_update" },
  );

  api.registerTool(
    {
      name: "feishu_task_delete",
      label: "飞书删除任务",
      description: "Delete a Feishu/Lark task by its GUID. This action is irreversible.",
      parameters: DeleteTaskSchema,
      async execute(_toolCallId, params) {
        const { task_guid } = params as { task_guid: string };
        try {
          const client = getClient();
          const res = await client.task.v2.task.delete({
            path: { task_guid },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ success: true, deleted: task_guid });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_task_delete" },
  );

  api.registerTool(
    {
      name: "feishu_task_add_members",
      label: "飞书任务添加成员",
      description:
        "Add members (assignees or followers) to a Feishu/Lark task.",
      parameters: AddTaskMembersSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          task_guid: string;
          members: Array<{ id: string; role: string }>;
        };
        try {
          const client = getClient();
          const res = await client.task.v2.task.addMembers({
            path: { task_guid: p.task_guid },
            data: {
              members: p.members.map((m) => ({ id: m.id, role: m.role, type: "user" })),
            },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ task: res.data?.task });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_task_add_members" },
  );

  // ---- 任务列表 ----

  api.registerTool(
    {
      name: "feishu_tasklist_create",
      label: "飞书创建任务列表",
      description: "Create a new tasklist in Feishu/Lark. Returns the created tasklist with guid and url.",
      parameters: CreateTasklistSchema,
      async execute(_toolCallId, params) {
        const { name } = params as { name: string };
        try {
          const client = getClient();
          const res = await client.task.v2.tasklist.create({
            data: { name },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ tasklist: res.data?.tasklist });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_tasklist_create" },
  );

  api.registerTool(
    {
      name: "feishu_tasklist_get",
      label: "飞书获取任务列表",
      description: "Get details of a Feishu/Lark tasklist by its GUID.",
      parameters: GetTasklistSchema,
      async execute(_toolCallId, params) {
        const { tasklist_guid } = params as { tasklist_guid: string };
        try {
          const client = getClient();
          const res = await client.task.v2.tasklist.get({
            path: { tasklist_guid },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ tasklist: res.data?.tasklist });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_tasklist_get" },
  );

  api.registerTool(
    {
      name: "feishu_tasklist_list",
      label: "飞书列出任务列表",
      description: "List all tasklists accessible by the bot in Feishu/Lark. Supports pagination.",
      parameters: ListTasklistsSchema,
      async execute(_toolCallId, params) {
        const p = params as { page_size?: number; page_token?: string };
        try {
          const client = getClient();
          const res = await client.task.v2.tasklist.list({
            params: {
              ...(p.page_size && { page_size: p.page_size }),
              ...(p.page_token && { page_token: p.page_token }),
              user_id_type: "open_id",
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({
            tasklists: res.data?.items ?? [],
            has_more: res.data?.has_more ?? false,
            page_token: res.data?.page_token,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_tasklist_list" },
  );

  api.registerTool(
    {
      name: "feishu_tasklist_update",
      label: "飞书更新任务列表",
      description: "Rename a Feishu/Lark tasklist.",
      parameters: UpdateTasklistSchema,
      async execute(_toolCallId, params) {
        const { tasklist_guid, name } = params as { tasklist_guid: string; name: string };
        try {
          const client = getClient();
          const res = await client.task.v2.tasklist.patch({
            path: { tasklist_guid },
            data: {
              tasklist: { name },
              update_fields: ["name"],
            },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ tasklist: res.data?.tasklist });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_tasklist_update" },
  );

  api.registerTool(
    {
      name: "feishu_tasklist_delete",
      label: "飞书删除任务列表",
      description: "Delete a Feishu/Lark tasklist by its GUID. This action is irreversible.",
      parameters: DeleteTasklistSchema,
      async execute(_toolCallId, params) {
        const { tasklist_guid } = params as { tasklist_guid: string };
        try {
          const client = getClient();
          const res = await client.task.v2.tasklist.delete({
            path: { tasklist_guid },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ success: true, deleted: tasklist_guid });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_tasklist_delete" },
  );

  // ---- 评论 ----

  api.registerTool(
    {
      name: "feishu_task_comment_create",
      label: "飞书任务添加评论",
      description: "Add a comment to a Feishu/Lark task. Supports threaded replies.",
      parameters: CreateCommentSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          task_guid: string;
          content: string;
          reply_to_comment_id?: string;
        };
        try {
          const client = getClient();
          const res = await client.task.v2.comment.create({
            data: {
              content: p.content,
              resource_type: "task",
              resource_id: p.task_guid,
              ...(p.reply_to_comment_id && { reply_to_comment_id: p.reply_to_comment_id }),
            },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ comment: res.data?.comment });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_task_comment_create" },
  );

  api.registerTool(
    {
      name: "feishu_task_comment_list",
      label: "飞书任务评论列表",
      description: "List comments on a Feishu/Lark task. Supports pagination.",
      parameters: ListCommentsSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          task_guid: string;
          page_size?: number;
          page_token?: string;
        };
        try {
          const client = getClient();
          const res = await client.task.v2.comment.list({
            params: {
              resource_type: "task",
              resource_id: p.task_guid,
              ...(p.page_size && { page_size: p.page_size }),
              ...(p.page_token && { page_token: p.page_token }),
              user_id_type: "open_id",
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({
            comments: res.data?.items ?? [],
            has_more: res.data?.has_more ?? false,
            page_token: res.data?.page_token,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_task_comment_list" },
  );

  api.logger.info?.(`[feishu_task] 已注册 12 个任务管理工具`);
}
