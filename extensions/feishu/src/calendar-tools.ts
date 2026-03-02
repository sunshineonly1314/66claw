/**
 * 飞书日程管理工具
 * Feishu Calendar Tools
 *
 * 支持日程的创建/查询/更新/删除，以及参与人管理
 * 使用官方 @larksuiteoapi/node-sdk calendar API
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

const ListCalendarsSchema = {
  type: "object" as const,
  properties: {
    page_size: {
      type: "number",
      description: "Items per page (max 50, default 20)",
    },
    page_token: {
      type: "string",
      description: "Pagination token from previous response",
    },
  },
};

const CreateEventSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description:
        "Calendar ID to create the event in. Use 'primary' for the bot's primary calendar, or get from feishu_calendar_list",
    },
    summary: {
      type: "string",
      description: "Event title / 日程标题",
    },
    description: {
      type: "string",
      description: "Event description / 日程描述",
    },
    start_timestamp: {
      type: "string",
      description:
        "Start time as Unix timestamp in seconds (e.g. '1709251200'). Either start_timestamp or start_date is required",
    },
    start_date: {
      type: "string",
      description: "Start date for all-day events (format: YYYY-MM-DD, e.g. '2026-03-15')",
    },
    end_timestamp: {
      type: "string",
      description:
        "End time as Unix timestamp in seconds. Either end_timestamp or end_date is required",
    },
    end_date: {
      type: "string",
      description: "End date for all-day events (format: YYYY-MM-DD, e.g. '2026-03-15')",
    },
    timezone: {
      type: "string",
      description: "Timezone (e.g. 'Asia/Shanghai'). Default: Asia/Shanghai",
    },
    location_name: {
      type: "string",
      description: "Location name / 地点名称",
    },
    location_address: {
      type: "string",
      description: "Location address / 地点地址",
    },
    visibility: {
      type: "string",
      description: "Event visibility: 'default', 'public', or 'private'",
    },
    free_busy_status: {
      type: "string",
      description: "Free/busy status: 'busy' or 'free'",
    },
    reminders: {
      type: "array",
      description: "Reminder minutes before event (e.g. [15, 5] means remind 15 and 5 minutes before)",
      items: { type: "number" },
    },
    recurrence: {
      type: "string",
      description:
        "Recurrence rule in RRULE format (e.g. 'FREQ=WEEKLY;BYDAY=MO,WE,FR' or 'FREQ=DAILY;COUNT=5')",
    },
    need_notification: {
      type: "boolean",
      description: "Whether to send notification to attendees (default true)",
    },
  },
  required: ["summary"],
};

const GetEventSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID. Use 'primary' for the bot's primary calendar",
    },
    event_id: {
      type: "string",
      description: "Event ID to retrieve",
    },
  },
  required: ["calendar_id", "event_id"],
};

const ListEventsSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID. Use 'primary' for the bot's primary calendar",
    },
    start_time: {
      type: "string",
      description: "Filter: start time as Unix timestamp in seconds",
    },
    end_time: {
      type: "string",
      description: "Filter: end time as Unix timestamp in seconds",
    },
    page_size: {
      type: "number",
      description: "Items per page (max 50, default 20)",
    },
    page_token: {
      type: "string",
      description: "Pagination token from previous response",
    },
  },
  required: ["calendar_id"],
};

const UpdateEventSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID",
    },
    event_id: {
      type: "string",
      description: "Event ID to update",
    },
    summary: {
      type: "string",
      description: "New event title",
    },
    description: {
      type: "string",
      description: "New event description",
    },
    start_timestamp: {
      type: "string",
      description: "New start time as Unix timestamp in seconds",
    },
    start_date: {
      type: "string",
      description: "New start date for all-day events (YYYY-MM-DD)",
    },
    end_timestamp: {
      type: "string",
      description: "New end time as Unix timestamp in seconds",
    },
    end_date: {
      type: "string",
      description: "New end date for all-day events (YYYY-MM-DD)",
    },
    timezone: {
      type: "string",
      description: "Timezone (e.g. 'Asia/Shanghai')",
    },
    location_name: {
      type: "string",
      description: "New location name",
    },
    location_address: {
      type: "string",
      description: "New location address",
    },
    visibility: {
      type: "string",
      description: "Event visibility: 'default', 'public', or 'private'",
    },
    free_busy_status: {
      type: "string",
      description: "Free/busy status: 'busy' or 'free'",
    },
    need_notification: {
      type: "boolean",
      description: "Whether to send notification to attendees",
    },
  },
  required: ["calendar_id", "event_id"],
};

const DeleteEventSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID",
    },
    event_id: {
      type: "string",
      description: "Event ID to delete",
    },
    need_notification: {
      type: "boolean",
      description: "Whether to send cancellation notification (default true)",
    },
  },
  required: ["calendar_id", "event_id"],
};

const SearchEventsSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID. Use 'primary' for the bot's primary calendar",
    },
    query: {
      type: "string",
      description: "Search keyword to find events by title/description",
    },
    start_timestamp: {
      type: "string",
      description: "Filter: start time as Unix timestamp in seconds",
    },
    end_timestamp: {
      type: "string",
      description: "Filter: end time as Unix timestamp in seconds",
    },
    page_size: {
      type: "number",
      description: "Items per page (max 50, default 20)",
    },
    page_token: {
      type: "string",
      description: "Pagination token from previous response",
    },
  },
  required: ["calendar_id", "query"],
};

const AddEventAttendeesSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID",
    },
    event_id: {
      type: "string",
      description: "Event ID",
    },
    attendees: {
      type: "array",
      description:
        "Attendees to add. Each attendee has type ('user'|'chat'|'third_party'), and corresponding id field",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Attendee type: 'user' (飞书用户), 'chat' (群聊), 'third_party' (外部邮箱)",
          },
          user_id: {
            type: "string",
            description: "User open_id (when type='user')",
          },
          chat_id: {
            type: "string",
            description: "Chat ID (when type='chat')",
          },
          third_party_email: {
            type: "string",
            description: "External email (when type='third_party')",
          },
          is_optional: {
            type: "boolean",
            description: "Whether the attendee is optional (default false)",
          },
        },
        required: ["type"],
      },
    },
    need_notification: {
      type: "boolean",
      description: "Whether to send notification to attendees (default true)",
    },
  },
  required: ["calendar_id", "event_id", "attendees"],
};

const ListEventAttendeesSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID",
    },
    event_id: {
      type: "string",
      description: "Event ID",
    },
    page_size: {
      type: "number",
      description: "Items per page (max 50, default 20)",
    },
    page_token: {
      type: "string",
      description: "Pagination token from previous response",
    },
  },
  required: ["calendar_id", "event_id"],
};

const RemoveEventAttendeesSchema = {
  type: "object" as const,
  properties: {
    calendar_id: {
      type: "string",
      description: "Calendar ID",
    },
    event_id: {
      type: "string",
      description: "Event ID",
    },
    attendee_ids: {
      type: "array",
      description: "Attendee IDs to remove (from feishu_calendar_event_attendee_list)",
      items: { type: "string" },
    },
    need_notification: {
      type: "boolean",
      description: "Whether to send notification (default true)",
    },
  },
  required: ["calendar_id", "event_id", "attendee_ids"],
};

// ============================================================================
// 辅助：构建时间对象
// ============================================================================

function buildTimeObj(
  timestamp?: string,
  date?: string,
  timezone?: string,
): { date?: string; timestamp?: string; timezone?: string } | undefined {
  if (!timestamp && !date) return undefined;
  const obj: { date?: string; timestamp?: string; timezone?: string } = {};
  if (date) {
    obj.date = date;
  } else if (timestamp) {
    obj.timestamp = timestamp;
  }
  if (timezone) obj.timezone = timezone;
  return obj;
}

// ============================================================================
// 辅助：获取主日历 ID
// ============================================================================

async function resolvePrimaryCalendarId(client: any): Promise<string> {
  const res = await client.calendar.calendar.primary({});
  if (res.code !== 0) throw new Error(res.msg ?? `Failed to get primary calendar: code ${res.code}`);
  const calendarId = res.data?.calendars?.[0]?.calendar?.calendar_id;
  if (!calendarId) throw new Error("Primary calendar not found");
  return calendarId;
}

async function resolveCalendarId(client: any, calendarId?: string): Promise<string> {
  if (!calendarId || calendarId === "primary") {
    // 如果未指定或指定 primary，尝试获取主日历
    // 飞书 SDK 不一定有 primary() 方法，用 list 取第一个
    const res = await client.calendar.calendar.list({
      params: { page_size: 1 },
    });
    if (res.code !== 0) throw new Error(res.msg ?? `Failed to list calendars: code ${res.code}`);
    const firstCal = res.data?.calendar_list?.[0];
    if (!firstCal?.calendar_id) throw new Error("No calendar found. Please specify calendar_id.");
    return firstCal.calendar_id;
  }
  return calendarId;
}

// ============================================================================
// 工具注册
// ============================================================================

export function registerFeishuCalendarTools(api: ClawdbotPluginApi) {
  const feishuCfg = api.config?.channels?.feishu as FeishuChannelConfig | undefined;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_calendar] 飞书凭证未配置，跳过日程工具注册");
    return;
  }

  const toolsCfg = resolveToolsConfig(feishuCfg.advanced?.tools);
  if (!toolsCfg.calendar) {
    api.logger.debug?.("[feishu_calendar] calendar 工具已在配置中禁用");
    return;
  }

  const getClient = () => createFeishuClient(feishuCfg);

  // ---- 日历列表 ----

  api.registerTool(
    {
      name: "feishu_calendar_list",
      label: "飞书日历列表",
      description:
        "List all calendars accessible by the bot in Feishu/Lark. Returns calendar IDs needed for other calendar operations.",
      parameters: ListCalendarsSchema,
      async execute(_toolCallId, params) {
        const p = params as { page_size?: number; page_token?: string };
        try {
          const client = getClient();
          const res = await client.calendar.calendar.list({
            params: {
              ...(p.page_size && { page_size: p.page_size }),
              ...(p.page_token && { page_token: p.page_token }),
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({
            calendars: res.data?.calendar_list ?? [],
            has_more: res.data?.has_more ?? false,
            page_token: res.data?.page_token,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_list" },
  );

  // ---- 日程 CRUD ----

  api.registerTool(
    {
      name: "feishu_calendar_event_create",
      label: "飞书创建日程",
      description:
        "Create a new calendar event in Feishu/Lark. Supports timed events, all-day events, recurring events, location, reminders. " +
        "If calendar_id is not specified, uses the first available calendar. " +
        "For timed events use start_timestamp/end_timestamp (Unix seconds). " +
        "For all-day events use start_date/end_date (YYYY-MM-DD).",
      parameters: CreateEventSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id?: string;
          summary: string;
          description?: string;
          start_timestamp?: string;
          start_date?: string;
          end_timestamp?: string;
          end_date?: string;
          timezone?: string;
          location_name?: string;
          location_address?: string;
          visibility?: "default" | "public" | "private";
          free_busy_status?: "busy" | "free";
          reminders?: number[];
          recurrence?: string;
          need_notification?: boolean;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);
          const tz = p.timezone ?? "Asia/Shanghai";

          const startTime = buildTimeObj(p.start_timestamp, p.start_date, tz);
          const endTime = buildTimeObj(p.end_timestamp, p.end_date, tz);

          if (!startTime) {
            return json({
              error: "start_timestamp or start_date is required. Use Unix timestamp in seconds for timed events, or YYYY-MM-DD for all-day events.",
            });
          }
          // 如果没有结束时间，默认为开始时间 + 1 小时（定时事件）或同一天（全天事件）
          const finalEndTime = endTime ?? (p.start_date
            ? { date: p.start_date }
            : p.start_timestamp
              ? { timestamp: String(Number(p.start_timestamp) + 3600), timezone: tz }
              : startTime);

          const res = await client.calendar.calendarEvent.create({
            path: { calendar_id: calendarId },
            data: {
              summary: p.summary,
              ...(p.description && { description: p.description }),
              start_time: startTime,
              end_time: finalEndTime,
              ...(p.visibility && { visibility: p.visibility }),
              ...(p.free_busy_status && { free_busy_status: p.free_busy_status }),
              ...((p.location_name || p.location_address) && {
                location: {
                  ...(p.location_name && { name: p.location_name }),
                  ...(p.location_address && { address: p.location_address }),
                },
              }),
              ...(p.reminders && {
                reminders: p.reminders.map((m) => ({ minutes: m })),
              }),
              ...(p.recurrence && { recurrence: p.recurrence }),
              ...(p.need_notification !== undefined && {
                need_notification: p.need_notification,
              }),
            },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ event: res.data?.event });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_create" },
  );

  api.registerTool(
    {
      name: "feishu_calendar_event_get",
      label: "飞书获取日程",
      description:
        "Get details of a Feishu/Lark calendar event by its ID. Returns summary, time, location, attendees, etc.",
      parameters: GetEventSchema,
      async execute(_toolCallId, params) {
        const { calendar_id, event_id } = params as { calendar_id: string; event_id: string };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, calendar_id);
          const res = await client.calendar.calendarEvent.get({
            path: { calendar_id: calendarId, event_id },
            params: {
              user_id_type: "open_id",
              need_attendee: true,
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ event: res.data?.event });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_get" },
  );

  api.registerTool(
    {
      name: "feishu_calendar_event_list",
      label: "飞书日程列表",
      description:
        "List calendar events in Feishu/Lark. Can filter by time range. Returns event list with pagination.",
      parameters: ListEventsSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id: string;
          start_time?: string;
          end_time?: string;
          page_size?: number;
          page_token?: string;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);
          const res = await client.calendar.calendarEvent.list({
            path: { calendar_id: calendarId },
            params: {
              ...(p.start_time && { start_time: p.start_time }),
              ...(p.end_time && { end_time: p.end_time }),
              ...(p.page_size && { page_size: p.page_size }),
              ...(p.page_token && { page_token: p.page_token }),
              user_id_type: "open_id",
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({
            events: res.data?.items ?? [],
            has_more: res.data?.has_more ?? false,
            page_token: res.data?.page_token,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_list" },
  );

  api.registerTool(
    {
      name: "feishu_calendar_event_update",
      label: "飞书更新日程",
      description:
        "Update an existing Feishu/Lark calendar event. Only specified fields are updated.",
      parameters: UpdateEventSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id: string;
          event_id: string;
          summary?: string;
          description?: string;
          start_timestamp?: string;
          start_date?: string;
          end_timestamp?: string;
          end_date?: string;
          timezone?: string;
          location_name?: string;
          location_address?: string;
          visibility?: "default" | "public" | "private";
          free_busy_status?: "busy" | "free";
          need_notification?: boolean;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);
          const tz = p.timezone ?? "Asia/Shanghai";

          const data: Record<string, unknown> = {};
          if (p.summary !== undefined) data.summary = p.summary;
          if (p.description !== undefined) data.description = p.description;
          if (p.visibility) data.visibility = p.visibility;
          if (p.free_busy_status) data.free_busy_status = p.free_busy_status;
          if (p.need_notification !== undefined) data.need_notification = p.need_notification;

          const startTime = buildTimeObj(p.start_timestamp, p.start_date, tz);
          if (startTime) data.start_time = startTime;

          const endTime = buildTimeObj(p.end_timestamp, p.end_date, tz);
          if (endTime) data.end_time = endTime;

          if (p.location_name || p.location_address) {
            data.location = {
              ...(p.location_name && { name: p.location_name }),
              ...(p.location_address && { address: p.location_address }),
            };
          }

          if (Object.keys(data).length === 0) {
            return json({ error: "No fields to update. Provide at least one field." });
          }

          const res = await client.calendar.calendarEvent.patch({
            path: { calendar_id: calendarId, event_id: p.event_id },
            data: data as any,
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ event: res.data?.event });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_update" },
  );

  api.registerTool(
    {
      name: "feishu_calendar_event_delete",
      label: "飞书删除日程",
      description:
        "Delete a Feishu/Lark calendar event. This action is irreversible.",
      parameters: DeleteEventSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id: string;
          event_id: string;
          need_notification?: boolean;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);
          const res = await client.calendar.calendarEvent.delete({
            path: { calendar_id: calendarId, event_id: p.event_id },
            params: {
              need_notification: (p.need_notification ?? true) ? "true" : "false",
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ success: true, deleted: p.event_id });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_delete" },
  );

  api.registerTool(
    {
      name: "feishu_calendar_event_search",
      label: "飞书搜索日程",
      description:
        "Search for calendar events by keyword in Feishu/Lark. Can filter by time range.",
      parameters: SearchEventsSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id: string;
          query: string;
          start_timestamp?: string;
          end_timestamp?: string;
          page_size?: number;
          page_token?: string;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);

          const filter: Record<string, unknown> = {};
          if (p.start_timestamp) {
            filter.start_time = { timestamp: p.start_timestamp };
          }
          if (p.end_timestamp) {
            filter.end_time = { timestamp: p.end_timestamp };
          }

          const res = await client.calendar.calendarEvent.search({
            path: { calendar_id: calendarId },
            data: {
              query: p.query,
              ...(Object.keys(filter).length > 0 && { filter }),
            },
            params: {
              user_id_type: "open_id",
              ...(p.page_size && { page_size: p.page_size }),
              ...(p.page_token && { page_token: p.page_token }),
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({
            events: res.data?.items ?? [],
            page_token: res.data?.page_token,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_search" },
  );

  // ---- 参与人管理 ----

  api.registerTool(
    {
      name: "feishu_calendar_event_attendee_add",
      label: "飞书日程添加参与人",
      description:
        "Add attendees to a Feishu/Lark calendar event. Supports users (by open_id), chats, and external emails.",
      parameters: AddEventAttendeesSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id: string;
          event_id: string;
          attendees: Array<{
            type: "user" | "chat" | "third_party";
            user_id?: string;
            chat_id?: string;
            third_party_email?: string;
            is_optional?: boolean;
          }>;
          need_notification?: boolean;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);
          const res = await client.calendar.calendarEventAttendee.create({
            path: { calendar_id: calendarId, event_id: p.event_id },
            data: {
              attendees: p.attendees.map((a) => ({
                type: a.type,
                ...(a.user_id && { user_id: a.user_id }),
                ...(a.chat_id && { chat_id: a.chat_id }),
                ...(a.third_party_email && { third_party_email: a.third_party_email }),
                ...(a.is_optional !== undefined && { is_optional: a.is_optional }),
              })),
              need_notification: p.need_notification ?? true,
            },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ attendees: res.data?.attendees ?? [] });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_attendee_add" },
  );

  api.registerTool(
    {
      name: "feishu_calendar_event_attendee_list",
      label: "飞书日程参与人列表",
      description: "List attendees of a Feishu/Lark calendar event.",
      parameters: ListEventAttendeesSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id: string;
          event_id: string;
          page_size?: number;
          page_token?: string;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);
          const res = await client.calendar.calendarEventAttendee.list({
            path: { calendar_id: calendarId, event_id: p.event_id },
            params: {
              user_id_type: "open_id",
              ...(p.page_size && { page_size: p.page_size }),
              ...(p.page_token && { page_token: p.page_token }),
            },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({
            attendees: res.data?.items ?? [],
            has_more: res.data?.has_more ?? false,
            page_token: res.data?.page_token,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_attendee_list" },
  );

  api.registerTool(
    {
      name: "feishu_calendar_event_attendee_remove",
      label: "飞书日程移除参与人",
      description: "Remove attendees from a Feishu/Lark calendar event by attendee IDs.",
      parameters: RemoveEventAttendeesSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          calendar_id: string;
          event_id: string;
          attendee_ids: string[];
          need_notification?: boolean;
        };
        try {
          const client = getClient();
          const calendarId = await resolveCalendarId(client, p.calendar_id);
          const res = await client.calendar.calendarEventAttendee.batchDelete({
            path: { calendar_id: calendarId, event_id: p.event_id },
            data: {
              attendee_ids: p.attendee_ids,
              need_notification: p.need_notification ?? true,
            },
            params: { user_id_type: "open_id" },
          });
          if (res.code !== 0) throw new Error(res.msg ?? `API error code ${res.code}`);
          return json({ success: true, removed: p.attendee_ids });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar_event_attendee_remove" },
  );

  api.logger.info?.(`[feishu_calendar] 已注册 10 个日程管理工具`);
}
