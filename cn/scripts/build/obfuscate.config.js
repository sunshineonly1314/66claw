/**
 * JavaScript Obfuscator Configuration
 *
 * Two-tier configuration for Clawdbot project:
 * - standard: Safe config for general code (preserves compatibility)
 * - aggressive: Maximum protection for critical dirs (license/, security/, gateway/)
 */

/**
 * Standard configuration — applied to general application code
 * - Preserves property names (critical for JSON/API compatibility)
 * - Moderate obfuscation for balance between protection and performance
 */
export const standard = {
  // === Core Obfuscation ===
  compact: true,
  simplify: true,

  // === Control Flow ===
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,

  // === Dead Code Injection ===
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,

  // === String Protection ===
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.5,

  // === Identifier Transformation ===
  identifierNamesGenerator: 'hexadecimal',

  // === Split Strings ===
  splitStrings: true,
  splitStringsChunkLength: 8,

  // === Unicode Escape ===
  unicodeEscapeSequence: false, // Keep disabled for performance

  // === CRITICAL: Safety Options ===
  // These MUST stay as configured to avoid breaking the application
  renameGlobals: false,           // Don't rename global variables
  renameProperties: false,        // DON'T rename properties (breaks JSON/API)
  renamePropertiesMode: 'safe',

  // Reserved names to preserve
  reservedNames: [
    '^constructor$',
    '^prototype$',
    '^__proto__$',
    '^name$',
  ],

  // === Disabled Dangerous Options ===
  selfDefending: false,           // Can cause issues with formatting
  debugProtection: false,         // Not needed, may cause issues
  debugProtectionInterval: 0,
  disableConsoleOutput: false,    // Keep console for debugging

  // === Target Environment ===
  target: 'node',

  // === Source Maps (disabled for production) ===
  sourceMap: false,

  // === Performance Tuning ===
  numbersToExpressions: false,    // Keep disabled for performance
  transformObjectKeys: false,     // Keep disabled for JSON compatibility

  // === Logging ===
  log: false,

  // === Seed for reproducible builds ===
  seed: 0,
};

/**
 * Aggressive configuration — applied to critical directories:
 *   license/, security/, gateway/
 *
 * High obfuscation strength (tuned for build speed vs protection balance):
 * - RC4 string encryption (much harder to decode than base64)
 * - 75% control flow flattening (strong protection, 2-3x faster than 90%)
 * - 40% dead code injection (heavy noise)
 * - 3 string array wrapper layers (good indirection, reduced AST bloat)
 * - Numbers → expressions, unicode escape sequences
 * - 5-char string splitting (effective with RC4, less compile overhead)
 *
 * Still safe:
 * - renameProperties: false (JSON/API compatibility)
 * - selfDefending: false (breaks in Node.js when code is loaded from snapshot)
 * - debugProtection: false (blocks Node.js event loop with setInterval+debugger)
 */
export const aggressive = {
  // === Core Obfuscation ===
  compact: true,
  simplify: true,

  // === Control Flow (MAXED) ===
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,    // 0.5 → 0.75 (was 0.9, reduced for build speed)

  // === Dead Code Injection (HEAVY) ===
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,          // 0.2 → 0.4

  // === String Protection (RC4 ENCRYPTION) ===
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75, // 0.5 → 0.75
  stringArrayEncoding: ['rc4'],             // base64 → rc4 (much stronger)
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 3,              // 2 → 3 (was 5, reduced for build speed)
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.9,               // 0.5 → 0.9 (encrypt nearly all strings)

  // === Identifier Transformation ===
  identifierNamesGenerator: 'hexadecimal',

  // === Split Strings (FINER) ===
  splitStrings: true,
  splitStringsChunkLength: 5,               // 8 → 5 (was 3, reduced for build speed)

  // === Unicode Escape (ENABLED) ===
  unicodeEscapeSequence: true,              // false → true (obscure string literals)

  // === CRITICAL: Safety Options (SAME as standard) ===
  renameGlobals: false,
  renameProperties: false,        // DON'T rename properties (breaks JSON/API)
  renamePropertiesMode: 'safe',

  reservedNames: [
    '^constructor$',
    '^prototype$',
    '^__proto__$',
    '^name$',
  ],

  // === Dangerous Options (still disabled for Node.js safety) ===
  selfDefending: false,           // Breaks when code loaded from pkg snapshot
  debugProtection: false,         // Blocks Node.js event loop
  debugProtectionInterval: 0,
  disableConsoleOutput: false,    // Keep console for error reporting

  // === Target Environment ===
  target: 'node',

  // === Source Maps (disabled for production) ===
  sourceMap: false,

  // === Performance Tuning (ENABLED for critical dirs) ===
  numbersToExpressions: true,     // false → true (obscure numeric constants)
  transformObjectKeys: false,     // Keep disabled for JSON compatibility

  // === Logging ===
  log: false,

  // === Seed for reproducible builds ===
  seed: 0,
};

// Default export for backward compatibility
export default standard;
