/**
 * Clawdbot License Module - Device ID Management
 * 设备 ID 生成和管理
 *
 * 策略：
 * 1. 优先使用本地存储的 ID（保证稳定性）
 * 2. 首次运行时基于硬件信息 + UUID 生成指纹
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
 * 获取 MAC 地址
 */
function getMacAddress(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const info of iface) {
        // 跳过内部接口和没有 MAC 的接口
        if (info.internal || !info.mac || info.mac === "00:00:00:00:00:00") {
          continue;
        }
        return info.mac;
      }
    }
    return "";
  } catch (error) {
    log.debug(`Failed to get MAC address: ${error}`);
    return "";
  }
}

/**
 * 获取系统机器 ID
 */
function getMachineId(): string {
  try {
    const platform = os.platform();

    if (platform === "win32") {
      // Windows: 使用 wmic 获取 UUID
      const result = execSync("wmic csproduct get uuid", {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      });
      const lines = result.trim().split("\n");
      if (lines.length > 1) {
        return lines[1].trim();
      }
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

    const result = execSync("wmic cpu get processorid", {
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
    log.debug(`Failed to get CPU ID: ${error}`);
    return "";
  }
}

/**
 * 生成设备指纹
 * 基于多种硬件信息生成唯一标识
 */
function generateDeviceFingerprint(): string {
  const parts: string[] = [
    getMacAddress(),
    getMachineId(),
    getCpuId(),
    os.hostname(),
    os.platform(),
    os.arch(),
    // 添加随机部分确保唯一性
    crypto.randomUUID(),
  ];

  // 过滤空值
  const validParts = parts.filter((p) => p && p.trim().length > 0);

  // 生成 SHA256 哈希，取前 32 位
  const hash = crypto
    .createHash("sha256")
    .update(validParts.join("|"))
    .digest("hex");

  return hash.substring(0, 32);
}

/**
 * 获取设备 ID
 *
 * 策略：
 * 1. 优先从本地文件读取（保证稳定性）
 * 2. 不存在则生成新的并保存
 */
export function getDeviceId(): string {
  const filePath = getDeviceIdFilePath();

  try {
    // 尝试读取已保存的 ID
    if (fs.existsSync(filePath)) {
      const savedId = fs.readFileSync(filePath, "utf8").trim();
      if (savedId && savedId.length >= 16) {
        log.debug(`Loaded device ID from cache: ${savedId.substring(0, 8)}...`);
        return savedId;
      }
    }
  } catch (error) {
    log.warn(`Failed to read device ID from file: ${error}`);
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
