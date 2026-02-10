# macOS Gatekeeper 警告解决方案

## 问题现象
用户在macOS上安装ClawdbotCN后，系统弹出警告：
```
未打开 "ClawdbotCN"
Apple无法验证"ClawdbotCN"是否包含可能危害Mac安全或泄漏隐私的恶意软件。
```

## 根本原因
即使应用已经用证书签名，macOS的Gatekeeper还需要应用经过**公证（Notarization）**才能正常打开。公证是Apple的一项安全机制，会扫描应用并为其颁发"通行证"。

## 完整解决流程

### 1. 准备工作

**需要的资源：**
- Apple Developer账号（付费）
- Developer ID Application证书
- App Store Connect API密钥（用于公证）

**创建App Store Connect API密钥：**
1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 进入 Users and Access → Keys
3. 创建新密钥，权限选择"Developer"
4. 下载 `.p8` 文件，记录 Key ID 和 Issuer ID

### 2. 配置公证凭证

在macOS钥匙串中存储公证凭证：

```bash
# 方法1：使用API密钥（推荐）
xcrun notarytool store-credentials "clawdbotcn" \
  --key /path/to/AuthKey_XXXXXXXXXX.p8 \
  --key-id XXXXXXXXXX \
  --issuer XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX

# 方法2：使用Apple ID（需要App专用密码）
xcrun notarytool store-credentials "clawdbotcn" \
  --apple-id "your-email@example.com" \
  --team-id TEAMID \
  --password "xxxx-xxxx-xxxx-xxxx"
```

### 3. 使用签名+公证构建

#### 方法A：使用build-macos-cn.sh（推荐）

```bash
# 设置环境变量
export SIGN_IDENTITY="Developer ID Application: YourCompany (TEAMID)"
export NOTARYTOOL_PROFILE="clawdbotcn"

# 构建（自动签名+公证）
./build/scripts/build-macos-cn.sh
```

脚本会自动：
1. 使用Developer ID证书签名所有二进制文件
2. 提交DMG到Apple进行公证
3. 将公证票据装订（staple）到DMG和.app上

#### 方法B：手动签名和公证已有的.app

如果您已经有构建好的应用：

```bash
# 1. 签名应用
SIGN_IDENTITY="Developer ID Application: YourCompany (TEAMID)" \
  scripts/codesign-mac-app.sh /path/to/ClawdbotCN.app

# 2. 创建ZIP（用于公证）
ditto -c -k --sequesterRsrc --keepParent \
  /path/to/ClawdbotCN.app \
  /tmp/ClawdbotCN-signed.zip

# 3. 提交公证
xcrun notarytool submit /tmp/ClawdbotCN-signed.zip \
  --keychain-profile "clawdbotcn" \
  --wait

# 4. 装订公证票据
xcrun stapler staple /path/to/ClawdbotCN.app

# 5. 验证
xcrun stapler validate /path/to/ClawdbotCN.app
spctl -a -v /path/to/ClawdbotCN.app
```

### 4. 创建公证的DMG分发包

```bash
# 1. 创建DMG
hdiutil create -volname "ClawdbotCN" \
  -srcfolder /path/to/ClawdbotCN.app \
  -ov -format UDZO \
  -imagekey zlib-level=9 \
  /tmp/ClawdbotCN.dmg

# 2. 签名DMG
codesign --force --sign "$SIGN_IDENTITY" --timestamp /tmp/ClawdbotCN.dmg

# 3. 提交DMG公证
xcrun notarytool submit /tmp/ClawdbotCN.dmg \
  --keychain-profile "clawdbotcn" \
  --wait

# 4. 装订DMG
xcrun stapler staple /tmp/ClawdbotCN.dmg

# 5. 验证
xcrun stapler validate /tmp/ClawdbotCN.dmg
spctl -a -t open --context context:primary-signature -v /tmp/ClawdbotCN.dmg
```

### 5. 验证公证状态

```bash
# 检查应用的公证状态
spctl -a -vv /path/to/ClawdbotCN.app

# 预期输出（成功）：
# ClawdbotCN.app: accepted
# source=Notarized Developer ID
```

### 6. 用户端解决方案（临时）

如果应用尚未公证，用户可以通过以下方式临时允许运行：

**方法1：右键打开（推荐）**
1. 右键点击ClawdbotCN.app
2. 选择"打开"
3. 在弹出对话框中点击"打开"

**方法2：系统设置**
1. 系统设置 → 隐私与安全性
2. 在"安全性"部分找到ClawdbotCN的提示
3. 点击"仍要打开"

**方法3：命令行移除隔离属性（仅限开发）**
```bash
xattr -d com.apple.quarantine /Applications/ClawdbotCN.app
```

## 构建脚本参数说明

`build-macos-cn.sh` 公证相关参数：

```bash
# 完整示例
SIGN_IDENTITY="Developer ID Application: YourCo (TEAMID)" \
NOTARYTOOL_PROFILE="clawdbotcn" \
./build/scripts/build-macos-cn.sh

# 跳过公证（测试用）
SKIP_NOTARIZE=1 \
SIGN_IDENTITY="Developer ID Application: YourCo (TEAMID)" \
./build/scripts/build-macos-cn.sh
```

**关键环境变量：**
- `SIGN_IDENTITY`: Developer ID证书名称（不设置会自动检测）
- `NOTARYTOOL_PROFILE`: 钥匙串中存储的公证凭证名称
- `SKIP_NOTARIZE=1`: 跳过公证步骤（仅用于测试）

## 常见问题

### Q: 公证需要多久？
A: 通常5-15分钟，高峰期可能更长。`--wait` 参数会等待完成。

### Q: 公证失败怎么办？
A: 查看失败日志：
```bash
xcrun notarytool log <submission-id> --keychain-profile "clawdbotcn"
```
常见原因：
- 未签名所有二进制文件（.node模块、node可执行文件等）
- 缺少hardened runtime
- 未使用timestamp

### Q: 能否使用免费Apple Developer账号？
A: 不能。公证需要付费的Apple Developer Program账号（$99/年）。

### Q: ad-hoc签名能否通过Gatekeeper？
A: 不能。ad-hoc签名只能满足代码签名要求，但无法通过Gatekeeper。必须使用Developer ID。

### Q: 公证后还需要重新签名吗？
A: 不需要。staple只是附加公证票据，不会改变签名。

## 自动化CI/CD

在GitHub Actions中自动化公证：

```yaml
- name: Notarize app
  env:
    NOTARYTOOL_KEY: ${{ secrets.NOTARYTOOL_KEY }}
    NOTARYTOOL_KEY_ID: ${{ secrets.NOTARYTOOL_KEY_ID }}
    NOTARYTOOL_ISSUER: ${{ secrets.NOTARYTOOL_ISSUER }}
    SIGN_IDENTITY: ${{ secrets.SIGN_IDENTITY }}
  run: |
    # 导入证书
    echo "$SIGNING_CERT_P12" | base64 --decode > cert.p12
    security import cert.p12 -P "$CERT_PASSWORD"

    # 签名+公证
    ./build/scripts/build-macos-cn.sh
```

## 参考文档

- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [notarytool官方文档](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)
- 项目内部：[docs/platforms/mac/signing.md](signing.md)
