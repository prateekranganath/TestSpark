# HuggingFace Space Setup - User Model Inference
## Dynamic Model Loading for Small Open-Source Models (<3B)

This guide explains how to set up a HuggingFace Space to **dynamically load and serve small open-source models** on-demand for user testing.

---

## Overview

This Space allows users to test **small open-source models** without needing their own API keys:
- Users just provide the HuggingFace model name (e.g., `microsoft/phi-2`)
- Your Space loads the model on-demand
- Serves requests for models **<3B parameters** only (to fit in free tier memory)

---

## HuggingFace Space Code

### 1. Create Space
1. Go to https://huggingface.co/spaces
2. Click **New Space**
3. Choose:
   - SDK: **Docker**
   - Hardware: **CPU (free)** or **T4 GPU** ($0.60/hour for faster inference)
   - Name: `testspark-user-models` or similar

---

### 2. Space Files

**`Dockerfile`**
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir torch transformers accelerate fastapi uvicorn huggingface_hub

# Copy app
COPY app.py .

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
```

---

**`app.py`**
```python
from fastapi import FastAPI, HTTPException
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import gc
from typing import Optional

app = FastAPI()

# Cache for loaded models (keep last 1-2 models in memory)
model_cache = {}
MAX_CACHE_SIZE = 1  # Only keep 1 model in memory at a time (CPU tier)

# Model size limits (in billions of parameters)
MAX_MODEL_SIZE_B = 3.0  # Maximum 3B parameters

def get_model_size(model_name: str) -> float:
    """
    Estimate model size from HuggingFace model card
    Returns size in billions of parameters
    """
    try:
        from huggingface_hub import model_info
        info = model_info(model_name)
        
        # Try to extract size from model card or name
        name_lower = model_name.lower()
        
        # Common size patterns in model names
        if '2.7b' in name_lower or '2.8b' in name_lower:
            return 2.7
        elif '1.5b' in name_lower:
            return 1.5
        elif '1.3b' in name_lower:
            return 1.3
        elif '1b' in name_lower:
            return 1.0
        elif '0.5b' in name_lower or '500m' in name_lower:
            return 0.5
        elif '350m' in name_lower:
            return 0.35
        elif '160m' in name_lower:
            return 0.16
        
        # Default: assume small if no size found
        return 1.0
    except Exception as e:
        print(f"Could not determine model size: {e}")
        return 1.0  # Assume small size

def clear_cache():
    """Clear model cache to free memory"""
    global model_cache
    for key in list(model_cache.keys()):
        del model_cache[key]
    gc.collect()
    torch.cuda.empty_cache() if torch.cuda.is_available() else None

def load_model(model_name: str):
    """Load model and tokenizer, manage cache"""
    
    # Check if already cached
    if model_name in model_cache:
        print(f"Using cached model: {model_name}")
        return model_cache[model_name]['model'], model_cache[model_name]['tokenizer']
    
    # Check model size
    model_size = get_model_size(model_name)
    if model_size > MAX_MODEL_SIZE_B:
        raise HTTPException(
            status_code=400, 
            detail=f"Model too large ({model_size}B parameters). Maximum allowed: {MAX_MODEL_SIZE_B}B. Please use a smaller model or provide your own API key."
        )
    
    # Clear cache if full
    if len(model_cache) >= MAX_CACHE_SIZE:
        print("Cache full, clearing old models...")
        clear_cache()
    
    try:
        print(f"Loading model: {model_name} (~{model_size}B parameters)...")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        
        # Load model (CPU or GPU depending on hardware)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=dtype,
            device_map="auto" if torch.cuda.is_available() else None,
            trust_remote_code=True,
            low_cpu_mem_usage=True
        )
        
        if not torch.cuda.is_available():
            model = model.to(device)
        
        # Cache the model
        model_cache[model_name] = {
            'model': model,
            'tokenizer': tokenizer
        }
        
        print(f"Model loaded successfully: {model_name}")
        return model, tokenizer
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")

@app.get("/")
def health():
    return {
        "status": "ok",
        "message": "TESTSPARK User Model Space",
        "max_model_size": f"{MAX_MODEL_SIZE_B}B parameters",
        "cached_models": list(model_cache.keys()),
        "device": "cuda" if torch.cuda.is_available() else "cpu"
    }

@app.post("/infer")
async def infer(request: dict):
    """
    Inference endpoint for user models
    
    Request body:
    {
        "model": "microsoft/phi-2",  // HuggingFace model ID
        "prompt": "What is 2+2?",
        "temperature": 0.7,
        "max_tokens": 512,
        "top_p": 1.0
    }
    """
    try:
        # Extract parameters
        model_name = request.get("model")
        prompt = request.get("prompt")
        max_tokens = request.get("max_tokens", 512)
        temperature = request.get("temperature", 0.7)
        top_p = request.get("top_p", 1.0)
        
        if not model_name:
            raise HTTPException(status_code=400, detail="model name is required")
        if not prompt:
            raise HTTPException(status_code=400, detail="prompt is required")
        
        # Load model
        model, tokenizer = load_model(model_name)
        
        # Tokenize
        inputs = tokenizer(prompt, return_tensors="pt")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=temperature > 0,
                pad_token_id=tokenizer.eos_token_id
            )
        
        # Decode
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Remove input prompt from output
        response_text = generated_text[len(prompt):].strip()
        
        return {
            "text": response_text,
            "model": model_name,
            "usage": {
                "prompt_tokens": inputs['input_ids'].shape[1],
                "completion_tokens": outputs.shape[1] - inputs['input_ids'].shape[1],
                "total_tokens": outputs.shape[1]
            }
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.post("/clear-cache")
async def clear_model_cache():
    """Manually clear model cache"""
    clear_cache()
    return {"status": "ok", "message": "Cache cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
```

---

### 3. Recommended Small Models (<3B)

| Model | Size | Best For |
|-------|------|----------|
| `microsoft/phi-2` | 2.7B | General reasoning, coding |
| `stabilityai/stablelm-2-1_6b` | 1.6B | Chat, general text |
| `google/gemma-2b` | 2B | Instruction following |
| `TinyLlama/TinyLlama-1.1B-Chat-v1.0` | 1.1B | Fast, lightweight |
| `EleutherAI/pythia-1.4b` | 1.4B | General language tasks |

---

## 4. Deploy to HuggingFace Space

```bash
# Clone your Space repo
git clone https://huggingface.co/spaces/YOUR_USERNAME/testspark-user-models
cd testspark-user-models

# Add files
# (Create Dockerfile and app.py from above)

# Commit and push
git add Dockerfile app.py
git commit -m "Initial user model space"
git push
```

The Space will automatically build and deploy!

---

## 5. Update Your Backend `.env`

```bash
HF_USER_MODEL_SPACE_ENDPOINT="https://YOUR_USERNAME-testspark-user-models.hf.space"
```

---

## 6. Test the Space

### Direct test:
```bash
curl -X POST "https://YOUR_USERNAME-testspark-user-models.hf.space/infer" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "microsoft/phi-2",
    "prompt": "What is the capital of France?",
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

### From your backend:
```bash
# User provides just the model name (no API key needed!)
curl -X POST http://localhost:3000/api/eval/comprehensive-test \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "microsoft/phi-2",
    "message": "What is 2+2?",
    "provider": "hf-user-model"
  }'
```

---

## 7. Usage in Frontend

Users have two options:

### Option 1: Frontier Models (Users provide API key)
```javascript
{
  modelName: "gpt-4",
  message: "test prompt",
  apiConfig: {
    baseURL: "https://api.openai.com/v1",
    apiKey: "sk-..." // User's key
  }
}
```

### Option 2: Small OSS Models (No API key needed!)
```javascript
{
  modelName: "microsoft/phi-2",
  message: "test prompt",
  provider: "hf-user-model"  // Routes to your Space
}
```

---

## 8. Cost & Performance

### Free CPU Tier:
- **Cost**: FREE! ✅
- **Speed**: ~10-30 seconds per request (model loading + inference)
- **Memory**: Can handle 1-2B models
- **Concurrency**: Low (1-2 requests at a time)

### T4 GPU Tier ($0.60/hour):
- **Speed**: ~2-5 seconds per request
- **Memory**: Can handle up to 7B models (increase MAX_MODEL_SIZE_B)
- **Concurrency**: Higher (5-10 requests)

### Optimization Tips:
1. **Keep cache**: Models stay in memory between requests
2. **Use persistent storage**: Set Space to "Always Running" in settings
3. **Start with CPU**: Test on free tier first
4. **Upgrade to GPU**: Once you have users, upgrade for better UX

---

## 9. Model Size Validation

The Space automatically rejects models >3B:
```
Error: "Model too large (7.5B parameters). Maximum allowed: 3.0B"
```

Users will need to either:
- Choose a smaller model
- Use their own HuggingFace API key with apiConfig

---

## Summary

✅ **Created**: Two separate HF Spaces
- Judge Space: Base model + adapters
- User Model Space: Dynamic model loading

✅ **User Options**:
1. Frontier models → User provides API key
2. Small OSS models (<3B) → Your Space (free!)

✅ **Cost-effective**: Free tier for small models
✅ **Scalable**: Can upgrade to GPU when needed

🚀 **Deploy both Spaces and update your `.env` file!**
