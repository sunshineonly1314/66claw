# BUG-04: 错误处理缺陷 [中]

## Bug 4.1: CLI JSON.parse 无 try-catch

**位置**: `src/cli/gateway-cli/register.ts:185`  
**严重度**: 中  
**类型**: 未捕获异常  

**问题描述**:
Gateway CLI 中的 `JSON.parse` 调用没有 try-catch 保护。如果网关返回非 JSON 响应（如网络错误、HTML 错误页），CLI 会抛出未捕获的 `SyntaxError`。

**影响**:
- CLI 崩溃
- 用户看到不友好的错误信息

**修复建议**:
```typescript
let parsedData;
try {
  parsedData = JSON.parse(responseText);
} catch (err) {
  log.error(`Invalid JSON response from gateway: ${responseText.substring(0, 200)}`);
  throw new Error("网关返回了无效的响应，请检查网关是否正常运行");
}
```

---

## Bug 4.2: 设备 ID 同步静默失败

**位置**: `src/license/device-id.ts:496-524`  
**严重度**: 中  
**类型**: 错误吞没  

**问题描述**:
`syncDeviceIdToAllLocations()` 在同步设备 ID 到多个配置目录时，所有错误被静默捕获并忽略，没有任何日志或通知。

**影响**:
- 设备 ID 在不同配置目录间不一致
- 授权验证可能因设备 ID 不匹配而失败
- 问题难以诊断

**修复建议**:
```typescript
async function syncDeviceIdToAllLocations(): Promise<void> {
  const locations = getConfigDirectories();
  const errors: Array<{ path: string; error: Error }> = [];
  
  for (const loc of locations) {
    try {
      await writeDeviceId(loc, deviceId);
    } catch (error) {
      errors.push({ path: loc, error: error as Error });
      log.warn(`Failed to sync device ID to ${loc}: ${(error as Error).message}`);
    }
  }
  
  if (errors.length > 0) {
    log.warn(`Device ID sync failed for ${errors.length}/${locations.length} locations`);
  }
}
```

---

## Bug 4.3: 心跳失败缺少升级机制

**位置**: `src/license/heartbeat.ts:164-194`  
**严重度**: 中  
**类型**: 错误处理不足  

**问题描述**:
心跳连续 3 次失败后仅记录警告日志，不会触发用户通知或授权状态变更。用户可能不知道授权即将失效。

**影响**:
- 授权可能在用户不知情的情况下失效
- 离线宽限期静默耗尽

**修复建议**:
```typescript
if (heartbeatState.consecutiveFailures >= 3) {
  log.warn(`Heartbeat failed ${heartbeatState.consecutiveFailures} consecutive times`);
  
  // 触发通知
  if (heartbeatState.consecutiveFailures === 3) {
    notifyUser({
      type: 'warning',
      title: '授权心跳异常',
      message: '连续多次心跳失败，请检查网络连接。如果持续出现，授权可能在离线宽限期后失效。',
    });
  }
  
  // 5次失败后标记状态
  if (heartbeatState.consecutiveFailures >= 5) {
    updateLicenseState({ heartbeatStatus: 'degraded' });
  }
}
```

---

## Bug 4.4: 授权缓存损坏无恢复

**位置**: `src/license/offline.ts:56-78`  
**严重度**: 中  
**类型**: 错误处理不足  

**问题描述**:
`loadLicenseCache()` 在 JSON 解析失败时直接返回 `null`，不尝试恢复。如果缓存文件损坏（如断电导致写入不完整），用户将无法使用离线模式。

**修复建议**:
```typescript
function loadLicenseCache(): LicenseCache | null {
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw) as LicenseCache;
  } catch (err) {
    log.warn(`License cache load failed: ${(err as Error).message}`);
    
    // 尝试加载备份
    try {
      const backup = fs.readFileSync(`${cachePath}.bak`, 'utf-8');
      const cached = JSON.parse(backup) as LicenseCache;
      log.info("Loaded license cache from backup");
      // 恢复主缓存
      fs.writeFileSync(cachePath, backup);
      return cached;
    } catch {
      log.warn("No backup cache available");
    }
    
    return null;
  }
}

// 写入缓存时同时创建备份
function saveLicenseCache(cache: LicenseCache): void {
  const data = JSON.stringify(cache);
  // 先备份当前文件
  try { fs.copyFileSync(cachePath, `${cachePath}.bak`); } catch {}
  fs.writeFileSync(cachePath, data);
}
```

---

## Bug 4.5: RSA 签名验证错误信息不够详细

**位置**: `src/license/verify.ts:182-203`  
**严重度**: 低  
**类型**: 错误诊断困难  

**问题描述**:
RSA 签名验证失败时，抛出通用错误。不区分"签名缺失"和"签名无效"两种情况。

**修复建议**:
```typescript
if (!data.signature) {
  throw new Error("RSA_SIGNATURE_MISSING: 服务端响应缺少签名字段");
}

const verifyResult = verifyLicenseResponseSignature(...);
if (!verifyResult.valid) {
  throw new Error(
    `RSA_SIGNATURE_INVALID: 签名验证失败 - ${verifyResult.error}. ` +
    `Fields: valid=${data.valid}, tier=${data.license?.tier}, serverTime=${data.serverTime}`
  );
}
```

---

## Bug 4.6: 设备指纹生成回退不稳定

**位置**: `src/license/device-id.ts:380-387`  
**严重度**: 中  
**类型**: 逻辑缺陷  

**问题描述**:
当所有硬件 ID 获取失败时，回退到随机 UUID。这意味着每次安装都会生成不同的设备 ID，导致设备绑定不稳定。

**影响**:
- 虚拟机或容器中设备 ID 不一致
- 频繁触发设备切换

**修复建议**:
```typescript
// 使用持久化的随机 ID 作为最后回退
function getFallbackDeviceId(): string {
  const fallbackPath = path.join(configDir, '.device-id-fallback');
  try {
    return fs.readFileSync(fallbackPath, 'utf-8').trim();
  } catch {
    const newId = crypto.randomUUID().replace(/-/g, '');
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    fs.writeFileSync(fallbackPath, newId);
    return newId;
  }
}
```

---

## Bug 4.7: 沙箱容器配置不一致处理

**位置**: `src/agents/sandbox/docker.ts:313-328`  
**严重度**: 低  
**类型**: 错误恢复不完整  

**问题描述**:
当检测到配置哈希不匹配时，处理可能留下不一致状态的容器。

**修复建议**:
```typescript
// 检测到配置变更时，完整重建容器
if (currentHash !== expectedHash) {
  log.info("Sandbox config changed, rebuilding container...");
  try {
    await stopContainer(containerId);
    await removeContainer(containerId);
  } catch (err) {
    log.warn(`Failed to remove old container: ${err}`);
    // 强制删除
    await execDocker(['rm', '-f', containerId]);
  }
  return await createNewContainer(config);
}
```

---

## Bug 4.8: 媒体加载静默失败

**位置**: `src/agents/tools/image-tool.ts:412`  
**严重度**: 低  
**类型**: 错误吞没  

**问题描述**:
图片工具中 `loadWebMedia` 调用可能抛出异常，但异常处理可能不够完整。

**修复建议**:
```typescript
try {
  const media = await loadWebMedia(url, { timeout: 30_000 });
  if (!media) {
    return { error: "无法加载图片，请检查 URL 是否有效" };
  }
  return media;
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : String(err);
  log.warn(`Image load failed: ${errorMsg}`);
  return { error: `图片加载失败: ${errorMsg}` };
}
```
