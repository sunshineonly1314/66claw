# Windows 虚拟机测试环境搭建指南

## 目的

搭建一个干净的 Windows 虚拟机环境，用于测试 OpenClawCN 安装包，模拟真实用户的全新电脑环境。

---

## 一、硬件要求（宿主机）

| 项目 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 4核（支持虚拟化） | 8核以上 |
| 内存 | 8GB | 16GB以上 |
| 硬盘 | 50GB 可用空间 | 100GB SSD |
| 虚拟化 | 已启用 VT-x/AMD-V | - |

### 检查虚拟化是否启用

打开任务管理器 → 性能 → CPU → 查看"虚拟化"是否显示"已启用"

如未启用，需进入 BIOS 开启：
- Intel CPU：启用 VT-x / Intel Virtualization Technology
- AMD CPU：启用 AMD-V / SVM Mode

---

## 二、软件准备

### 1. 虚拟机软件（任选一个）

| 软件 | 费用 | 下载地址 | 推荐度 |
|------|------|----------|--------|
| **VirtualBox** | 免费 | https://www.virtualbox.org/wiki/Downloads | ⭐⭐⭐⭐⭐ |
| VMware Workstation Player | 免费（个人） | https://www.vmware.com/products/workstation-player.html | ⭐⭐⭐⭐ |
| Hyper-V | 免费（Win Pro） | Windows 内置 | ⭐⭐⭐ |

**推荐使用 VirtualBox**：免费、跨平台、功能完整

### 2. Windows 镜像（ISO）

从微软官网下载正版 Windows ISO：

- **Windows 11**：https://www.microsoft.com/software-download/windows11
- **Windows 10**：https://www.microsoft.com/software-download/windows10

下载 **64位 ISO 文件**（约 5-6GB）

---

## 三、虚拟机配置

### VirtualBox 创建虚拟机步骤

#### 1. 新建虚拟机

```
名称：OpenClawCN-Test-Win11
类型：Microsoft Windows
版本：Windows 11 (64-bit)
```

#### 2. 硬件配置

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| 内存 | 4096 MB | 最少 4GB |
| CPU | 2 核 | 可根据宿主机调整 |
| 显存 | 128 MB | 启用 3D 加速 |
| 硬盘 | 60 GB | 动态分配 VDI |

#### 3. 安装 Windows

1. 挂载下载的 ISO 文件
2. 启动虚拟机，按提示安装 Windows
3. 选择"我没有产品密钥"（测试用）
4. 选择 Windows 11/10 家庭版或专业版
5. 完成安装，创建本地账户

#### 4. 安装增强功能（VirtualBox）

安装完成后：
1. 菜单栏 → 设备 → 安装增强功能
2. 在虚拟机内运行安装程序
3. 重启虚拟机

增强功能提供：
- 共享文件夹
- 剪贴板共享
- 自动调整分辨率

#### 5. 配置共享文件夹

设置 → 共享文件夹 → 添加：

| 配置 | 值 |
|------|-----|
| 文件夹路径 | `D:\codeknowledge\openclawcn-main\openclawcn-main\buildout\windows` |
| 文件夹名称 | `buildout` |
| 只读 | ✅ |
| 自动挂载 | ✅ |
| 挂载点 | `Z:` |

---

## 四、创建测试快照

**重要！** 在安装任何软件之前，创建一个"干净状态"快照：

1. 虚拟机菜单 → 生成快照
2. 名称：`Clean-Windows-Ready`
3. 描述：`干净的 Windows 环境，用于测试安装包`

每次测试前，恢复到此快照即可获得全新环境。

---

## 五、测试流程

### 测试前准备

1. 恢复虚拟机到 `Clean-Windows-Ready` 快照
2. 启动虚拟机
3. 确认共享文件夹可访问（`Z:\` 或网络位置）

### 测试步骤

#### 1. 安装测试

```
测试文件：Z:\OpenClawCN-Lite-Setup-v2026.1.29.exe
```

- [ ] 双击安装包，安装向导正常显示
- [ ] 选择安装路径，点击安装
- [ ] 安装进度正常完成
- [ ] 桌面快捷方式已创建
- [ ] 开始菜单快捷方式已创建

#### 2. 首次运行测试

- [ ] 双击桌面快捷方式启动
- [ ] 命令行窗口显示正常（无乱码）
- [ ] 显示"Installing dependencies..."
- [ ] 依赖下载成功完成（约2-5分钟）
- [ ] 显示"Starting OpenClawCN Gateway..."
- [ ] 浏览器自动打开 http://localhost:18789

#### 3. 功能测试

- [ ] Web 控制台正常加载
- [ ] 可以进入设置页面
- [ ] 关闭窗口后可以再次启动

#### 4. 卸载测试

- [ ] 控制面板 → 程序和功能 → 卸载 OpenClawCN
- [ ] 卸载完成，无残留文件

---

## 六、常见问题排查

### 问题1：共享文件夹无法访问

**解决方案：**
1. 确认已安装增强功能
2. 重启虚拟机
3. 检查共享文件夹设置

### 问题2：安装包闪退

**排查步骤：**
1. 检查安装目录下的 `setup.log` 文件
2. 将日志内容反馈给开发

### 问题3：依赖下载失败

**可能原因：**
- 网络问题：检查虚拟机网络设置（NAT/桥接）
- 镜像问题：手动测试 `ping registry.npmmirror.com`

### 问题4：虚拟机运行很慢

**优化方案：**
1. 增加虚拟机内存到 8GB
2. 增加 CPU 核心数
3. 启用 VT-x/AMD-V 嵌套虚拟化
4. 将虚拟机文件存放在 SSD

---

## 七、测试报告模板

```markdown
## OpenClawCN 安装包测试报告

**测试日期：** 2026-01-29
**测试版本：** OpenClawCN-Lite-Setup-v2026.1.29.exe
**测试环境：** Windows 11 家庭版 (VirtualBox VM)
**测试人员：** XXX

### 测试结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 安装过程 | ✅/❌ | |
| 快捷方式创建 | ✅/❌ | |
| 首次运行 | ✅/❌ | |
| 依赖下载 | ✅/❌ | 耗时: X分钟 |
| Gateway 启动 | ✅/❌ | |
| Web 控制台 | ✅/❌ | |
| 卸载 | ✅/❌ | |

### 问题记录

1. [问题描述]
   - 复现步骤：...
   - 错误日志：...
   - 截图：...

### 结论

[ ] 通过，可以发布
[ ] 存在问题，需要修复
```

---

## 八、快速命令参考

### VirtualBox 命令行（可选）

```bash
# 列出所有虚拟机
VBoxManage list vms

# 启动虚拟机
VBoxManage startvm "OpenClawCN-Test-Win11"

# 恢复快照
VBoxManage snapshot "OpenClawCN-Test-Win11" restore "Clean-Windows-Ready"

# 关闭虚拟机
VBoxManage controlvm "OpenClawCN-Test-Win11" poweroff
```

---

## 九、联系方式

如有问题，请联系开发团队：

- 技术支持：[填写联系方式]
- 问题反馈：[填写反馈渠道]

---

**文档版本：** v1.0  
**最后更新：** 2026-01-29
