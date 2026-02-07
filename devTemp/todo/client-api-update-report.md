# 客户端 API 对接修改报告

> 修改日期：2026-02-03  
> 修改版本：2026.1.25 → 2026.1.26  
> 对接文档：`server-api-confirm.md`  
> 修改人：技术专家

---

## 一、修改背景

### 1.1 需求来源

服务端开发团队确认了以下安全增强方案，客户端需要同步更新：

1. **心跳接口增加签名验证** - 防止心跳请求伪造
2. **设备列表接口改 POST** - 防止通过 URL 泄露授权码
3. **解绑冷却错误码** - 支持 24 小时冷却期
4. **tier 类型扩展** - 支持 professional/enterprise 等级

### 1.2 相关讨论

服务端团队反馈的问题（见 `server-api-qa.md`）：

> 1. 心跳接口为何没有签名验证？ `/verify` 接口有完整的 `timestamp + nonce + sign` 验证，`/heartbeat` 只有 `key + deviceId`，没有签名。
> 
> 2. 设备列表接口的安全性？ `GET /devices?key=xxx&deviceId=xxx` 没有任何签名，任何知道 key 的人都能查到设备列表。
> 
> 3. 解绑冷却中返回 1009 时，是否需要返回冷却剩余时间？

---

## 二、修改详情

### 2.1 心跳请求增加签名

#### 需求场景

心跳接口用于定期验证授权有效性。**之前**没有签名验证，攻击者可以构造任意心跳请求。

#### 修改前 (`src/license/types.ts`)

```typescript
/**
 * 心跳请求参数
 */
export interface LicenseHeartbeatRequest {
  key: string;
  deviceId: string;
}
```

#### 修改后

```typescript
/**
 * 心跳请求参数
 */
export interface LicenseHeartbeatRequest {
  key: string;
  deviceId: string;
  /** 请求时间戳(毫秒) - 签名参数 */
  timestamp?: number;
  /** 随机字符串(16位) - 签名参数 */
  nonce?: string;
  /** 请求签名 - 签名参数 */
  sign?: string;
}
```

#### 修改前 (`src/license/verify.ts` 第 216-231 行)

```typescript
export async function sendHeartbeat(
  key: string,
): Promise<LicenseHeartbeatResponseData> {
  if (moduleConfig.devMode) {
    return { valid: true, daysRemaining: 999, serverTime: Date.now() };
  }

  const deviceId = getDeviceId();
  const request: LicenseHeartbeatRequest = { key, deviceId };  // ❌ 没有签名

  try {
    const response = await sendRequest<LicenseHeartbeatResponseData>(
      "POST",
      "/heartbeat",
      request,
    );
    // ...
```

#### 修改后

```typescript
export async function sendHeartbeat(
  key: string,
): Promise<LicenseHeartbeatResponseData> {
  if (moduleConfig.devMode) {
    return { valid: true, daysRemaining: 999, serverTime: Date.now() };
  }

  const deviceId = getDeviceId();

  // ✅ 构建带签名的请求
  const request: LicenseHeartbeatRequest = { key, deviceId };
  if (moduleConfig.enableSign) {
    const signParams = generateSignParams(key, deviceId, moduleConfig.signSecretKey);
    request.timestamp = signParams.timestamp;
    request.nonce = signParams.nonce;
    request.sign = signParams.sign;
  }

  try {
    const response = await sendRequest<LicenseHeartbeatResponseData>(
      "POST",
      "/heartbeat",
      request,
    );
    // ...
```

#### 安全效果

- 签名格式与 `/verify` 完全一致：`key|deviceId|timestamp|nonce`
- 服务端可复用同一套验证逻辑
- timestamp 有 ±5 分钟有效期，防止重放攻击

---

### 2.2 设备列表接口改 POST + 签名

#### 需求场景

设备列表接口用于查看和管理绑定的设备。**之前**是 GET 请求，授权码直接暴露在 URL 中，存在安全风险。

#### 修改前 (`src/license/verify.ts` 第 272-285 行)

```typescript
export async function getDeviceList(key: string): Promise<DeviceListResponseData> {
  const deviceId = getDeviceId();

  // ❌ GET 请求，key 暴露在 URL 中，无签名
  const response = await sendRequest<DeviceListResponseData>("GET", "/devices", undefined, {
    key,
    deviceId,
  });

  if (response.code === 200) {
    return response.data;
  }

  throw new Error(`Unexpected response code: ${response.code}`);
}
```

#### 修改后

```typescript
export async function getDeviceList(key: string): Promise<DeviceListResponseData> {
  const deviceId = getDeviceId();

  // ✅ POST 请求 + 签名，key 在请求体中
  const request: DeviceListRequest = { key, deviceId };
  if (moduleConfig.enableSign) {
    const signParams = generateSignParams(key, deviceId, moduleConfig.signSecretKey);
    request.timestamp = signParams.timestamp;
    request.nonce = signParams.nonce;
    request.sign = signParams.sign;
  }

  const response = await sendRequest<DeviceListResponseData>("POST", "/devices", request);

  if (response.code === 200) {
    return response.data;
  }

  throw new Error(`Unexpected response code: ${response.code}`);
}
```

#### 新增类型 (`src/license/types.ts`)

```typescript
/**
 * 设备列表请求参数（POST）
 */
export interface DeviceListRequest {
  key: string;
  deviceId: string;
  /** 请求时间戳(毫秒) - 签名参数 */
  timestamp?: number;
  /** 随机字符串(16位) - 签名参数 */
  nonce?: string;
  /** 请求签名 - 签名参数 */
  sign?: string;
}
```

#### 安全效果

- GET → POST：授权码不再暴露在 URL/日志中
- 增加签名验证：与其他接口安全级别一致

---

### 2.3 设备解绑接口增加签名

#### 需求场景

设备解绑是敏感操作，**之前**没有签名验证，且服务端新增了 24 小时冷却期机制。

#### 修改前 (`src/license/verify.ts` 第 290-304 行)

```typescript
export async function unbindDevice(
  key: string,
  targetDeviceId: string,
): Promise<void> {
  // ❌ 没有签名
  const response = await sendRequest<null>("POST", "/devices/unbind", {
    key,
    deviceId: targetDeviceId,
  });

  if (response.code !== 200) {
    throw new Error(`Failed to unbind device: ${response.message}`);
  }

  log.info(`Device unbound: ${targetDeviceId.substring(0, 8)}...`);
}
```

#### 修改后

```typescript
/**
 * 解绑错误（携带冷却时间等详细信息）
 */
export class UnbindError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: LicenseErrorCode,
    public readonly cooldownRemainingHours?: number,
    public readonly cooldownEndsAt?: string,
  ) {
    super(message);
    this.name = "UnbindError";
  }
}

/**
 * 解绑设备
 */
export async function unbindDevice(
  key: string,
  targetDeviceId: string,
): Promise<DeviceUnbindResponseData> {
  // ✅ 构建带签名的请求
  const currentDeviceId = getDeviceId();
  const request: { key: string; deviceId: string; timestamp?: number; nonce?: string; sign?: string } = {
    key,
    deviceId: targetDeviceId,
  };

  if (moduleConfig.enableSign) {
    const signParams = generateSignParams(key, currentDeviceId, moduleConfig.signSecretKey);
    request.timestamp = signParams.timestamp;
    request.nonce = signParams.nonce;
    request.sign = signParams.sign;
  }

  const response = await sendRequest<DeviceUnbindResponseData>("POST", "/devices/unbind", request);

  if (response.code === 200) {
    const data = response.data;

    if (data.success) {
      log.info(`Device unbound: ${targetDeviceId.substring(0, 8)}...`);
      return data;
    }

    // ✅ 处理冷却错误，返回友好提示
    if (data.errorCode === LicenseErrorCode.ERROR_UNBIND_COOLDOWN && data.cooldownRemainingHours) {
      const hours = data.cooldownRemainingHours;
      const friendlyMsg = hours >= 1
        ? `解绑冷却中，请 ${Math.ceil(hours)} 小时后再试`
        : `解绑冷却中，请 ${Math.ceil(hours * 60)} 分钟后再试`;

      throw new UnbindError(
        friendlyMsg,
        data.errorCode,
        data.cooldownRemainingHours,
        data.cooldownEndsAt,
      );
    }

    throw new UnbindError(errorMsg, data.errorCode);
  }

  throw new Error(`Failed to unbind device: ${response.message}`);
}
```

#### 新增类型 (`src/license/types.ts`)

```typescript
/**
 * 设备解绑响应数据
 */
export interface DeviceUnbindResponseData {
  success: boolean;
  /** 错误码（失败时） */
  errorCode?: LicenseErrorCode;
  /** 错误消息（失败时） */
  errorMessage?: string;
  /** 冷却剩余小时数（1009 错误时） */
  cooldownRemainingHours?: number;
  /** 冷却结束时间 ISO 字符串（1009 错误时） */
  cooldownEndsAt?: string;
}
```

#### 安全效果

- 增加签名验证：防止伪造解绑请求
- 支持冷却期：用户会看到友好的剩余时间提示

---

### 2.4 新增错误码 1009

#### 需求场景

服务端实现了 24 小时解绑冷却期，需要新的错误码来表示"冷却中"状态。

#### 修改前 (`src/license/types.ts` 第 248-265 行)

```typescript
export enum LicenseErrorCode {
  ERROR_KEY_NOT_FOUND = 1001,
  ERROR_KEY_EXPIRED = 1002,
  ERROR_KEY_REVOKED = 1003,
  ERROR_DEVICE_LIMIT = 1004,
  ERROR_KEY_BINDBY_OTHER = 1005,
  ERROR_INVALID_SIGN = 1006,
  ERROR_TIMESTAMP_EXPIRED = 1007,
  ERROR_KEY_EXHAUSTED = 1008,
  // ❌ 缺少 1009
}
```

#### 修改后

```typescript
export enum LicenseErrorCode {
  ERROR_KEY_NOT_FOUND = 1001,
  ERROR_KEY_EXPIRED = 1002,
  ERROR_KEY_REVOKED = 1003,
  ERROR_DEVICE_LIMIT = 1004,
  ERROR_KEY_BINDBY_OTHER = 1005,
  ERROR_INVALID_SIGN = 1006,
  ERROR_TIMESTAMP_EXPIRED = 1007,
  ERROR_KEY_EXHAUSTED = 1008,
  /** 解绑冷却中 */
  ERROR_UNBIND_COOLDOWN = 1009,  // ✅ 新增
}

export const LICENSE_ERROR_MESSAGES: Record<LicenseErrorCode, string> = {
  // ...
  [LicenseErrorCode.ERROR_UNBIND_COOLDOWN]: "解绑冷却中，请稍后再试",  // ✅ 新增
};
```

#### UI 层同步修改 (`ui/src/ui/license/types.ts`)

同样新增了 `ERROR_UNBIND_COOLDOWN = 1009` 和 `UnbindResult` 类型。

---

### 2.5 tier 类型扩展

#### 需求场景

产品等级从 2 种扩展到 4 种：`basic`, `test`, `professional`, `enterprise`。

#### 修改前

```typescript
export interface LicenseInfo {
  /** 产品等级: basic | test */
  tier: "basic" | "test";
  // ...
}
```

#### 修改后

```typescript
export interface LicenseInfo {
  /** 产品等级 */
  tier: "basic" | "test" | "professional" | "enterprise";  // ✅ 扩展
  // ...
}
```

#### 影响范围

- `src/license/types.ts` - 后端类型
- `ui/src/ui/license/types.ts` - UI 类型

---

### 2.6 Gateway 层错误传递

#### 需求场景

Gateway 需要将解绑冷却时间信息传递给 UI 层。

#### 修改前 (`src/gateway/server-methods/license.ts` 第 259-288 行)

```typescript
"license.unbind": async ({ params, respond }) => {
  // ...
  try {
    await unbindDevice(key, sanitizedDeviceId);
    respond(true, { success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    respond(true, { success: false, error: errorMsg });  // ❌ 只返回错误消息
  }
},
```

#### 修改后

```typescript
"license.unbind": async ({ params, respond }) => {
  // ...
  try {
    await unbindDevice(key, sanitizedDeviceId);
    respond(true, { success: true });
  } catch (error) {
    // ✅ 处理解绑特定错误（如冷却中）
    if (error instanceof UnbindError) {
      respond(true, {
        success: false,
        error: error.message,
        errorCode: error.errorCode,
        cooldownRemainingHours: error.cooldownRemainingHours,  // ✅ 传递冷却时间
        cooldownEndsAt: error.cooldownEndsAt,
      });
      return;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    respond(true, { success: false, error: errorMsg });
  }
},
```

---

### 2.7 UI 层错误展示

#### 需求场景

UI 需要展示友好的冷却时间提示。

#### 修改前 (`ui/src/ui/app-render.ts` 第 1017-1026 行)

```typescript
async (deviceId) => {
  const result = await state.client?.request("license.unbind", { deviceId });
  if (result && typeof result === "object" && (result as Record<string, unknown>).success) {
    // 刷新设备列表
    // ...
  }
  // ❌ 失败时没有提示
},
```

#### 修改后

```typescript
async (deviceId) => {
  const result = await state.client?.request("license.unbind", { deviceId });
  if (result && typeof result === "object") {
    const unbindResult = result as Record<string, unknown>;
    if (unbindResult.success) {
      // 刷新设备列表
      // ...
    } else {
      // ✅ 显示解绑错误（如冷却中）
      const errorMsg = unbindResult.error as string || "解绑失败，请稍后重试";
      window.alert(errorMsg);  // 会显示如"解绑冷却中，请 12 小时后再试"
    }
  }
},
```

---

## 三、修改文件清单

| 文件 | 修改类型 | 修改内容 |
|------|----------|----------|
| `src/license/types.ts` | 修改 | 1. `LicenseHeartbeatRequest` 增加签名字段<br>2. 新增 `DeviceListRequest` 类型<br>3. `DeviceUnbindRequest` 增加签名字段<br>4. 新增 `DeviceUnbindResponseData` 类型<br>5. `tier` 类型扩展<br>6. 新增错误码 1009 |
| `src/license/verify.ts` | 修改 | 1. `sendHeartbeat()` 增加签名<br>2. `getDeviceList()` 改 POST + 签名<br>3. `unbindDevice()` 增加签名 + 详细返回<br>4. 新增 `UnbindError` 类 |
| `src/license/index.ts` | 修改 | 导出 `UnbindError` |
| `src/gateway/server-methods/license.ts` | 修改 | 传递冷却时间信息 |
| `ui/src/ui/license/types.ts` | 修改 | 同步错误码和类型 |
| `ui/src/ui/license/license-controller.ts` | 修改 | `unbindDevice()` 返回详细结果 |
| `ui/src/ui/app-render.ts` | 修改 | 显示解绑错误提示 |

**共修改 7 个文件，新增约 150 行代码**

---

## 四、API 变更对照表

| 接口 | 之前 | 之后 |
|------|------|------|
| `/heartbeat` | `{ key, deviceId }` | `{ key, deviceId, timestamp, nonce, sign }` |
| `/devices` | `GET ?key=xxx&deviceId=xxx` | `POST { key, deviceId, timestamp, nonce, sign }` |
| `/devices/unbind` | `{ key, deviceId }` | `{ key, deviceId, timestamp, nonce, sign }` |
| 错误码 | 1001-1008 | 1001-1009（新增冷却） |

---

## 五、签名格式（统一）

所有需要签名的接口，签名格式完全一致：

```
签名内容 = key + "|" + deviceId + "|" + timestamp + "|" + nonce
签名密钥 = "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure"
sign = HMAC-SHA256(签名内容, 签名密钥).toHex()
```

服务端可复用同一套验证代码处理 `/verify`、`/heartbeat`、`/devices`、`/devices/unbind` 四个接口。

---

## 六、测试建议

### 6.1 单元测试

- [ ] `sendHeartbeat()` 生成正确的签名
- [ ] `getDeviceList()` 使用 POST 方法
- [ ] `unbindDevice()` 正确处理 1009 错误
- [ ] `UnbindError` 携带冷却时间信息

### 6.2 集成测试

- [ ] 心跳签名验证（服务端校验通过）
- [ ] 设备列表 POST 请求（服务端正常响应）
- [ ] 解绑冷却提示（UI 显示剩余时间）

### 6.3 兼容性测试

- [ ] 旧版客户端 + 新版服务端（签名可选时兼容）
- [ ] 新版客户端 + 旧版服务端（需服务端先上线）

---

## 七、部署顺序

1. **服务端先上线**（支持新的签名验证，但设为可选）
2. **客户端发布新版**
3. **服务端设为强制签名**（可选，视安全需求）

---

## 八、签署

| 角色 | 状态 | 日期 |
|------|------|------|
| 客户端开发 | ✅ 完成 | 2026-02-03 |
| 代码审核 | 待审核 | - |
| 服务端确认 | 待确认 | - |

---

*报告生成时间: 2026-02-03*
