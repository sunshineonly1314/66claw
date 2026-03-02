/** 构建时注入的版本标识。"cn" = 内销（默认），"overseas" = 外销去标 */
export const EDITION: "cn" | "overseas" =
  (import.meta.env.VITE_EDITION as string) === "overseas" ? "overseas" : "cn";

export const isCN = EDITION === "cn";
export const isOverseas = EDITION === "overseas";
