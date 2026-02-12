#ifndef CLAWDBOT_ANTI_DEBUG_H
#define CLAWDBOT_ANTI_DEBUG_H

#include <napi.h>

/**
 * Native Anti-Debug Detection
 *
 * OS-level debugger detection that is much harder to bypass
 * than JavaScript-level checks:
 *
 * Windows:
 *   - IsDebuggerPresent() Win32 API
 *   - NtQueryInformationProcess(ProcessDebugPort)
 *   - CheckRemoteDebuggerPresent()
 *
 * macOS:
 *   - sysctl(CTL_KERN, KERN_PROC, KERN_PROC_PID) → P_TRACED flag
 *   - proc_name() parent process verification
 *
 * Linux:
 *   - /proc/self/status → TracerPid field
 *   - /proc/<ppid>/comm parent process verification
 *
 * All platforms:
 *   - Timing-based detection (measure code execution duration)
 *   - Parent process name verification
 */

namespace clawdbot {

class AntiDebug {
public:
  /**
   * Check if a debugger is currently attached.
   * Uses multiple OS-level detection methods.
   */
  static bool isDebuggerPresent();

  /**
   * Check for suspicious parent processes (e.g., debuggers, RE tools).
   */
  static bool hasSuspiciousParent();

  /**
   * Timing-based detection: measures execution time of a code block.
   * If a breakpoint pauses execution, the elapsed time will be abnormal.
   * @return true if timing anomaly detected
   */
  static bool detectTimingAnomaly();

  /**
   * Check for known reverse engineering tools running on the system.
   * (Windows only: checks tasklist for IDA, x64dbg, OllyDbg, etc.)
   */
  static bool hasReverseEngineeringTools();

  /**
   * Combined check: runs all detection methods.
   * @return true if ANY debugger/RE tool is detected
   */
  static bool fullCheck();

  // --- N-API exports ---
  static Napi::Value IsDebuggerPresent(const Napi::CallbackInfo& info);
  static Napi::Value HasSuspiciousParent(const Napi::CallbackInfo& info);
  static Napi::Value DetectTimingAnomaly(const Napi::CallbackInfo& info);
  static Napi::Value FullCheck(const Napi::CallbackInfo& info);
};

} // namespace clawdbot

#endif // CLAWDBOT_ANTI_DEBUG_H
