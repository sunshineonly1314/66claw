# 🚀 快速测试图片粘贴功能

## 立即测试（无需构建）

### 方法 1: 独立测试页面 ⚡ 推荐

1. **打开测试页面**:
   ```bash
   # Windows
   start test-image-paste-enhanced.html

   # 或者手动在浏览器中打开
   file:///d:/codeknowledge/clawdbot-main/clawdbot-main/test-image-paste-enhanced.html
   ```

2. **测试步骤**:
   - ✅ 粘贴截图 (Win+Shift+S → Ctrl+V)
   - ✅ 粘贴 Base64:
     ```
     data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==
     ```
   - ✅ 粘贴 URL:
     ```
     https://picsum.photos/200/300
     ```
   - ✅ 点击 📎 按钮选择图片
   - ✅ 拖拽图片到虚线区域

---

## 在 OpenClawCN 中测试

### 方法 2: 重新构建并运行

```bash
cd d:/codeknowledge/clawdbot-main/clawdbot-main

# 构建前端
pnpm build

# 启动服务
pnpm run dev
```

然后访问: `http://localhost:3333`

### 测试新功能

1. **粘贴 Base64 图片**
   - 复制这段文本:
     ```
     data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==
     ```
   - 在聊天框中按 Ctrl+V
   - ✅ 应该看到一个红色像素的预览

2. **粘贴图片 URL**
   - 复制一个图片链接（例如: `https://picsum.photos/200`）
   - 在聊天框中按 Ctrl+V
   - ✅ 应该自动下载并显示预览

3. **使用文件选择器**
   - 点击聊天框旁边的 📎 按钮
   - 选择一张或多张图片
   - ✅ 应该显示所有图片预览

---

## 🐛 故障排除

### 问题 1: 构建失败

**错误信息**:
```
ELIFECYCLE  Command failed with exit code 123
```

**解决方法**:
```bash
# 清理缓存
pnpm clean
rm -rf node_modules
pnpm install

# 重新构建
pnpm build
```

### 问题 2: 粘贴 URL 下载失败

**原因**: CORS 限制

**解决方法**:
- 使用支持 CORS 的图片服务（如 picsum.photos, placeholder.com）
- 或者改用本地图片文件

### 问题 3: 看不到 📎 按钮

**原因**: CSS 未加载或浏览器缓存

**解决方法**:
```bash
# 强制刷新浏览器
Ctrl+Shift+R  (Windows/Linux)
Cmd+Shift+R   (Mac)

# 或清除浏览器缓存
```

---

## ✅ 验证清单

完成以下测试后打勾:

- [ ] 独立测试页面运行正常
- [ ] 粘贴截图功能正常
- [ ] 粘贴 Base64 功能正常
- [ ] 粘贴 URL 功能正常
- [ ] 文件选择器功能正常
- [ ] 拖拽上传功能正常
- [ ] 📎 按钮显示正常
- [ ] Hover 效果正常
- [ ] 图片预览显示正常
- [ ] 删除图片功能正常

---

## 📞 需要帮助？

如果遇到问题,请检查:

1. **浏览器控制台** (F12 → Console)
   - 查看是否有 JavaScript 错误

2. **网络面板** (F12 → Network)
   - 查看图片是否成功下载

3. **OpenClawCN 日志**
   - 查看后端是否收到图片数据

---

## 🎉 成功标志

如果一切正常,你应该能够:

✅ 在聊天框中粘贴任何格式的图片
✅ 看到图片预览出现在输入框上方
✅ 点击 × 按钮删除预览
✅ 点击发送后,模型能够识别图片内容

---

**下一步**: 阅读 [IMAGE-PASTE-SUMMARY.md](./IMAGE-PASTE-SUMMARY.md) 了解详细的技术实现
