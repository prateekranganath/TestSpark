# HuggingFace User Model Space - Setup Instructions

## CONTEXT
I'm building an LLM evaluation backend. This HuggingFace Space will dynamically load and run small HuggingFace models (<3B parameters) on-demand for users who don't have API keys.

## YOUR TASK
Create a HuggingFace Space that:
1. Accepts API requests with a model name (e.g., "microsoft/phi-2")
2. Dynamically loads that model if not already loaded
3. Runs inference and returns results
4. Uses GPU for inference (16GB VRAM recommended)

---

## REQUIREMENTS

### Space Configuration
- **Space SDK:** Gradio (with custom API endpoint)
- **Hardware:** GPU - T4 (16GB) or better
- **Python Version:** 3.10+
- **Visibility:** Public (or private with token authentication)

### API Endpoint
**POST** `/infer`

**Request Body:**
```json
{
  "model": "microsoft/phi-2",
  "prompt": "What is 2+2?",
  "temperature": 0.7,
  "max_tokens": 512,
  "top_p": 1.0
}
```

**Response:**
```json
{
  "text": "4",
  "generated_text": "4",
  "output": "4",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

---

## FILES TO CREATE

### 1. `app.py` (Main Application)

```python
import gradio as gr
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import json
from functools import lru_cache
import gc

# Model cache to avoid reloading
model_cache = {}

@lru_cache(maxsize=3)
def load_model(model_name: str):
    """Load model and tokenizer, cache for reuse"""
    print(f"Loading model: {model_name}")
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True
        )
        model.eval()
        
        return model, tokenizer
    except Exception as e:
        raise ValueError(f"Failed to load model {model_name}: {str(e)}")

def infer(model_name: str, prompt: str, temperature: float = 0.7, 
          max_tokens: int = 512, top_p: float = 1.0):
    """
    Run inference on dynamically loaded model
    """
    try:
        # Validate model size (reject models >3B params)
        model_size_limit = 3_000_000_000  # 3 billion parameters
        
        # Load model and tokenizer
        model, tokenizer = load_model(model_name)
        
        # Count parameters
        param_count = sum(p.numel() for p in model.parameters())
        if param_count > model_size_limit:
            return {
                "error": f"Model too large: {param_count/1e9:.1f}B parameters. Max: 3B",
                "text": "",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            }
        
        # Tokenize input
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        input_length = inputs.input_ids.shape[1]
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=temperature > 0,
                pad_token_id=tokenizer.eos_token_id
            )
        
        # Decode output
        generated_text = tokenizer.decode(outputs[0][input_length:], skip_special_tokens=True)
        output_length = outputs[0].shape[0] - input_length
        
        return {
            "text": generated_text.strip(),
            "generated_text": generated_text.strip(),
            "output": generated_text.strip(),
            "usage": {
                "prompt_tokens": input_length,
                "completion_tokens": output_length,
                "total_tokens": input_length + output_length
            }
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "text": "",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }

def api_inference(request: str):
    """API endpoint handler"""
    try:
        data = json.loads(request)
        
        model_name = data.get("model")
        prompt = data.get("prompt")
        temperature = data.get("temperature", 0.7)
        max_tokens = data.get("max_tokens", 512)
        top_p = data.get("top_p", 1.0)
        
        if not model_name or not prompt:
            return json.dumps({
                "error": "Missing required fields: 'model' and 'prompt'",
                "text": ""
            })
        
        result = infer(model_name, prompt, temperature, max_tokens, top_p)
        return json.dumps(result)
        
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON", "text": ""})
    except Exception as e:
        return json.dumps({"error": str(e), "text": ""})

# Gradio Interface
with gr.Blocks() as demo:
    gr.Markdown("# User Model Space - Dynamic Model Loading")
    gr.Markdown("API Endpoint: POST /infer")
    
    with gr.Tab("API"):
        request_input = gr.Textbox(
            label="Request JSON",
            placeholder='{"model": "microsoft/phi-2", "prompt": "Hello", "max_tokens": 100}',
            lines=5
        )
        response_output = gr.Textbox(label="Response JSON", lines=10)
        submit_btn = gr.Button("Send Request")
        submit_btn.click(api_inference, inputs=request_input, outputs=response_output)
    
    with gr.Tab("Test Interface"):
        model_input = gr.Textbox(label="Model Name", value="microsoft/phi-2")
        prompt_input = gr.Textbox(label="Prompt", value="What is 2+2?", lines=3)
        temp_slider = gr.Slider(0.0, 2.0, value=0.7, label="Temperature")
        max_tokens_slider = gr.Slider(50, 2048, value=512, label="Max Tokens")
        
        test_output = gr.JSON(label="Output")
        test_btn = gr.Button("Test Inference")
        test_btn.click(
            infer,
            inputs=[model_input, prompt_input, temp_slider, max_tokens_slider],
            outputs=test_output
        )
    
    gr.Markdown("""
    ### Supported Models (Examples)
    - microsoft/phi-2 (2.7B)
    - Qwen/Qwen2.5-0.5B-Instruct (0.5B)
    - Qwen/Qwen2.5-1.5B-Instruct (1.5B)
    - TinyLlama/TinyLlama-1.1B-Chat-v1.0 (1.1B)
    - stabilityai/stablelm-2-zephyr-1_6b (1.6B)
    
    Note: Models must be <3B parameters
    """)

demo.launch(server_name="0.0.0.0", server_port=7860)
```

### 2. `requirements.txt`

```txt
torch>=2.0.0
transformers>=4.30.0
accelerate>=0.20.0
gradio>=4.0.0
sentencepiece
protobuf
```

### 3. `README.md`

```markdown
---
title: User Model Space
emoji: 🤖
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 4.0.0
app_file: app.py
pinned: false
license: mit
---

# User Model Space

Dynamic model loading for LLM evaluation. Loads HuggingFace models on-demand (<3B params).

## API Usage

**Endpoint:** POST /infer

**Request:**
\`\`\`json
{
  "model": "microsoft/phi-2",
  "prompt": "What is 2+2?",
  "temperature": 0.7,
  "max_tokens": 512
}
\`\`\`

**Response:**
\`\`\`json
{
  "text": "4",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
\`\`\`
```

---

## DEPLOYMENT STEPS

### Step 1: Create HuggingFace Account
1. Go to https://huggingface.co
2. Sign up or login
3. Create access token: Settings → Access Tokens → New Token

### Step 2: Create New Space
1. Click your profile → New → Space
2. **Space name:** `user-model-space` (or your choice)
3. **License:** MIT
4. **SDK:** Gradio
5. **Hardware:** GPU - T4 (free tier) or upgrade to A10G
6. Click "Create Space"

### Step 3: Upload Files
**Option A: Web Interface**
1. Click "Files" tab
2. Click "Add file" → "Create a new file"
3. Create `app.py` and paste the code above
4. Create `requirements.txt` and paste dependencies
5. Edit `README.md` with the content above

**Option B: Git**
```bash
git clone https://huggingface.co/spaces/YOUR_USERNAME/user-model-space
cd user-model-space
# Copy the 3 files above into this directory
git add .
git commit -m "Initial commit"
git push
```

### Step 4: Configure Hardware
1. Go to Space Settings
2. Under "Hardware" select: **GPU - T4** (free) or **A10G** (paid)
3. Click "Save"
4. Space will restart with GPU

### Step 5: Wait for Build
- Monitor "Logs" tab
- Wait for "Running on http://0.0.0.0:7860"
- Should take 2-5 minutes

### Step 6: Get Your Space URL
Your Space API endpoint will be:
```
https://YOUR_USERNAME-user-model-space.hf.space/infer
```

Example:
```
https://prateek-user-model-space.hf.space/infer
```

### Step 7: Test the API
```bash
curl -X POST https://YOUR_USERNAME-user-model-space.hf.space/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "data": ["{\"model\": \"microsoft/phi-2\", \"prompt\": \"What is 2+2?\", \"max_tokens\": 100}"]
  }'
```

Or use the Gradio API:
```python
from gradio_client import Client

client = Client("YOUR_USERNAME/user-model-space")
result = client.predict(
    '{"model": "microsoft/phi-2", "prompt": "Hello", "max_tokens": 100}',
    api_name="/predict"
)
print(result)
```

---

## TROUBLESHOOTING

### Model Loading Fails
- Ensure model name is correct (check HuggingFace model hub)
- Verify model is <3B parameters
- Check if model requires authentication (use private models with token)

### Out of Memory
- Reduce max_tokens
- Use smaller model (e.g., Qwen2.5-0.5B instead of phi-2)
- Upgrade to A10G GPU (24GB VRAM)

### Slow Inference
- First request is slow (model loading)
- Subsequent requests to same model are faster (cached)
- Consider persistent GPU instance for production

---

## INTEGRATION WITH YOUR BACKEND

Once deployed, update your `.env` file:

```env
HF_USER_MODEL_SPACE_ENDPOINT="https://YOUR_USERNAME-user-model-space.hf.space"
```

Your backend in `services/llmservice.js` will call this endpoint automatically when `provider: "hf-user-model"` is specified.

---

## COST
- **Free Tier:** T4 GPU with limited hours/month
- **Paid Tier:** ~$0.60/hour for A10G GPU
- **Recommendation:** Start with free T4, upgrade if needed

---

## NEXT STEPS
After this Space is working:
1. Test with backend: `POST /api/eval/custom-dataset` with `provider: "hf-user-model"`
2. Create Judge Space (separate instructions)
3. Update README with your Space URL for users
