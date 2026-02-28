# HuggingFace Space Setup Guide
## Judge Model with Dynamic Adapter Loading

This guide explains how to set up a HuggingFace Space to serve your judge model with LoRA adapters for different evaluation tasks.

---

## Overview

Your evaluation system now uses a **single base model** with **task-specific adapters** loaded dynamically:

| Task/Benchmark | Adapter Used | Purpose |
|---------------|--------------|---------|
| **AIME** | `math` adapter | Mathematical problem evaluation |
| **MSUR** | `msur` adapter | Undergraduate research math grading |
| **MMLU** | `base` (no adapter) | General knowledge evaluation |
| **Custom/General** | `base` (no adapter) | General prompt evaluation |

---

## Prerequisites

1. HuggingFace account (free tier works!)
2. Base model (e.g., `meta-llama/Llama-2-7b-hf` or any instruction-tuned model)
3. LoRA adapters trained for:
   - **Math adapter**: Fine-tuned on mathematical evaluation tasks
   - **MSUR adapter**: Fine-tuned on MSUR benchmark grading

---

## Step 1: Prepare Your Adapters

### Option A: Use Pre-trained Adapters
```bash
# If you have pre-trained adapters on HuggingFace
# Example structure:
# - your-username/math-judge-adapter
# - your-username/msur-judge-adapter
```

### Option B: Train Your Own
```python
# Train adapters using PEFT (LoRA)
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM

# Base model
base_model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-2-7b-hf")

# LoRA config
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

# Create PEFT model and train...
# Save adapter: model.save_pretrained("./math-adapter")
```

---

## Step 2: Create HuggingFace Space

### 2.1 Create Space
1. Go to https://huggingface.co/spaces
2. Click **New Space**
3. Choose:
   - SDK: **Gradio** or **Docker** (recommended for custom API)
   - Hardware: **Free CPU** (should work) or **T4 GPU** (faster)

### 2.2 Space Code Structure

**Option A: FastAPI with Docker (Recommended)**

Create these files in your Space:

**`Dockerfile`**
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
RUN pip install torch transformers peft fastapi uvicorn accelerate

# Copy app
COPY app.py .
COPY adapters/ ./adapters/

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
```

**`app.py`**
```python
from fastapi import FastAPI, HTTPException
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

app = FastAPI()

# Load base model
BASE_MODEL = "meta-llama/Llama-2-7b-chat-hf"  # or your preferred model
print(f"Loading base model: {BASE_MODEL}")
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto"
)

# Adapter paths (upload to your Space repo)
ADAPTERS = {
    "math": "adapters/math-adapter",      # Path in your Space
    "msur": "adapters/msur-adapter",      # Path in your Space
    "base": None                           # No adapter
}

@app.get("/")
def health():
    return {"status": "ok", "model": BASE_MODEL, "adapters": list(ADAPTERS.keys())}

@app.post("/infer")
async def infer(request: dict):
    try:
        # Extract parameters
        prompt = request.get("prompt")
        adapter_name = request.get("adapter", "base")
        max_tokens = request.get("max_tokens", 512)
        temperature = request.get("temperature", 0.7)
        top_p = request.get("top_p", 1.0)
        
        if not prompt:
            raise HTTPException(status_code=400, detail="prompt is required")
        
        if adapter_name not in ADAPTERS:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid adapter. Choose from: {list(ADAPTERS.keys())}"
            )
        
        # Load model with or without adapter
        if adapter_name == "base" or ADAPTERS[adapter_name] is None:
            model = base_model
            print(f"Using base model (no adapter)")
        else:
            adapter_path = ADAPTERS[adapter_name]
            model = PeftModel.from_pretrained(base_model, adapter_path)
            print(f"Loaded adapter: {adapter_name} from {adapter_path}")
        
        # Tokenize
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=temperature > 0
            )
        
        # Decode
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Remove input prompt from output
        response_text = generated_text[len(prompt):].strip()
        
        return {
            "text": response_text,
            "adapter": adapter_name,
            "usage": {
                "prompt_tokens": inputs.input_ids.shape[1],
                "completion_tokens": outputs.shape[1] - inputs.input_ids.shape[1],
                "total_tokens": outputs.shape[1]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
```

**Option B: Gradio (Simpler, but less performant)**

```python
# app.py
import gradio as gr
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

# ... similar model loading code ...

def generate(prompt, adapter_choice, max_tokens, temperature):
    # ... generation logic ...
    return output

demo = gr.Interface(
    fn=generate,
    inputs=[
        gr.Textbox(label="Prompt"),
        gr.Dropdown(["base", "math", "msur"], label="Adapter"),
        gr.Slider(64, 1024, value=512, label="Max Tokens"),
        gr.Slider(0, 1, value=0.7, label="Temperature")
    ],
    outputs=gr.Textbox(label="Generated Text")
)

demo.launch(server_name="0.0.0.0", server_port=7860)
```

---

## Step 3: Upload Adapters to Space

1. Clone your Space repo:
```bash
git clone https://huggingface.co/spaces/your-username/your-space-name
cd your-space-name
```

2. Create adapters directory structure:
```bash
mkdir -p adapters/math-adapter
mkdir -p adapters/msur-adapter
```

3. Copy your trained adapters:
```bash
cp -r /path/to/your/math-adapter/* adapters/math-adapter/
cp -r /path/to/your/msur-adapter/* adapters/msur-adapter/
```

4. Push to HuggingFace:
```bash
git add .
git commit -m "Add adapters"
git push
```

---

## Step 4: Configure Your Evaluation System

Update `.env`:
```bash
HF_SPACE_ENDPOINT="https://your-username-your-space-name.hf.space"
HF_SPACE_TOKEN=""  # Leave empty for public spaces

JUDGE_MODEL="judge-model"  # Can be any name, not used for HF Space
```

---

## Step 5: Test the Integration

### Test HF Space directly:
```bash
curl -X POST "https://your-space-name.hf.space/infer" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Evaluate this math solution: 2+2=4",
    "adapter": "math",
    "max_tokens": 256,
    "temperature": 0.0
  }'
```

### Test from your evaluation system:
```bash
# Run benchmark loader (if not done already)
node tools/benchmarkLoader.js

# Test comprehensive evaluation
curl -X POST http://localhost:3000/api/eval/comprehensive-test \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gpt-3.5-turbo",
    "message": "What is the capital of France?",
    "apiConfig": {
      "baseURL": "https://api.openai.com/v1",
      "apiKey": "your-key"
    }
  }'
```

---

## Adapter Selection Logic

The system automatically routes to the correct adapter:

```javascript
// In llmservice.js
function getAdapterForBenchmark(benchmarkType) {
    const adapterMap = {
        'aime': 'math',      // AIME uses math adapter
        'msur': 'msur',      // MSUR uses msur adapter
        'mmlu': 'base',      // MMLU uses base model
        'general': 'base',   // General uses base model
        'custom': 'base'     // Custom uses base model
    };
    
    return adapterMap[benchmarkType.toLowerCase()] || 'base';
}
```

No manual intervention needed! 🎉

---

## Performance Optimization

### Free Tier Optimization:
- Use **quantized models** (GPTQ, AWQ)
- Keep adapters small (r=8 or r=16)
- Use CPU inference (slower but free)

### Paid Tier (T4 GPU):
- Costs ~$0.60/hour
- Much faster inference
- Can handle larger models

### Caching:
Add adapter caching to avoid reloading:
```python
# In app.py
from functools import lru_cache

@lru_cache(maxsize=3)
def load_adapter(adapter_name):
    if adapter_name == "base":
        return base_model
    return PeftModel.from_pretrained(base_model, ADAPTERS[adapter_name])
```

---

## Troubleshooting

### Space keeps restarting
- Check logs in Space settings
- Ensure adapters are compatible with base model
- Reduce max_tokens if OOM errors

### Slow inference
- Use T4 GPU hardware
- Enable torch.compile() for faster inference
- Reduce adapter size

### Adapter not loading
- Verify adapter files are present in Space repo
- Check adapter_config.json is valid
- Ensure PEFT version compatibility

---

## Alternative: Direct Adapter Loading

If you don't want to use a Space, you can load adapters locally:

```python
# In your local environment
from peft import PeftModel
from transformers import AutoModelForCausalLM

base_model = AutoModelForCausalLM.from_pretrained("base-model")

# Load adapter from HuggingFace Hub
model_with_adapter = PeftModel.from_pretrained(
    base_model,
    "your-username/math-adapter"
)
```

Then serve via Ollama, vLLM, or any other inference server.

---

## Summary

✅ **What you did:**
- Set up HF Space with base model + adapters
- Automatic adapter routing in code
- Cost-effective judge model serving

✅ **Code changes made:**
- `llmservice.js`: Added `inferHuggingFaceSpace()` and `getAdapterForBenchmark()`
- `mmluvalidator.js`: Uses HF Space with base adapter
- `mmsurvalidator.js`: Uses HF Space with msur adapter
- `judgeservice.js`: Uses HF Space for general evaluation
- `.env`: Added `HF_SPACE_ENDPOINT` configuration

✅ **Next steps:**
1. Create and deploy your HF Space
2. Train/upload adapters
3. Update `.env` with your Space URL
4. Test the integration!

🎯 **Result:** Single judge model, multiple specialized adapters, all on free tier!
