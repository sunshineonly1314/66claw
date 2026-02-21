const DEFAULT_TOOLS_CONFIG = {
  doc: true,
  // 文档操作
  wiki: true,
  // 知识库操作
  drive: true,
  // 云空间操作
  perm: false,
  // 权限管理 (默认禁用，敏感)
  scopes: true
  // 应用权限诊断
};
function resolveToolsConfig(userConfig) {
  if (!userConfig) {
    return { ...DEFAULT_TOOLS_CONFIG };
  }
  return {
    doc: userConfig.doc ?? DEFAULT_TOOLS_CONFIG.doc,
    wiki: userConfig.wiki ?? DEFAULT_TOOLS_CONFIG.wiki,
    drive: userConfig.drive ?? DEFAULT_TOOLS_CONFIG.drive,
    perm: userConfig.perm ?? DEFAULT_TOOLS_CONFIG.perm,
    scopes: userConfig.scopes ?? DEFAULT_TOOLS_CONFIG.scopes
  };
}
export {
  DEFAULT_TOOLS_CONFIG,
  resolveToolsConfig
};
