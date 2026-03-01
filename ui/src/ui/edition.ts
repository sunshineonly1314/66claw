/** 构建时注入的版本标识。"cn" = 内销（默认），"overseas" = 外销去标 */
export const EDITION: "cn" | "overseas" =
  (import.meta.env.VITE_EDITION as string) === "overseas" ? "overseas" : "cn";

export const isCN = EDITION === "cn";
export const isOverseas = EDITION === "overseas";

// 外销模式：初始化时清理 HTML 中的品牌信息
if (isOverseas) {
  document.title = "AI Assistant Console";
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", "AI Assistant Console");
}
