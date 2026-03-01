---
name: meshy-ai
name_zh: MeshyAI技能
description: "通过 Meshy.ai REST API 生成资源：（1）文本生成二维图像（Meshy Text to Image）和（2）图像生成三维模型，并将输出结果下载至本地。当用户需要使用 Meshy 生成内容、需轮询异步任务，尤其是希望将生成的 OBJ 文件保存至磁盘时使用。需在环境中设置 MESHY_API_KEY。"
description_zh: 通过 Meshy.ai REST API 生成资源：（1）文本生成二维图像（Meshy Text to Image）和（2）图像生成三维模型，并将输出结果下载至本地。当用户需要使用 Meshy 生成内容、需轮询异步任务，尤其是希望将生成的 OBJ 文件保存至磁盘时使用。需在环境中设置 MESHY_API_KEY。
---
# Meshy.ai

通过 API 生成 Meshy 资源，并将输出结果保存至本地。

## 初始化设置

- 添加环境变量：`MESHY_API_KEY=msy-...`
- 可选：`MESHY_BASE_URL`（默认值为 `https://api.meshy.ai`）

## 文本 → 2D（文本生成图像）

使用 `scripts/text_to_image.py`。

```bash
python3 skills/public/meshy-ai/scripts/text_to_image.py \
  --prompt "a cute robot mascot, flat vector style" \
  --out-dir ./meshy-out
```

- 将一张或多张图像（若启用 multi-view）下载至 `./meshy-out/text-to-image_<taskId>_<slug>/`。

## 图像 → 3D（始终保存 OBJ）

使用 `scripts/image_to_3d_obj.py`。

### 本地图像

```bash
python3 skills/public/meshy-ai/scripts/image_to_3d_obj.py \
  --image ./input.png \
  --out-dir ./meshy-out
```

### 公开 URL

```bash
python3 skills/public/meshy-ai/scripts/image_to_3d_obj.py \
  --image-url "https://.../input.png" \
  --out-dir ./meshy-out
```

- 始终下载 `model.obj`（若 Meshy 提供，则同时下载 `model.mtl`）至 `./meshy-out/image-to-3d_<taskId>_<slug>/`。

## 注意事项

- Meshy 任务为异步：创建 → 轮询直至 `status=SUCCEEDED` → 下载对应 URL。
- 本 skill 所用 API 参考文档：`references/api-notes.md`。