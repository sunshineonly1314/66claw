/**
 * Native Anti-Debug Detection
 *
 * OS-level debugger detection using system APIs that are
 * significantly harder to bypass than JavaScript checks.
 */

#include "anti_debug.h"

#include <chrono>
#include <cstring>
#include <string>

#ifdef _WIN32
#include <windows.h>
#include <winternl.h>
#include <tlhelp32.h>
#pragma comment(lib, "ntdll.lib")
#elif defined(__APPLE__)
#include <sys/types.h>
#include <sys/sysctl.h>
#include <unistd.h>
#include <signal.h>
#include <libproc.h>
#elif defined(__linux__)
#include <fstream>
#include <unistd.h>
#include <sys/ptrace.h>
#endif

namespace clawdbot {

// ============================================================================
// Platform-specific debugger detection
// ============================================================================

bool AntiDebug::isDebuggerPresent() {
#ifdef _WIN32
  // Method 1: Win32 API — IsDebuggerPresent
  if (IsDebuggerPresent()) {
    return true;
  }

  // Method 2: Check remote debugger
  BOOL remoteDebugger = FALSE;
  if (CheckRemoteDebuggerPresent(GetCurrentProcess(), &remoteDebugger)) {
    if (remoteDebugger) {
      return true;
    }
  }

  // Method 3: NtQueryInformationProcess — ProcessDebugPort (7)
  typedef NTSTATUS(NTAPI * NtQueryInfoProc)(HANDLE, ULONG, PVOID, ULONG, PULONG);
  HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  if (ntdll) {
    auto NtQueryInformationProcess =
        reinterpret_cast<NtQueryInfoProc>(GetProcAddress(ntdll, "NtQueryInformationProcess"));
    if (NtQueryInformationProcess) {
      DWORD_PTR debugPort = 0;
      NTSTATUS status = NtQueryInformationProcess(
          GetCurrentProcess(), 7 /* ProcessDebugPort */,
          &debugPort, sizeof(debugPort), nullptr);
      if (status == 0 && debugPort != 0) {
        return true;
      }
    }
  }

  return false;

#elif defined(__APPLE__)
  // macOS: sysctl to check P_TRACED flag
  struct kinfo_proc info;
  memset(&info, 0, sizeof(info));

  int mib[4];
  mib[0] = CTL_KERN;
  mib[1] = KERN_PROC;
  mib[2] = KERN_PROC_PID;
  mib[3] = getpid();

  size_t size = sizeof(info);
  if (sysctl(mib, 4, &info, &size, nullptr, 0) == 0) {
    return (info.kp_proc.p_flag & P_TRACED) != 0;
  }

  return false;

#elif defined(__linux__)
  // Linux: read /proc/self/status for TracerPid
  std::ifstream status("/proc/self/status");
  if (status.is_open()) {
    std::string line;
    while (std::getline(status, line)) {
      if (line.compare(0, 10, "TracerPid:") == 0) {
        // Parse the PID after "TracerPid:\t"
        std::string pidStr = line.substr(10);
        // Trim whitespace
        size_t start = pidStr.find_first_not_of(" \t");
        if (start != std::string::npos) {
          pidStr = pidStr.substr(start);
        }
        long pid = std::stol(pidStr);
        return pid != 0;
      }
    }
  }

  // TracerPid check is sufficient and reliable.
  // Note: ptrace(PTRACE_TRACEME) self-trace was intentionally removed because
  // PTRACE_TRACEME makes the current process a tracee and cannot be undone
  // from within the same process (PTRACE_DETACH requires the *parent* to call it).
  // Using it would leave the process permanently in traced state, causing
  // all subsequent anti-debug checks to false-positive.
  return false;

#else
  return false; // Unknown platform
#endif
}

// ============================================================================
// Suspicious parent process detection
// ============================================================================

bool AntiDebug::hasSuspiciousParent() {
#ifdef _WIN32
  // Get parent process name
  DWORD parentPid = 0;
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot != INVALID_HANDLE_VALUE) {
    PROCESSENTRY32W pe;
    pe.dwSize = sizeof(pe);
    DWORD currentPid = GetCurrentProcessId();

    if (Process32FirstW(snapshot, &pe)) {
      do {
        if (pe.th32ProcessID == currentPid) {
          parentPid = pe.th32ParentProcessID;
          break;
        }
      } while (Process32NextW(snapshot, &pe));
    }

    // Now find the parent process name
    if (parentPid != 0) {
      if (Process32FirstW(snapshot, &pe)) {
        do {
          if (pe.th32ProcessID == parentPid) {
            std::wstring parentName(pe.szExeFile);
            // Convert to lowercase for comparison
            for (auto& c : parentName) {
              c = towlower(c);
            }

            // Known debuggers and RE tools as parent processes
            // Note: devenv.exe (Visual Studio) intentionally excluded — it's
            // a normal development environment, flagging it causes false positives
            const wchar_t* suspicious[] = {
              L"ollydbg.exe", L"x64dbg.exe", L"x32dbg.exe",
              L"ida.exe", L"ida64.exe", L"idaq.exe", L"idaq64.exe",
              L"windbg.exe",
              L"processhacker.exe", L"procmon.exe", L"procmon64.exe",
            };

            for (const auto* name : suspicious) {
              if (parentName.find(name) != std::wstring::npos) {
                CloseHandle(snapshot);
                return true;
              }
            }
            break;
          }
        } while (Process32NextW(snapshot, &pe));
      }
    }

    CloseHandle(snapshot);
  }
  return false;

#elif defined(__APPLE__)
  // macOS: use proc_name() from <libproc.h> (no /proc filesystem on macOS)
  pid_t ppid = getppid();
  if (ppid <= 1) {
    return false; // launchd is fine
  }

  char nameBuffer[PROC_PIDPATHINFO_MAXSIZE];
  memset(nameBuffer, 0, sizeof(nameBuffer));
  if (proc_name(ppid, nameBuffer, sizeof(nameBuffer)) > 0) {
    std::string name(nameBuffer);
    // Convert to lowercase
    for (auto& c : name) {
      c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
    }

    const char* suspicious[] = {
      "gdb", "lldb", "radare2", "r2",
      "ida", "ida64", "frida", "frida-server",
    };

    for (const auto* s : suspicious) {
      if (name.find(s) != std::string::npos) {
        return true;
      }
    }
  }

  return false;

#elif defined(__linux__)
  // Linux: read /proc/<ppid>/comm
  pid_t ppid = getppid();
  if (ppid <= 1) {
    return false; // init/systemd is fine
  }

  char path[64];
  snprintf(path, sizeof(path), "/proc/%d/comm", ppid);

  std::ifstream comm(path);
  if (comm.is_open()) {
    std::string name;
    std::getline(comm, name);

    const char* suspicious[] = {
      "gdb", "lldb", "strace", "ltrace", "radare2", "r2",
      "ida", "ida64", "frida", "frida-server",
    };

    for (const auto* s : suspicious) {
      if (name.find(s) != std::string::npos) {
        return true;
      }
    }
  }

  return false;
#else
  return false;
#endif
}

// ============================================================================
// Timing-based detection
// ============================================================================

bool AntiDebug::detectTimingAnomaly() {
  // Measure execution time of a simple operation.
  // If a breakpoint is hit, the time will be much longer than expected.
  auto start = std::chrono::high_resolution_clock::now();

  // Do some busywork that should complete in microseconds
  volatile int sum = 0;
  for (int i = 0; i < 1000; i++) {
    sum += i;
  }
  (void)sum; // suppress unused warning

  auto end = std::chrono::high_resolution_clock::now();
  auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);

  // If this simple loop takes more than 100ms, something is wrong
  return elapsed.count() > 100;
}

// ============================================================================
// Reverse engineering tools detection (Windows)
// ============================================================================

bool AntiDebug::hasReverseEngineeringTools() {
#ifdef _WIN32
  const wchar_t* toolNames[] = {
    L"ollydbg.exe", L"x64dbg.exe", L"x32dbg.exe",
    L"ida.exe", L"ida64.exe", L"idaq.exe", L"idaq64.exe",
    L"wireshark.exe", L"fiddler.exe", L"charles.exe",
    L"processhacker.exe", L"procmon.exe", L"procmon64.exe",
    L"cheatengine", L"dnspy.exe", L"dotpeek.exe",
    L"frida", L"ghidra",
  };

  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return false;
  }

  PROCESSENTRY32W pe;
  pe.dwSize = sizeof(pe);

  if (Process32FirstW(snapshot, &pe)) {
    do {
      std::wstring processName(pe.szExeFile);
      for (auto& c : processName) {
        c = towlower(c);
      }

      for (const auto* tool : toolNames) {
        if (processName.find(tool) != std::wstring::npos) {
          CloseHandle(snapshot);
          return true;
        }
      }
    } while (Process32NextW(snapshot, &pe));
  }

  CloseHandle(snapshot);
  return false;
#else
  // On macOS/Linux, check for common RE tool processes
  // This is less reliable than Windows but still useful
#if defined(__linux__)
  std::ifstream proc("/proc/self/maps");
  if (proc.is_open()) {
    std::string line;
    while (std::getline(proc, line)) {
      // Check for known injection libraries
      if (line.find("frida") != std::string::npos ||
          line.find("xposed") != std::string::npos ||
          line.find("substrate") != std::string::npos) {
        return true;
      }
    }
  }
#endif
  return false;
#endif
}

// ============================================================================
// Combined full check
// ============================================================================

bool AntiDebug::fullCheck() {
  return isDebuggerPresent() ||
         hasSuspiciousParent() ||
         detectTimingAnomaly() ||
         hasReverseEngineeringTools();
}

// ============================================================================
// N-API Exports
// ============================================================================

Napi::Value AntiDebug::IsDebuggerPresent(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), isDebuggerPresent());
}

Napi::Value AntiDebug::HasSuspiciousParent(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), hasSuspiciousParent());
}

Napi::Value AntiDebug::DetectTimingAnomaly(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), detectTimingAnomaly());
}

Napi::Value AntiDebug::FullCheck(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), fullCheck());
}

} // namespace clawdbot
