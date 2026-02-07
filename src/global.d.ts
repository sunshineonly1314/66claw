/**
 * 编译时常量声明
 *
 * __DEV_BUILD__ 在构建时被替换：
 * - 开发构建：true（允许 DEV 模式环境变量）
 * - 生产构建：false（禁用 DEV 模式绕过）
 */
declare const __DEV_BUILD__: boolean;
