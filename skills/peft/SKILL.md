---
name: peft-fine-tuning
name_zh: PEFT
description: 使用 LoRA、QLoRA 及 25+ 种方法对大语言模型（LLMs）进行参数高效微调（PEFT）。适用于 GPU 显存受限条件下微调大型模型（7B–70B）、需以 <1% 参数量训练且精度损失极小的场景，或需多适配器服务（multi-adapter serving）的场景。Hugging Face 官方库，深度集成于 transformers 生态系统。
description_zh: 使用 LoRA、QLoRA 及 25+ 种方法对大语言模型（LLMs）进行参数高效微调（PEFT）。适用于 GPU 显存受限条件下微调大型模型（7B–70B）、需以 <1% 参数量训练且精度损失极小的场景，或需多适配器服务（multi-adapter serving）的场景。Hugging Face 官方库，深度集成于 transformers 生态系统。
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Fine-Tuning, PEFT, LoRA, QLoRA, Parameter-Efficient, Adapters, Low-Rank, Memory Optimization, Multi-Adapter]
dependencies: [peft>=0.13.0, transformers>=4.45.0, torch>=2.0.0, bitsandbytes>=0.43.0]
---
# PEFT（参数高效微调）

通过 LoRA、QLoRA 及 25+ 种适配器方法，仅训练 <1% 的参数即可完成 LLM 微调。

## 何时使用 PEFT

**应使用 PEFT/LoRA 的场景**：
- 在消费级 GPU（如 RTX 4090、A100）上微调 7B–70B 规模模型  
- 需训练 <1% 的参数（例如 6MB 适配器 vs 14GB 全量模型）  
- 需快速迭代多个任务专用适配器  
- 需从同一基础模型部署多个微调变体  

**应使用 QLoRA（PEFT + 量化）的场景**：
- 在单张 24GB GPU 上微调 70B 模型  
- 显存是主要瓶颈  
- 可接受相比全量微调约 5% 的质量折损  

**应改用全量微调的场景**：
- 微调小型模型（<1B 参数）  
- 对质量要求极致，且算力预算充足  
- 存在显著领域偏移，需更新全部权重  

## 快速开始

### 安装

```bash
# Basic installation
pip install peft

# With quantization support (recommended)
pip install peft bitsandbytes

# Full stack
pip install peft transformers accelerate bitsandbytes datasets
```

### LoRA 微调（标准方式）

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
from peft import get_peft_model, LoraConfig, TaskType
from datasets import load_dataset

# Load base model
model_name = "meta-llama/Llama-3.1-8B"
model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype="auto", device_map="auto")
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token

# LoRA configuration
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                          # Rank (8-64, higher = more capacity)
    lora_alpha=32,                 # Scaling factor (typically 2*r)
    lora_dropout=0.05,             # Dropout for regularization
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],  # Attention layers
    bias="none"                    # Don't train biases
)

# Apply LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# Output: trainable params: 13,631,488 || all params: 8,043,307,008 || trainable%: 0.17%

# Prepare dataset
dataset = load_dataset("databricks/databricks-dolly-15k", split="train")

def tokenize(example):
    text = f"### Instruction:\n{example['instruction']}\n\n### Response:\n{example['response']}"
    return tokenizer(text, truncation=True, max_length=512, padding="max_length")

tokenized = dataset.map(tokenize, remove_columns=dataset.column_names)

# Training
training_args = TrainingArguments(
    output_dir="./lora-llama",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    fp16=True,
    logging_steps=10,
    save_strategy="epoch"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized,
    data_collator=lambda data: {"input_ids": torch.stack([f["input_ids"] for f in data]),
                                 "attention_mask": torch.stack([f["attention_mask"] for f in data]),
                                 "labels": torch.stack([f["input_ids"] for f in data])}
)

trainer.train()

# Save adapter only (6MB vs 16GB)
model.save_pretrained("./lora-llama-adapter")
```

### QLoRA 微调（内存高效方式）

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import get_peft_model, LoraConfig, prepare_model_for_kbit_training

# 4-bit quantization config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",           # NormalFloat4 (best for LLMs)
    bnb_4bit_compute_dtype="bfloat16",   # Compute in bf16
    bnb_4bit_use_double_quant=True       # Nested quantization
)

# Load quantized model
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-70B",
    quantization_config=bnb_config,
    device_map="auto"
)

# Prepare for training (enables gradient checkpointing)
model = prepare_model_for_kbit_training(model)

# LoRA config for QLoRA
lora_config = LoraConfig(
    r=64,                              # Higher rank for 70B
    lora_alpha=128,
    lora_dropout=0.1,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
# 70B model now fits on single 24GB GPU!
```

## LoRA 参数选择

### 秩（r）——容量与效率权衡

| 秩 | 可训练参数量 | 显存占用 | 质量 | 适用场景 |
|------|-----------------|--------|---------|----------|
| 4 | ~3M | 极低 | 较低 | 简单任务、原型验证 |
| **8** | ~7M | 低 | 良好 | **推荐起始点** |
| **16** | ~14M | 中等 | 更优 | **通用微调** |
| 32 | ~27M | 较高 | 高 | 复杂任务 |
| 64 | ~54M | 高 | 最高 | 领域适配、70B 模型 |

### Alpha（lora_alpha）——缩放因子

```python
# Rule of thumb: alpha = 2 * rank
LoraConfig(r=16, lora_alpha=32)  # Standard
LoraConfig(r=16, lora_alpha=16)  # Conservative (lower learning rate effect)
LoraConfig(r=16, lora_alpha=64)  # Aggressive (higher learning rate effect)
```

### 按架构定位目标模块

```python
# Llama / Mistral / Qwen
target_modules = ["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]

# GPT-2 / GPT-Neo
target_modules = ["c_attn", "c_proj", "c_fc"]

# Falcon
target_modules = ["query_key_value", "dense", "dense_h_to_4h", "dense_4h_to_h"]

# BLOOM
target_modules = ["query_key_value", "dense", "dense_h_to_4h", "dense_4h_to_h"]

# Auto-detect all linear layers
target_modules = "all-linear"  # PEFT 0.6.0+
```

## 加载与合并适配器

### 加载已训练适配器

```python
from peft import PeftModel, AutoPeftModelForCausalLM
from transformers import AutoModelForCausalLM

# Option 1: Load with PeftModel
base_model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B")
model = PeftModel.from_pretrained(base_model, "./lora-llama-adapter")

# Option 2: Load directly (recommended)
model = AutoPeftModelForCausalLM.from_pretrained(
    "./lora-llama-adapter",
    device_map="auto"
)
```

### 将适配器合并至基础模型

```python
# Merge for deployment (no adapter overhead)
merged_model = model.merge_and_unload()

# Save merged model
merged_model.save_pretrained("./llama-merged")
tokenizer.save_pretrained("./llama-merged")

# Push to Hub
merged_model.push_to_hub("username/llama-finetuned")
```

### 多适配器服务（Multi-adapter serving）

```python
from peft import PeftModel

# Load base with first adapter
model = AutoPeftModelForCausalLM.from_pretrained("./adapter-task1")

# Load additional adapters
model.load_adapter("./adapter-task2", adapter_name="task2")
model.load_adapter("./adapter-task3", adapter_name="task3")

# Switch between adapters at runtime
model.set_adapter("task1")  # Use task1 adapter
output1 = model.generate(**inputs)

model.set_adapter("task2")  # Switch to task2
output2 = model.generate(**inputs)

# Disable adapters (use base model)
with model.disable_adapter():
    base_output = model.generate(**inputs)
```

## PEFT 方法对比

| 方法 | 可训练参数占比 | 显存占用 | 速度 | 最适用场景 |
|--------|------------|--------|-------|----------|
| **LoRA** | 0.1–1% | 低 | 快 | 通用微调 |
| **QLoRA** | 0.1–1% | 极低 | 中等 | 显存受限场景 |
| AdaLoRA | 0.1–1% | 低 | 中等 | 自动秩选择 |
| IA3 | 0.01% | 极低 | 最快 | 少样本适配 |
| Prefix Tuning | 0.1% | 低 | 中等 | 生成控制 |
| Prompt Tuning | 0.001% | 极低 | 快 | 简单任务适配 |
| P-Tuning v2 | 0.1% | 低 | 中等 | 自然语言理解（NLU）任务 |

### IA3（参数量极小）

```python
from peft import IA3Config

ia3_config = IA3Config(
    target_modules=["q_proj", "v_proj", "k_proj", "down_proj"],
    feedforward_modules=["down_proj"]
)
model = get_peft_model(model, ia3_config)
# Trains only 0.01% of parameters!
```

### Prefix Tuning

```python
from peft import PrefixTuningConfig

prefix_config = PrefixTuningConfig(
    task_type="CAUSAL_LM",
    num_virtual_tokens=20,      # Prepended tokens
    prefix_projection=True       # Use MLP projection
)
model = get_peft_model(model, prefix_config)
```

## 集成模式

### 与 TRL（SFTTrainer）集成

```python
from trl import SFTTrainer, SFTConfig
from peft import LoraConfig

lora_config = LoraConfig(r=16, lora_alpha=32, target_modules="all-linear")

trainer = SFTTrainer(
    model=model,
    args=SFTConfig(output_dir="./output", max_seq_length=512),
    train_dataset=dataset,
    peft_config=lora_config,  # Pass LoRA config directly
)
trainer.train()
```

### 与 Axolotl（YAML 配置）集成

```yaml
# axolotl config.yaml
adapter: lora
lora_r: 16
lora_alpha: 32
lora_dropout: 0.05
lora_target_modules:
  - q_proj
  - v_proj
  - k_proj
  - o_proj
lora_target_linear: true  # Target all linear layers
```

### 与 vLLM（推理）集成

```python
from vllm import LLM
from vllm.lora.request import LoRARequest

# Load base model with LoRA support
llm = LLM(model="meta-llama/Llama-3.1-8B", enable_lora=True)

# Serve with adapter
outputs = llm.generate(
    prompts,
    lora_request=LoRARequest("adapter1", 1, "./lora-adapter")
)
```

## 性能基准测试

### 显存占用（Llama 3.1 8B）

| 方法 | GPU 显存 | 可训练参数量 |
|--------|-----------|------------------|
| 全量微调 | 60+ GB | 8B（100%） |
| LoRA r=16 | 18 GB | 14M（0.17%） |
| QLoRA r=16 | 6 GB | 14M（0.17%） |
| IA3 | 16 GB | 800K（0.01%） |

### 训练速度（A100 80GB）

| 方法 | tokens/sec | 相比全量微调 |
|--------|-----------|------------|
| 全量微调 | 2,500 | 1x |
| LoRA | 3,200 | 1.3x |
| QLoRA | 2,100 | 0.84x |

### 质量（MMLU 基准测试）

| 模型 | 全量微调 | LoRA | QLoRA |
|-------|---------|------|-------|
| Llama 2-7B | 45.3 | 44.8 | 44.1 |
| Llama 2-13B | 54.8 | 54.2 | 53.5 |

## 常见问题

### 训练期间 CUDA 内存不足（OOM）

```python
# Solution 1: Enable gradient checkpointing
model.gradient_checkpointing_enable()

# Solution 2: Reduce batch size + increase accumulation
TrainingArguments(
    per_device_train_batch_size=1,
    gradient_accumulation_steps=16
)

# Solution 3: Use QLoRA
from transformers import BitsAndBytesConfig
bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4")
```

### 适配器未生效

```python
# Verify adapter is active
print(model.active_adapters)  # Should show adapter name

# Check trainable parameters
model.print_trainable_parameters()

# Ensure model in training mode
model.train()
```

### 质量下降

```python
# Increase rank
LoraConfig(r=32, lora_alpha=64)

# Target more modules
target_modules = "all-linear"

# Use more training data and epochs
TrainingArguments(num_train_epochs=5)

# Lower learning rate
TrainingArguments(learning_rate=1e-4)
```

## 最佳实践

1. **起始秩推荐 r = 8–16**，质量不足时再逐步提高  
2. **alpha 初始值设为 rank × 2**  
3. **优先定位注意力层（attention）与 MLP 层**，兼顾质量与效率  
4. **启用梯度检查点**以节省显存  
5. **高频保存适配器**（文件体积小，便于回滚）  
6. **合并前务必在预留验证集上评估**  
7. **消费级硬件上微调 70B+ 模型时，优先选用 QLoRA**  

## 参考资料

- **[高级用法](references/advanced-usage.md)** —— DoRA、LoftQ、秩稳定化、自定义模块等  
- **[故障排查](references/troubleshooting.md)** —— 常见报错、调试技巧、性能优化  

## 资源链接

- **GitHub 仓库**：https://github.com/huggingface/peft  
- **官方文档**：https://huggingface.co/docs/peft  
- **LoRA 论文**：arXiv:2106.09685  
- **QLoRA 论文**：arXiv:2305.14314  
- **模型中心**：https://huggingface.co/models?library=peft  