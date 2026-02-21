/**
 * OpenClawCN License Module - Device ID Management
 * 设备 ID 生成和管理
 *
 * 策略：
 * 1. 优先使用本地存储的 ID（保证稳定性）
 * 2. 首次运行时基于 BIOS UUID + 物理 MAC 地址生成指纹
 *
 * 设计原则：
 * - 同一硬件重装软件后 ID 不变
 * - 比单一标识更安全（需同时伪造多个才能绕过）
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("license:device");

const DEVICE_ID_FILENAME = ".device_id";

/**
 * 获取设备 ID 存储路径
 */
function getDeviceIdFilePath(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, DEVICE_ID_FILENAME);
}

/**
 * 执行 PowerShell 命令（Windows）
 * 比 wmic 更现代，兼容 Windows 11
 */
function execPowerShell(command: string): string {
  try {
    const result = execSync(`powershell -NoProfile -NonInteractive -Command "${command}"`, {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    return result.trim();
  } catch (error) {
    log.debug(`PowerShell command failed: ${error}`);
    return "";
  }
}

/**
 * 执行 wmic 命令（Windows 后备方案）
 * 兼容老版本 Windows
 */
function execWmic(command: string): string {
  try {
    const result = execSync(command, {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    });
    const lines = result.trim().split("\n");
    if (lines.length > 1) {
      return lines[1].trim();
    }
    return "";
  } catch (error) {
    log.debug(`WMIC command failed: ${error}`);
    return "";
  }
}

/**
 * 获取系统机器 ID（BIOS UUID）
 */
function getMachineId(): string {
  try {
    const platform = os.platform();

    if (platform === "win32") {
      // Windows: 优先使用 PowerShell（兼容 Windows 11）
      let uuid = execPowerShell("(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID");

      // 后备：使用 wmic（兼容老版本 Windows）
      if (!uuid) {
        uuid = execWmic("wmic csproduct get uuid");
      }

      return uuid;
    } else if (platform === "linux") {
      // Linux: 读取 /etc/machine-id
      const machineIdPath = "/etc/machine-id";
      if (fs.existsSync(machineIdPath)) {
        return fs.readFileSync(machineIdPath, "utf8").trim();
      }
      // 备用: /var/lib/dbus/machine-id
      const dbusPath = "/var/lib/dbus/machine-id";
      if (fs.existsSync(dbusPath)) {
        return fs.readFileSync(dbusPath, "utf8").trim();
      }
    } else if (platform === "darwin") {
      // macOS: 使用 ioreg 获取 IOPlatformUUID
      const result = execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
        encoding: "utf8",
        timeout: 5000,
      });
      const match = result.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
    }

    return "";
  } catch (error) {
    log.debug(`Failed to get machine ID: ${error}`);
    return "";
  }
}

/**
 * 获取 CPU ID (Windows only)
 */
function getCpuId(): string {
  try {
    if (os.platform() !== "win32") return "";

    // 优先使用 PowerShell
    let cpuId = execPowerShell("(Get-CimInstance -ClassName Win32_Processor).ProcessorId");

    // 后备：使用 wmic
    if (!cpuId) {
      cpuId = execWmic("wmic cpu get processorid");
    }

    return cpuId;
  } catch (error) {
    log.debug(`Failed to get CPU ID: ${error}`);
    return "";
  }
}

/**
 * 虚拟网卡 MAC 前缀列表（OUI）
 * 用于过滤虚拟网卡，确保获取真实物理网卡 MAC
 */
const VIRTUAL_MAC_PREFIXES = [
  // VMware
  "00:50:56",
  "00:0c:29",
  "00:1c:14",
  "00:05:69",
  // VirtualBox
  "08:00:27",
  "0a:00:27",
  // Hyper-V / Microsoft
  "00:15:5d",
  "00:03:ff",
  // Docker
  "02:42:",
  // Parallels
  "00:1c:42",
  // QEMU/KVM
  "52:54:00",
  // Xen
  "00:16:3e",
  // 本地管理地址（第二位为奇数：x2, x6, xA, xE）
  "02:00:",
  "06:00:",
  "0a:00:",
  "0e:00:",
];

/**
 * 虚拟网卡名称关键词
 */
const VIRTUAL_IFACE_KEYWORDS = [
  "virtual",
  "vmware",
  "vbox",
  "docker",
  "vethernet",
  "wsl",
  "hyper-v",
  "vpn",
  "tunnel",
  "tap",
  "tun",
  "virbr",
  "veth",
];

/**
 * 网卡信息（用于稳定排序）
 */
interface NetworkInterfaceEntry {
  /** 接口名称 */
  name: string;
  /** MAC 地址 */
  mac: string;
  /** 是否有 IPv4 地址（非 APIPA） */
  hasValidIpv4: boolean;
  /** 排序优先级（越小越优先） */
  priority: number;
}

/**
 * 获取物理网卡的 MAC 地址（排除虚拟网卡）
 *
 * 选择策略（按优先级）：
 * 1. 有有效 IPv4 地址的接口（说明在使用中）
 * 2. 有线网卡优先（ethernet/eth）
 * 3. 接口名 + MAC 组合排序（保证稳定性）
 */
function getPhysicalMacAddress(): string {
  try {
    const interfaces = os.networkInterfaces();
    const entries: NetworkInterfaceEntry[] = [];

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;

      // 跳过虚拟网卡名称
      const lowerName = name.toLowerCase();
      if (VIRTUAL_IFACE_KEYWORDS.some((kw) => lowerName.includes(kw))) {
        continue;
      }

      for (const info of iface) {
        if (info.internal || !info.mac || info.mac === "00:00:00:00:00:00") {
          continue;
        }

        // 检查是否为虚拟网卡前缀
        const macLower = info.mac.toLowerCase();
        const isVirtual = VIRTUAL_MAC_PREFIXES.some((prefix) =>
          macLower.startsWith(prefix.toLowerCase()),
        );
        if (isVirtual) {
          continue;
        }

        // 检查是否有有效的 IPv4 地址（排除 APIPA 169.254.x.x）
        const hasValidIpv4 =
          info.family === "IPv4" &&
          !info.address.startsWith("169.254.") &&
          info.address !== "0.0.0.0";

        // 计算优先级（越小越优先）
        let priority = 100;

        // 有有效 IPv4 的接口优先（说明在使用中）
        if (hasValidIpv4) {
          priority -= 50;
        }

        // 有线网卡优先（通常更稳定）
        if (
          lowerName.includes("ethernet") ||
          lowerName.includes("eth") ||
          lowerName.startsWith("en") // macOS 有线
        ) {
          priority -= 20;
        }

        // Wi-Fi 次优先
        if (
          lowerName.includes("wi-fi") ||
          lowerName.includes("wifi") ||
          lowerName.includes("wlan") ||
          lowerName.includes("wireless")
        ) {
          priority -= 10;
        }

        // 避免重复添加同一接口的多个地址
        const existingEntry = entries.find((e) => e.name === name && e.mac === info.mac);
        if (existingEntry) {
          // 更新优先级（取更优的）
          existingEntry.priority = Math.min(existingEntry.priority, priority);
          existingEntry.hasValidIpv4 = existingEntry.hasValidIpv4 || hasValidIpv4;
        } else {
          entries.push({
            name,
            mac: info.mac,
            hasValidIpv4,
            priority,
          });
        }
      }
    }

    if (entries.length === 0) {
      return "";
    }

    // 排序：优先级 → 接口名 → MAC（确保稳定性）
    entries.sort((a, b) => {
      // 首先按优先级
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 然后按接口名（字典序）
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) {
        return nameCompare;
      }
      // 最后按 MAC（字典序）
      return a.mac.localeCompare(b.mac);
    });

    return entries[0].mac;
  } catch (error) {
    log.debug(`Failed to get physical MAC address: ${error}`);
    return "";
  }
}

/**
 * 生成设备指纹
 *
 * 策略：使用 BIOS UUID + 物理 MAC 地址组合
 * - 比单一标识更安全（需同时伪造两个才能绕过）
 * - 比多因素混合更稳定（只有两个核心因素）
 *
 * 降级策略：
 * - 有 UUID + MAC → 组合哈希
 * - 只有 UUID → 单独哈希
 * - 只有 MAC → 单独哈希
 * - 都没有 → CPU ID 或随机 UUID
 */
function generateDeviceFingerprint(): string {
  const machineId = getMachineId();
  const physicalMac = getPhysicalMacAddress();
  const cpuId = getCpuId();

  let fingerprintSource = "";
  let idSource = "";

  if (machineId && physicalMac) {
    // 最佳情况：BIOS UUID + 物理 MAC 组合
    fingerprintSource = `${machineId}|${physicalMac}`;
    idSource = "machine-id+mac";
  } else if (machineId) {
    // 只有 BIOS UUID（可能是 MAC 获取失败）
    fingerprintSource = machineId;
    idSource = "machine-id";
  } else if (physicalMac) {
    // 只有物理 MAC（可能是虚拟机等环境）
    fingerprintSource = physicalMac;
    idSource = "physical-mac";
  } else if (cpuId) {
    // 后备：CPU ID（仅 Windows）
    fingerprintSource = cpuId;
    idSource = "cpu-id";
  }

  if (fingerprintSource) {
    log.debug(`Using ${idSource} as device identifier`);
    // 加上平台信息区分不同 OS（同一硬件双系统场景）
    const hash = crypto
      .createHash("sha256")
      .update(`${fingerprintSource}|${os.platform()}`)
      .digest("hex");
    return hash.substring(0, 32);
  }

  // 极端情况：所有硬件标识都获取失败
  // 使用确定性的系统信息组合，确保同一台机器多次生成的指纹一致
  // （不使用 randomUUID，避免文件丢失后生成完全不同的 ID）
  log.warn("No stable hardware ID found, using deterministic system info fallback");
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : "unknown-cpu";
  const totalMem = os.totalmem();
  let username = "unknown";
  try {
    username = os.userInfo().username;
  } catch {
    /* no HOME env */
  }
  const fallbackId = [
    os.hostname(),
    os.platform(),
    os.arch(),
    cpuModel,
    String(cpus.length),
    String(totalMem),
    username,
  ].join("|");
  const hash = crypto.createHash("sha256").update(fallbackId).digest("hex");
  return hash.substring(0, 32);
}

/**
 * 获取所有可能的设备ID文件路径
 *
 * 场景：用户可能在不同启动方式下使用了不同的配置目录
 * - OpenClawCN 安装版使用 %APPDATA%\OpenClawCN (Windows)
 * - 命令行/开发版使用 ~/.openclawcn
 *
 * 为确保设备ID一致性，需要检查所有可能的位置
 */
function getAlternativeDeviceIdPaths(): string[] {
  const homedir = os.homedir();
  const paths: string[] = [];

  // 1. 当前默认目录: ~/.openclawcn
  paths.push(path.join(homedir, ".openclawcn", DEVICE_ID_FILENAME));

  // 2. 旧版 legacy 目录 (品牌重命名前) — 关键：老用户的 .device_id 在这里
  paths.push(path.join(homedir, ".clawdbot", DEVICE_ID_FILENAME));
  paths.push(path.join(homedir, ".moldbot", DEVICE_ID_FILENAME));
  paths.push(path.join(homedir, ".moltbot", DEVICE_ID_FILENAME));

  // 3. Windows 安装版目录
  if (os.platform() === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      paths.push(path.join(appData, "OpenClawCN", DEVICE_ID_FILENAME));
      // 旧版 Windows 安装路径
      paths.push(path.join(appData, "ClawdbotCN", DEVICE_ID_FILENAME));
    }
  }

  return paths;
}

/**
 * 读取设备ID文件的内容和修改时间
 */
function readDeviceIdFile(filePath: string): { id: string; mtime: Date } | null {
  try {
    if (fs.existsSync(filePath)) {
      const id = fs.readFileSync(filePath, "utf8").trim();
      if (id && id.length >= 16) {
        const stat = fs.statSync(filePath);
        return { id, mtime: stat.mtime };
      }
    }
  } catch {
    // 忽略读取错误
  }
  return null;
}

/**
 * 尝试从其他配置目录迁移设备ID
 *
 * 策略：
 * 1. 检查所有可能的设备ID文件位置
 * 2. 找到第一个有效的设备ID并迁移到当前目录
 * 3. 同步到所有其他目录，确保一致性
 *
 * 注意：这个函数只在当前目录没有设备ID时才被调用
 *
 * 这解决了用户在不同启动方式下配置目录不一致的问题
 */
function tryMigrateDeviceIdFromOtherLocations(targetPath: string): string | null {
  const alternativePaths = getAlternativeDeviceIdPaths();
  const normalizedTarget = path.normalize(targetPath).toLowerCase();

  // 找到第一个有效的设备ID
  let foundId: string | null = null;
  let foundPath: string | null = null;

  for (const altPath of alternativePaths) {
    // 跳过目标路径本身
    if (path.normalize(altPath).toLowerCase() === normalizedTarget) {
      continue;
    }

    const result = readDeviceIdFile(altPath);
    if (result) {
      foundId = result.id;
      foundPath = altPath;
      break; // 找到第一个就停止
    }
  }

  if (!foundId || !foundPath) {
    return null;
  }

  log.info(`Found existing device ID at ${foundPath}, migrating to ${targetPath}...`);

  try {
    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 复制到目标位置
    fs.writeFileSync(targetPath, foundId, "utf8");
    log.info(`Migrated device ID: ${foundId.substring(0, 8)}...`);

    return foundId;
  } catch (error) {
    log.warn(`Failed to migrate device ID: ${error}`);
    return null;
  }
}

/**
 * 同步设备ID到所有可能的配置目录
 * 确保无论用户使用哪种启动方式，设备ID都一致
 */
function syncDeviceIdToAllLocations(deviceId: string, currentPath: string): void {
  const alternativePaths = getAlternativeDeviceIdPaths();
  const normalizedCurrent = path.normalize(currentPath).toLowerCase();

  for (const altPath of alternativePaths) {
    // 跳过当前路径
    if (path.normalize(altPath).toLowerCase() === normalizedCurrent) {
      continue;
    }

    try {
      const altDir = path.dirname(altPath);

      // 只同步到已存在的目录（不主动创建新目录）
      if (!fs.existsSync(altDir)) {
        continue;
      }

      // 检查是否需要同步
      const existing = readDeviceIdFile(altPath);
      if (!existing || existing.id !== deviceId) {
        fs.writeFileSync(altPath, deviceId, "utf8");
        log.debug(`Synced device ID to ${altPath}`);
      }
    } catch (syncErr) {
      log.warn(
        `Failed to sync device ID to ${altPath}: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`,
      );
    }
  }
}

/**
 * 获取设备 ID
 *
 * 策略：
 * 1. 优先从本地文件读取（保证稳定性）
 * 2. 如果不存在，检查其他配置目录并迁移
 * 3. 都不存在则生成新的并保存
 * 4. 同步到所有配置目录，确保一致性
 */
export function getDeviceId(): string {
  const filePath = getDeviceIdFilePath();

  try {
    // 尝试读取已保存的 ID
    if (fs.existsSync(filePath)) {
      const savedId = fs.readFileSync(filePath, "utf8").trim();
      if (savedId && savedId.length >= 16) {
        log.debug(`Loaded device ID from cache: ${savedId.substring(0, 8)}...`);
        // 同步到其他配置目录
        syncDeviceIdToAllLocations(savedId, filePath);
        return savedId;
      }
    }
  } catch (error) {
    log.warn(`Failed to read device ID from file: ${error}`);
  }

  // 尝试从其他配置目录迁移（解决配置目录不一致问题）
  const migratedId = tryMigrateDeviceIdFromOtherLocations(filePath);
  if (migratedId) {
    return migratedId;
  }

  // 生成新的设备 ID
  const newId = generateDeviceFingerprint();
  log.info(`Generated new device ID: ${newId.substring(0, 8)}...`);

  // 保存到本地
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, newId, "utf8");
    log.debug(`Saved device ID to: ${filePath}`);
    // 同步到其他配置目录
    syncDeviceIdToAllLocations(newId, filePath);
  } catch (error) {
    log.warn(`Failed to save device ID to file: ${error}`);
  }

  return newId;
}

/**
 * 获取设备名称
 */
export function getDeviceName(): string {
  return os.hostname() || "Unknown Device";
}

/**
 * 获取设备指纹字符串（32位hex）
 *
 * 与 deviceId 使用相同算法，保证：
 * - 同一硬件生成相同指纹
 * - 重装软件后指纹不变
 *
 * 注意：返回的是字符串，不是对象，服务端直接做字符串相等比较
 * 实际上 deviceFingerprint === deviceId（使用相同的生成算法）
 */
export function getDeviceFingerprint(): string {
  // deviceFingerprint 与 deviceId 使用相同算法
  // 这样服务端可以直接比较：新旧 fingerprint 相等 = 同一硬件
  return getDeviceId();
}

/**
 * 获取操作系统信息
 */
export function getOsInfo(): string {
  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();

  const platformNames: Record<string, string> = {
    win32: "Windows",
    darwin: "macOS",
    linux: "Linux",
  };

  const platformName = platformNames[platform] || platform;
  return `${platformName} ${release} (${arch})`;
}

/**
 * 重置设备 ID（仅用于测试）
 */
export function resetDeviceId(): void {
  const filePath = getDeviceIdFilePath();
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log.info("Device ID reset");
    }
  } catch (error) {
    log.warn(`Failed to reset device ID: ${error}`);
  }
}

/**
 * 设备信息诊断结果
 */
export interface DeviceDiagnostics {
  /** 当前设备 ID */
  deviceId: string;
  /** ID 来源（cached/generated） */
  idSource: "cached" | "generated";
  /** 设备名称 */
  deviceName: string;
  /** 操作系统信息 */
  osInfo: string;
  /** 硬件标识信息 */
  hardware: {
    machineId: string | null;
    cpuId: string | null;
    physicalMac: string | null;
  };
  /** 指纹生成方式 */
  fingerprintMethod: string;
  /** 设备 ID 文件路径 */
  deviceIdPath: string;
  /** 设备 ID 文件是否存在 */
  deviceIdFileExists: boolean;
}

/**
 * 获取设备诊断信息（用于运维排查）
 *
 * 可用于 CLI 命令：openclawcn device-info
 */
export function getDeviceDiagnostics(): DeviceDiagnostics {
  const filePath = getDeviceIdFilePath();
  const fileExists = fs.existsSync(filePath);

  const machineId = getMachineId();
  const cpuId = getCpuId();
  const physicalMac = getPhysicalMacAddress();

  // 判断指纹生成方式
  let fingerprintMethod = "unknown";
  if (machineId && physicalMac) {
    fingerprintMethod = "machine-id+mac";
  } else if (machineId) {
    fingerprintMethod = "machine-id";
  } else if (physicalMac) {
    fingerprintMethod = "physical-mac";
  } else if (cpuId) {
    fingerprintMethod = "cpu-id";
  } else {
    fingerprintMethod = "random-uuid (unstable)";
  }

  return {
    deviceId: getDeviceId(),
    idSource: fileExists ? "cached" : "generated",
    deviceName: getDeviceName(),
    osInfo: getOsInfo(),
    hardware: {
      machineId: machineId || null,
      cpuId: cpuId || null,
      physicalMac: physicalMac || null,
    },
    fingerprintMethod,
    deviceIdPath: filePath,
    deviceIdFileExists: fileExists,
  };
}
