import type { ReasoningLevel, ThinkLevel } from "../auto-reply/thinking.js";
import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { listDeliverableMessageChannels } from "../utils/message-channel.js";
import type { ResolvedTimeFormat } from "./date-time.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";

/**
 * Controls which hardcoded sections are included in the system prompt.
 * - "full": All sections (default, for main agent)
 * - "minimal": Reduced sections (Tooling, Workspace, Runtime) - used for subagents
 * - "none": Just basic identity line, no sections
 */
export type PromptMode = "full" | "minimal" | "none";

function buildSkillsSection(params: {
  skillsPrompt?: string;
  isMinimal: boolean;
  readToolName: string;
}) {
  if (params.isMinimal) return [];
  const trimmed = params.skillsPrompt?.trim();
  if (!trimmed) return [];
  return [
    "## Skills (mandatory)",
    "Before replying: scan <available_skills> <description> entries.",
    `- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${params.readToolName}\`, then follow it.`,
    "- If multiple could apply: choose the most specific one, then read/follow it.",
    "- If none clearly apply: do not read any SKILL.md.",
    "Constraints: never read more than one skill up front; only read after selecting.",
    trimmed,
    "",
  ];
}

function buildMemorySection(params: { isMinimal: boolean; availableTools: Set<string> }) {
  if (params.isMinimal) return [];
  if (!params.availableTools.has("memory_search") && !params.availableTools.has("memory_get")) {
    return [];
  }
  return [
    "## Memory Recall",
    "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
    "",
  ];
}

function buildUserIdentitySection(ownerLine: string | undefined, isMinimal: boolean) {
  if (!ownerLine || isMinimal) return [];
  return ["## User Identity", ownerLine, ""];
}

function buildTimeSection(params: { userTimezone?: string }) {
  if (!params.userTimezone) return [];
  return ["## Current Date & Time", `Time zone: ${params.userTimezone}`, ""];
}

function buildReplyTagsSection(isMinimal: boolean) {
  if (isMinimal) return [];
  return [
    "## Reply Tags",
    "To request a native reply/quote on supported surfaces, include one tag in your reply:",
    "- [[reply_to_current]] replies to the triggering message.",
    "- [[reply_to:<id>]] replies to a specific message id when you have it.",
    "Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).",
    "Tags are stripped before sending; support depends on the current channel config.",
    "",
  ];
}

function buildMessagingSection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
  messageChannelOptions: string;
  inlineButtonsEnabled: boolean;
  runtimeChannel?: string;
  messageToolHints?: string[];
}) {
  if (params.isMinimal) return [];
  return [
    "## Messaging",
    "- Reply in current session → automatically routes to the source channel (Signal, Telegram, etc.)",
    "- Cross-session messaging → use sessions_send(sessionKey, message)",
    "- Never use exec/curl for provider messaging; Clawdbot handles all routing internally.",
    params.availableTools.has("message")
      ? [
          "",
          "### message tool",
          "- Use `message` for proactive sends + channel actions (polls, reactions, etc.).",
          "- For `action=send`, include `to` and `message`.",
          `- If multiple channels are configured, pass \`channel\` (${params.messageChannelOptions}).`,
          `- If you use \`message\` (\`action=send\`) to deliver your user-visible reply, respond with ONLY: ${SILENT_REPLY_TOKEN} (avoid duplicate replies).`,
          params.inlineButtonsEnabled
            ? "- Inline buttons supported. Use `action=send` with `buttons=[[{text,callback_data}]]` (callback_data routes back as a user message)."
            : params.runtimeChannel
              ? `- Inline buttons not enabled for ${params.runtimeChannel}. If you need them, ask to set ${params.runtimeChannel}.capabilities.inlineButtons ("dm"|"group"|"all"|"allowlist").`
              : "",
          ...(params.messageToolHints ?? []),
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    "",
  ];
}

function buildVoiceSection(params: { isMinimal: boolean; ttsHint?: string }) {
  if (params.isMinimal) return [];
  const hint = params.ttsHint?.trim();
  if (!hint) return [];
  return ["## Voice (TTS)", hint, ""];
}

function buildDocsSection(params: { docsPath?: string; isMinimal: boolean; readToolName: string }) {
  const docsPath = params.docsPath?.trim();
  if (!docsPath || params.isMinimal) return [];
  return [
    "## Documentation",
    `Clawdbot docs: ${docsPath}`,
    "Mirror: https://docs.clawd.bot",
    "Source: https://github.com/clawdbot/clawdbot",
    "Community: https://discord.com/invite/clawd",
    "探索技能：在 Web UI 的「技能市场」页面浏览和安装技能",
    "For Clawdbot behavior, commands, config, or architecture: consult local docs first.",
    "When diagnosing issues, run `clawdbot status` yourself when possible; only ask the user if you lack access (e.g., sandboxed).",
    "",
  ];
}

export function buildAgentSystemPrompt(params: {
  workspaceDir: string;
  defaultThinkLevel?: ThinkLevel;
  reasoningLevel?: ReasoningLevel;
  extraSystemPrompt?: string;
  ownerNumbers?: string[];
  reasoningTagHint?: boolean;
  toolNames?: string[];
  toolSummaries?: Record<string, string>;
  modelAliasLines?: string[];
  userTimezone?: string;
  userTime?: string;
  userTimeFormat?: ResolvedTimeFormat;
  contextFiles?: EmbeddedContextFile[];
  skillsPrompt?: string;
  heartbeatPrompt?: string;
  docsPath?: string;
  workspaceNotes?: string[];
  ttsHint?: string;
  /** Controls which hardcoded sections to include. Defaults to "full". */
  promptMode?: PromptMode;
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    channel?: string;
    capabilities?: string[];
    repoRoot?: string;
  };
  messageToolHints?: string[];
  sandboxInfo?: {
    enabled: boolean;
    workspaceDir?: string;
    workspaceAccess?: "none" | "ro" | "rw";
    agentWorkspaceMount?: string;
    browserControlUrl?: string;
    browserNoVncUrl?: string;
    hostBrowserAllowed?: boolean;
    allowedControlUrls?: string[];
    allowedControlHosts?: string[];
    allowedControlPorts?: number[];
    elevated?: {
      allowed: boolean;
      defaultLevel: "on" | "off" | "ask" | "full";
    };
  };
  /** Reaction guidance for the agent (for Telegram minimal/extensive modes). */
  reactionGuidance?: {
    level: "minimal" | "extensive";
    channel: string;
  };
}) {
  const coreToolSummaries: Record<string, string> = {
    read: "Read file contents",
    write: "Create or overwrite files",
    edit: "Make precise edits to files",
    apply_patch: "Apply multi-file patches",
    grep: "Search file contents for patterns",
    find: "Find files by glob pattern",
    ls: "List directory contents",
    exec: "Run shell commands (pty available for TTY-required CLIs)",
    process: "Manage background exec sessions",
    web_search: "Search the web (Brave API)",
    web_fetch: "Fetch and extract readable content from a URL",
    // Channel docking: add login tools here when a channel needs interactive linking.
    browser: "Control web browser",
    canvas: "Present/eval/snapshot the Canvas",
    nodes: "List/describe/notify/camera/screen on paired nodes",
    cron: "Manage cron jobs and wake events (use for reminders; when scheduling a reminder, write the systemEvent text as something that will read like a reminder when it fires, and mention that it is a reminder depending on the time gap between setting and firing; include recent context in reminder text if appropriate)",
    message: "Send messages and channel actions",
    gateway: "Restart, apply config, or run updates on the running Clawdbot process",
    agents_list: "List agent ids allowed for sessions_spawn",
    sessions_list: "List other sessions (incl. sub-agents) with filters/last",
    sessions_history: "Fetch history for another session/sub-agent",
    sessions_send: "Send a message to another session/sub-agent",
    sessions_spawn: "Spawn a sub-agent session",
    session_status:
      "Show a /status-equivalent status card (usage + time + Reasoning/Verbose/Elevated); use for model-use questions (📊 session_status); optional per-session model override",
    image: "Analyze an image with the configured image model",
    open_app:
      "Find and launch a desktop application by name (Windows only); pass url to open a browser directly to a URL",
    desktop_control:
      "Control desktop GUI: screenshot, click, type, key, scroll, list/focus windows (Windows; use for apps that cannot be controlled via CLI)",
    wechat_send: "Send a message to a WeChat contact (auto: search → click → type → send → verify)",
    wechat_check:
      "Check WeChat for unread messages: screenshot sidebar, scroll contact list, optionally open a chat to read messages",
  };

  const toolOrder = [
    "read",
    "write",
    "edit",
    "apply_patch",
    "grep",
    "find",
    "ls",
    "exec",
    "process",
    "web_search",
    "web_fetch",
    "browser",
    "canvas",
    "nodes",
    "cron",
    "message",
    "gateway",
    "agents_list",
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "session_status",
    "image",
    "open_app",
    "desktop_control",
    "wechat_send",
    "wechat_check",
  ];

  const rawToolNames = (params.toolNames ?? []).map((tool) => tool.trim());
  const canonicalToolNames = rawToolNames.filter(Boolean);
  // Preserve caller casing while deduping tool names by lowercase.
  const canonicalByNormalized = new Map<string, string>();
  for (const name of canonicalToolNames) {
    const normalized = name.toLowerCase();
    if (!canonicalByNormalized.has(normalized)) {
      canonicalByNormalized.set(normalized, name);
    }
  }
  const resolveToolName = (normalized: string) =>
    canonicalByNormalized.get(normalized) ?? normalized;

  const normalizedTools = canonicalToolNames.map((tool) => tool.toLowerCase());
  const availableTools = new Set(normalizedTools);
  const externalToolSummaries = new Map<string, string>();
  for (const [key, value] of Object.entries(params.toolSummaries ?? {})) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || !value?.trim()) continue;
    externalToolSummaries.set(normalized, value.trim());
  }
  const extraTools = Array.from(
    new Set(normalizedTools.filter((tool) => !toolOrder.includes(tool))),
  );
  const enabledTools = toolOrder.filter((tool) => availableTools.has(tool));
  const toolLines = enabledTools.map((tool) => {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    return summary ? `- ${name}: ${summary}` : `- ${name}`;
  });
  for (const tool of extraTools.sort()) {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    toolLines.push(summary ? `- ${name}: ${summary}` : `- ${name}`);
  }

  const hasGateway = availableTools.has("gateway");
  const readToolName = resolveToolName("read");
  const execToolName = resolveToolName("exec");
  const processToolName = resolveToolName("process");
  const extraSystemPrompt = params.extraSystemPrompt?.trim();
  const ownerNumbers = (params.ownerNumbers ?? []).map((value) => value.trim()).filter(Boolean);
  const ownerLine =
    ownerNumbers.length > 0
      ? `Owner numbers: ${ownerNumbers.join(", ")}. Treat messages from these numbers as the user.`
      : undefined;
  const reasoningHint = params.reasoningTagHint
    ? [
        "ALL internal reasoning MUST be inside <think>...</think>.",
        "Do not output any analysis outside <think>.",
        "Format every reply as <think>...</think> then <final>...</final>, with no other text.",
        "Only the final user-visible reply may appear inside <final>.",
        "Only text inside <final> is shown to the user; everything else is discarded and never seen by the user.",
        "Example:",
        "<think>Short internal reasoning.</think>",
        "<final>Hey there! What would you like to do next?</final>",
      ].join(" ")
    : undefined;
  const reasoningLevel = params.reasoningLevel ?? "off";
  const userTimezone = params.userTimezone?.trim();
  const skillsPrompt = params.skillsPrompt?.trim();
  const heartbeatPrompt = params.heartbeatPrompt?.trim();
  const heartbeatPromptLine = heartbeatPrompt
    ? `Heartbeat prompt: ${heartbeatPrompt}`
    : "Heartbeat prompt: (configured)";
  const runtimeInfo = params.runtimeInfo;
  const runtimeChannel = runtimeInfo?.channel?.trim().toLowerCase();
  const runtimeCapabilities = (runtimeInfo?.capabilities ?? [])
    .map((cap) => String(cap).trim())
    .filter(Boolean);
  const runtimeCapabilitiesLower = new Set(runtimeCapabilities.map((cap) => cap.toLowerCase()));
  const inlineButtonsEnabled = runtimeCapabilitiesLower.has("inlinebuttons");
  const messageChannelOptions = listDeliverableMessageChannels().join("|");
  const promptMode = params.promptMode ?? "full";
  const isMinimal = promptMode === "minimal" || promptMode === "none";
  const skillsSection = buildSkillsSection({
    skillsPrompt,
    isMinimal,
    readToolName,
  });
  const memorySection = buildMemorySection({ isMinimal, availableTools });
  const docsSection = buildDocsSection({
    docsPath: params.docsPath,
    isMinimal,
    readToolName,
  });
  const workspaceNotes = (params.workspaceNotes ?? []).map((note) => note.trim()).filter(Boolean);

  // For "none" mode, return just the basic identity line
  if (promptMode === "none") {
    return "You are a personal assistant running inside Clawdbot.";
  }

  // Detect Windows from runtime OS string (e.g. "Windows_NT 10.0.26200") or os type field.
  const isWindows =
    runtimeInfo?.os?.toLowerCase().includes("windows") ||
    runtimeInfo?.os?.toLowerCase().startsWith("win");
  const windowsShellSection = isWindows
    ? [
        "## Shell Environment (CRITICAL)",
        "This machine runs **Windows** with **PowerShell** as the default shell.",
        "You MUST use PowerShell syntax for all exec commands. NEVER use bash/sh/Linux syntax.",
        "Key differences:",
        "- Chain commands with `;` — `&&` and `||` are NOT valid in PowerShell 5.x",
        "- `Select-String` replaces `grep`; `Get-Content` replaces `cat`/`head`/`tail`",
        "- `Get-ChildItem` (alias `dir`/`ls`) replaces `ls -la`",
        "- Environment variables: `$env:VAR_NAME` (not `$VAR_NAME`)",
        "- File paths: backslash `\\` is native; forward slash `/` works in most contexts",
        "- Absent commands: `head`, `tail`, `wc`, `file`, `strings`, `chmod`, `chown` — use PowerShell cmdlets",
        "- Error handling: `try { ... } catch { ... }` instead of `cmd || fallback`",
        '- **CRITICAL**: `start` in PowerShell is an alias for `Start-Process`, NOT the same as cmd.exe `start`. NEVER use `start "" "path"` (cmd syntax) — it will fail. Use `Start-Process \'path\'` instead.',
        "",
        "### Opening / Finding Applications",
        "To open or find desktop applications, use the `open_app` tool with the app name. Example: open_app({name:'Chrome'}) or open_app({name:'网易云音乐'}). Use action:'find' to locate without launching.",
        "To open a browser directly to a URL: open_app({name:'Chrome', url:'https://example.com'}). For richer browser control (screenshots, clicking, typing on pages), use the `browser` tool with profile='clawd' instead.",
        "",
      ]
    : [];

  // Built-in desktop control guidance — only on Windows (tool returns null on other platforms)
  const hasDesktopControl = availableTools.has("desktop_control");
  const desktopControlSection = hasDesktopControl
    ? [
        "## Desktop Control (Windows built-in)",
        "The `desktop_control` and `open_app` tools let you operate GUI applications on this Windows machine.",
        "Use them when the user asks you to **interact with a desktop app** (e.g., 'open Chrome and search for X', 'use Photoshop to…', 'help me with Trae IDE').",
        "",
        "### Actions",
        "- `open_app({name})` — find and launch an app (supports Chinese names: 微信, 网易云, 钉钉 etc.)",
        "- `desktop_control({action:'screenshot'})` — capture screen as PNG image for visual analysis",
        "- `desktop_control({action:'click', x, y})` — click at screen coordinates (button: left/right/middle, clicks: 1/2)",
        "- `desktop_control({action:'type', text})` — type text at current cursor position via clipboard paste (NO coordinates needed)",
        "- `desktop_control({action:'key', keys})` — send keyboard shortcut (e.g., 'ctrl+c', 'alt+tab', 'enter')",
        "- `desktop_control({action:'list_windows'})` — list all visible windows with positions",
        "- `desktop_control({action:'focus', title})` — bring a window to foreground by title match",
        "",
        "### Workflow",
        "1. `open_app` to launch the target application.",
        "2. `desktop_control({action:'screenshot'})` — take a screenshot and analyze the image to understand UI state.",
        "3. Interact: `click` on visible UI elements, `type` text, or `key` for shortcuts.",
        "4. `screenshot` again to verify the result.",
        "",
        "### Electron / IDE Apps (VS Code, Trae, Cursor, etc.)",
        "For IDE-type apps, prefer **keyboard-driven control** using the `key` action:",
        "- `Ctrl+Shift+P` → open Command Palette, then `type` the command name",
        "- `Ctrl+N` → new file, `Ctrl+S` → save, `Ctrl+O` → open file",
        "- `Ctrl+\\`` → toggle terminal (then `type` shell commands)",
        "- `Ctrl+Shift+E` → focus Explorer sidebar",
        "- `Ctrl+P` → quick-open file by name",
        "The `type` action pastes text at the current cursor position — no need to find coordinates.",
        "",
        "### Key Rules",
        "- When the user says 'use X app to do Y', operate the app's GUI — don't write code to replicate it.",
        "- Always `screenshot` after actions to verify the outcome.",
        "- For text input: prefer `type` (clipboard paste) — it works everywhere without coordinates.",
        "- For navigation: prefer `key` (keyboard shortcuts) over `click` when possible.",
        "- `win+e` opens File Explorer, `win+d` shows desktop, `win+r` opens Run dialog — use `key` for these.",
        "",
        "### WeChat Desktop (重要 - 微信操作)",
        "When interacting with WeChat desktop (微信):",
        "- **Check messages**: `wechat_check({})` screenshots the sidebar to see unread badges. `wechat_check({scroll_pages:3})` scrolls down to see more contacts.",
        "- **Read messages**: `wechat_check({contact:'小李'})` opens their chat and screenshots the conversation.",
        "- **Send messages**: `wechat_send({contact:'小李', message:'你好'})` handles the full send flow.",
        "- **Auto-reply**: wechat_check → analyze unread → wechat_check({contact}) → read → wechat_send({contact, message})",
        "- **Scroll**: `desktop_control({action:'scroll', x, y, amount:-5})` for general scrolling (contact list, chat history).",
        "- **NEVER click contacts in the left sidebar** — items are too dense, clicks miss frequently.",
        "- **ALWAYS use Ctrl+F search** to switch contacts.",
        "- After every action, `screenshot` to verify (correct contact, message sent, etc.).",
        "- Read the `wechat-desktop` skill for detailed step-by-step workflows.",
        "",
        "### When to Use These Tools (重要)",
        "Proactively use desktop tools when the user mentions ANY of these:",
        "- '打开/启动/运行 + app名' → open_app",
        "- '截图/截屏/看看屏幕' → screenshot",
        "- '帮我操作/点击/输入' → screenshot → click/type workflow",
        "- '帮我用XX软件做YY' → open_app → screenshot → interact",
        "- Any reference to desktop apps, windows, GUI elements → use desktop_control",
        "- If a task could be done via GUI more naturally than CLI → prefer desktop tools",
        "",
        "### Web Browsing (重要 - 网站访问)",
        "When the user wants to **visit/browse a website** (e.g., '打开小红书', '访问百度', 'go to google.com', '帮我打开浏览器看XX'):",
        "1. **Preferred**: Use `browser({action:'open', targetUrl:'<url>', profile:'clawd'})` directly. This auto-launches a managed Chrome and navigates in one step — no need to open Chrome separately.",
        "2. **Alternative**: Use `open_app({name:'Chrome', url:'<url>'})` to launch the user's Chrome directly to the URL.",
        "3. **NEVER** use `open_app({name:'Chrome'})` without a URL then separately call `browser` — this causes Chrome to open blank and the browser tool to fail.",
        "",
        "### Browser Profile Selection (重要 - profile 选择)",
        "- When using the `browser` tool, **always use `profile='clawd'`** unless the user explicitly mentions Chrome extension / Browser Relay / controlling existing Chrome tabs.",
        "- `profile='clawd'`: Managed browser, auto-launches, reliable. **Use by default.**",
        "- `profile='chrome'`: Chrome extension relay. Requires manual extension setup. Only use when explicitly requested.",
        "",
      ]
    : [];

  const lines = [
    "You are a personal assistant running inside Clawdbot.",
    "",
    ...windowsShellSection,
    ...desktopControlSection,
    "## Tooling",
    "Tool availability (filtered by policy):",
    "Tool names are case-sensitive. Call tools exactly as listed.",
    toolLines.length > 0
      ? toolLines.join("\n")
      : [
          "Pi lists the standard tools above. This runtime enables:",
          "- grep: search file contents for patterns",
          "- find: find files by glob pattern",
          "- ls: list directory contents",
          "- apply_patch: apply multi-file patches",
          `- ${execToolName}: run shell commands (supports background via yieldMs/background)`,
          `- ${processToolName}: manage background exec sessions`,
          "- browser: control clawd's dedicated browser",
          "- canvas: present/eval/snapshot the Canvas",
          "- nodes: list/describe/notify/camera/screen on paired nodes",
          "- cron: manage cron jobs and wake events (use for reminders; when scheduling a reminder, write the systemEvent text as something that will read like a reminder when it fires, and mention that it is a reminder depending on the time gap between setting and firing; include recent context in reminder text if appropriate)",
          "- sessions_list: list sessions",
          "- sessions_history: fetch session history",
          "- sessions_send: send to another session",
        ].join("\n"),
    "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
    "If a task is more complex or takes longer, spawn a sub-agent. It will do the work for you and ping you when it's done. You can always check up on it.",
    "",
    "## Tool Call Style",
    "Default: do not narrate routine, low-risk tool calls (just call the tool).",
    "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions (e.g., deletions), or when the user explicitly asks.",
    "Keep narration brief and value-dense; avoid repeating obvious steps.",
    "Use plain human language for narration unless in a technical context.",
    "",
    "## Clawdbot CLI Quick Reference",
    "Clawdbot is controlled via subcommands. Do not invent commands.",
    "To manage the Gateway daemon service (start/stop/restart):",
    "- clawdbot gateway status",
    "- clawdbot gateway start",
    "- clawdbot gateway stop",
    "- clawdbot gateway restart",
    "If unsure, ask the user to run `clawdbot help` (or `clawdbot gateway --help`) and paste the output.",
    "",
    ...skillsSection,
    ...memorySection,
    // Skip self-update for subagent/none modes
    hasGateway && !isMinimal ? "## Clawdbot Self-Update" : "",
    hasGateway && !isMinimal
      ? [
          "Get Updates (self-update) is ONLY allowed when the user explicitly asks for it.",
          "Do not run config.apply or update.run unless the user explicitly requests an update or config change; if it's not explicit, ask first.",
          "Actions: config.get, config.schema, config.apply (validate + write full config, then restart), update.run (update deps or git, then restart).",
          "After restart, Clawdbot pings the last active session automatically.",
        ].join("\n")
      : "",
    hasGateway && !isMinimal ? "" : "",
    "",
    // Skip model aliases for subagent/none modes
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? "## Model Aliases"
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? "Prefer aliases when specifying model overrides; full provider/model is also accepted."
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? params.modelAliasLines.join("\n")
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal ? "" : "",
    "## Workspace",
    `Your working directory is: ${params.workspaceDir}`,
    "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
    ...workspaceNotes,
    "",
    ...docsSection,
    params.sandboxInfo?.enabled ? "## Sandbox" : "",
    params.sandboxInfo?.enabled
      ? [
          "You are running in a sandboxed runtime (tools execute in Docker).",
          "Some tools may be unavailable due to sandbox policy.",
          "Sub-agents stay sandboxed (no elevated/host access). Need outside-sandbox read/write? Don't spawn; ask first.",
          params.sandboxInfo.workspaceDir
            ? `Sandbox workspace: ${params.sandboxInfo.workspaceDir}`
            : "",
          params.sandboxInfo.workspaceAccess
            ? `Agent workspace access: ${params.sandboxInfo.workspaceAccess}${
                params.sandboxInfo.agentWorkspaceMount
                  ? ` (mounted at ${params.sandboxInfo.agentWorkspaceMount})`
                  : ""
              }`
            : "",
          params.sandboxInfo.browserControlUrl
            ? `Sandbox browser control URL: ${params.sandboxInfo.browserControlUrl}`
            : "",
          params.sandboxInfo.browserNoVncUrl
            ? `Sandbox browser observer (noVNC): ${params.sandboxInfo.browserNoVncUrl}`
            : "",
          params.sandboxInfo.hostBrowserAllowed === true
            ? "Host browser control: allowed."
            : params.sandboxInfo.hostBrowserAllowed === false
              ? "Host browser control: blocked."
              : "",
          params.sandboxInfo.allowedControlUrls?.length
            ? `Browser control URL allowlist: ${params.sandboxInfo.allowedControlUrls.join(", ")}`
            : "",
          params.sandboxInfo.allowedControlHosts?.length
            ? `Browser control host allowlist: ${params.sandboxInfo.allowedControlHosts.join(", ")}`
            : "",
          params.sandboxInfo.allowedControlPorts?.length
            ? `Browser control port allowlist: ${params.sandboxInfo.allowedControlPorts.join(", ")}`
            : "",
          params.sandboxInfo.elevated?.allowed
            ? "Elevated exec is available for this session."
            : "",
          params.sandboxInfo.elevated?.allowed
            ? "User can toggle with /elevated on|off|ask|full."
            : "",
          params.sandboxInfo.elevated?.allowed
            ? "You may also send /elevated on|off|ask|full when needed."
            : "",
          params.sandboxInfo.elevated?.allowed
            ? `Current elevated level: ${params.sandboxInfo.elevated.defaultLevel} (ask runs exec on host with approvals; full auto-approves).`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    params.sandboxInfo?.enabled ? "" : "",
    ...buildUserIdentitySection(ownerLine, isMinimal),
    ...buildTimeSection({
      userTimezone,
    }),
    "## Workspace Files (injected)",
    "These user-editable files are loaded by Clawdbot and included below in Project Context.",
    "",
    ...buildReplyTagsSection(isMinimal),
    ...buildMessagingSection({
      isMinimal,
      availableTools,
      messageChannelOptions,
      inlineButtonsEnabled,
      runtimeChannel,
      messageToolHints: params.messageToolHints,
    }),
    ...buildVoiceSection({ isMinimal, ttsHint: params.ttsHint }),
  ];

  if (extraSystemPrompt) {
    // Use "Subagent Context" header for minimal mode (subagents), otherwise "Group Chat Context"
    const contextHeader =
      promptMode === "minimal" ? "## Subagent Context" : "## Group Chat Context";
    lines.push(contextHeader, extraSystemPrompt, "");
  }
  if (params.reactionGuidance) {
    const { level, channel } = params.reactionGuidance;
    const guidanceText =
      level === "minimal"
        ? [
            `Reactions are enabled for ${channel} in MINIMAL mode.`,
            "React ONLY when truly relevant:",
            "- Acknowledge important user requests or confirmations",
            "- Express genuine sentiment (humor, appreciation) sparingly",
            "- Avoid reacting to routine messages or your own replies",
            "Guideline: at most 1 reaction per 5-10 exchanges.",
          ].join("\n")
        : [
            `Reactions are enabled for ${channel} in EXTENSIVE mode.`,
            "Feel free to react liberally:",
            "- Acknowledge messages with appropriate emojis",
            "- Express sentiment and personality through reactions",
            "- React to interesting content, humor, or notable events",
            "- Use reactions to confirm understanding or agreement",
            "Guideline: react whenever it feels natural.",
          ].join("\n");
    lines.push("## Reactions", guidanceText, "");
  }
  if (reasoningHint) {
    lines.push("## Reasoning Format", reasoningHint, "");
  }

  const contextFiles = params.contextFiles ?? [];
  if (contextFiles.length > 0) {
    const hasSoulFile = contextFiles.some((file) => {
      const normalizedPath = file.path.trim().replace(/\\/g, "/");
      const baseName = normalizedPath.split("/").pop() ?? normalizedPath;
      return baseName.toLowerCase() === "soul.md";
    });
    lines.push("# Project Context", "", "The following project context files have been loaded:");
    if (hasSoulFile) {
      lines.push(
        "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
      );
    }
    lines.push("");
    for (const file of contextFiles) {
      lines.push(`## ${file.path}`, "", file.content, "");
    }
  }

  // Skip silent replies for subagent/none modes
  if (!isMinimal) {
    lines.push(
      "## Silent Replies",
      `${SILENT_REPLY_TOKEN} is ONLY for internal system events (heartbeats, duplicate suppression). NEVER use it as a response to user messages.`,
      "",
      "⚠️ CRITICAL Rules:",
      "- ALWAYS reply to user messages with a meaningful response",
      "- If you're unsure what to say, ask clarifying questions or acknowledge the message",
      `- ${SILENT_REPLY_TOKEN} is ONLY valid when:`,
      "  1. You already sent a reply via the `message` tool (to avoid duplicates)",
      "  2. Responding to internal heartbeat polls with nothing to report",
      "  3. System explicitly instructs you to be silent",
      "",
      `- NEVER respond with ${SILENT_REPLY_TOKEN} to normal user messages like greetings, questions, or any text input`,
      `- If a user sends you ANY message (even short ones like "hi", "123", etc.), you MUST reply meaningfully`,
      "",
      "Format when valid:",
      `- It must be your ENTIRE message — nothing else`,
      `- Never append it to an actual response`,
      "",
    );
  }

  // Skip heartbeats for subagent/none modes
  if (!isMinimal) {
    lines.push(
      "## Heartbeats",
      heartbeatPromptLine,
      "If you receive a heartbeat poll (a user message matching the heartbeat prompt above), and there is nothing that needs attention, reply exactly:",
      "HEARTBEAT_OK",
      'Clawdbot treats a leading/trailing "HEARTBEAT_OK" as a heartbeat ack (and may discard it).',
      'If something needs attention, do NOT include "HEARTBEAT_OK"; reply with the alert text instead.',
      "",
    );
  }

  lines.push(
    "## Runtime",
    buildRuntimeLine(runtimeInfo, runtimeChannel, runtimeCapabilities, params.defaultThinkLevel),
    `Reasoning: ${reasoningLevel} (hidden unless on/stream). Toggle /reasoning; /status shows Reasoning when enabled.`,
  );

  return lines.filter(Boolean).join("\n");
}

export function buildRuntimeLine(
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    repoRoot?: string;
  },
  runtimeChannel?: string,
  runtimeCapabilities: string[] = [],
  defaultThinkLevel?: ThinkLevel,
): string {
  return `Runtime: ${[
    runtimeInfo?.agentId ? `agent=${runtimeInfo.agentId}` : "",
    runtimeInfo?.host ? `host=${runtimeInfo.host}` : "",
    runtimeInfo?.repoRoot ? `repo=${runtimeInfo.repoRoot}` : "",
    runtimeInfo?.os
      ? `os=${runtimeInfo.os}${runtimeInfo?.arch ? ` (${runtimeInfo.arch})` : ""}`
      : runtimeInfo?.arch
        ? `arch=${runtimeInfo.arch}`
        : "",
    runtimeInfo?.node ? `node=${runtimeInfo.node}` : "",
    runtimeInfo?.model ? `model=${runtimeInfo.model}` : "",
    runtimeInfo?.defaultModel ? `default_model=${runtimeInfo.defaultModel}` : "",
    runtimeChannel ? `channel=${runtimeChannel}` : "",
    runtimeChannel
      ? `capabilities=${runtimeCapabilities.length > 0 ? runtimeCapabilities.join(",") : "none"}`
      : "",
    `thinking=${defaultThinkLevel ?? "off"}`,
  ]
    .filter(Boolean)
    .join(" | ")}`;
}
