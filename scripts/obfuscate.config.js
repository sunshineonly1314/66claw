/**
 * JavaScript Obfuscator Configuration
 * 
 * Safe configuration for Clawdbot project
 * - Preserves property names (critical for JSON/API compatibility)
 * - Enables string encryption and control flow flattening
 * - Avoids dangerous options that could break runtime
 */

export default {
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
