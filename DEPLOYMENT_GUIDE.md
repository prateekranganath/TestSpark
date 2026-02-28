# TESTSPARK Architecture - Complete Setup Guide
## Backend (Render) + Frontend (Vercel) + 2 HuggingFace Spaces

---

## 📐 Complete Architecture

```
┌──────────────────┐
│    Frontend      │
│    (Vercel)      │
└────────┬─────────┘
         │
         │ REST API calls
         │
┌────────▼─────────────────────────────────────────┐
│         Backend (Render)                         │
│         Node.js + Express + MongoDB              │
│                                                  │
│  Routes:                                         │
│  • /api/eval/comprehensive-test                  │
│  • /api/eval/test-benchmark                      │
│  • /api/eval/benchmark-stats                     │
└─────┬────────────────────────────────────┬──────┘
      │                                    │
      │                                    │
      ▼                                    ▼
┌─────────────────────┐       ┌──────────────────────────┐
│  HF Space #1        │       │  HF Space #2             │
│  Judge Models       │       │  User Models             │
│  (Your Space)       │       │  (Your Space)            │
├─────────────────────┤       ├──────────────────────────┤
│ Base Model +        │       │ Dynamic Model Loading    │
│ Adapters:           │       │                          │
│ • math (AIME)       │       │ Loads on request:        │
│ • msur (MSUR)       │       │ • microsoft/phi-2        │
│ • base (MMLU)       │       │ • TinyLlama/1.1B         │
│                     │       │ • Any model <3B          │
│ Always running      │       │                          │
└─────────────────────┘       └──────────────────────────┘

                    ┌──────────────────────────┐
                    │  User's Own APIs         │
                    │  (Optional)              │
                    ├──────────────────────────┤
                    │ • OpenAI (user's key)    │
                    │ • Anthropic (user's key) │
                    │ • HuggingFace Inference  │
                    │ • Together AI            │
                    └──────────────────────────┘
```

---

## 🎯 User Testing Options

### Option 1: Frontier Models (User Provides API Key)
**User provides:**
- Model name: `gpt-4`, `claude-3-opus`, etc.
- API configuration with their key

**Request Example:**
```json
{
  "modelName": "gpt-4",
  "message": "What is quantum computing?",
  "apiConfig": {
    "baseURL": "https://api.openai.com/v1",
    "apiKey": "sk-..." 
  }
}
```

**Backend routes to:** User's own API endpoint ✅

---

### Option 2: Small Open-Source Models (FREE - No API Key Needed!)
**User provides:**
- Model name from HuggingFace: `microsoft/phi-2`, `TinyLlama/TinyLlama-1.1B-Chat-v1.0`
- Provider: `hf-user-model`

**Request Example:**
```json
{
  "modelName": "microsoft/phi-2",
  "message": "What is quantum computing?",
  "provider": "hf-user-model"
}
```

**Backend routes to:** Your HF User Model Space ✅  
**Space:** Dynamically loads the model and runs inference

---

## 🚀 Deployment Steps

### 1. Deploy Backend to Render

1. **Create Render Web Service:**
   - Connect your GitHub repo
   - Select Node.js environment
   - Build command: `npm install`
   - Start command: `npm run dev` or `npm start`

2. **Environment Variables on Render:**
```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# Models
JUDGE_MODEL=gpt-4
GENERATOR_MODEL=llama2:7b-chat

# HuggingFace Spaces
HF_JUDGE_SPACE_ENDPOINT=https://YOUR_USER-judge-space.hf.space
HF_USER_MODEL_SPACE_ENDPOINT=https://YOUR_USER-user-models.hf.space
HF_SPACE_TOKEN=  # Optional

# Config
PASSING_SCORE=6.0
PORT=3000
```

---

### 2. Deploy HF Space #1 - Judge Models

**Purpose:** Evaluate model responses with benchmark-specific adapters

**Setup:**
1. See [HF_SPACE_SETUP.md](HF_SPACE_SETUP.md)
2. Create Space with base model + adapters
3. Deploy to HuggingFace
4. Copy Space URL → `HF_JUDGE_SPACE_ENDPOINT`

**Cost:** 
- Free CPU tier works
- T4 GPU recommended ($0.60/hour) for faster evaluation

---

### 3. Deploy HF Space #2 - User Models

**Purpose:** Load and run small OSS models on-demand for users

**Setup:**
1. See [HF_USER_MODEL_SPACE.md](HF_USER_MODEL_SPACE.md)
2. Create Space with dynamic model loading
3. Deploy to HuggingFace
4. Copy Space URL → `HF_USER_MODEL_SPACE_ENDPOINT`

**Cost:**
- Free CPU tier (slower, 10-30s per request)
- T4 GPU ($0.60/hour) for better UX

---

### 4. Deploy Frontend to Vercel

1. **Connect GitHub repo**
2. **Configure:**
   - Framework: Next.js / React / Vue (your choice)
   - Build command: `npm run build`
   - Output directory: `dist` or `build`

3. **Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

4. **In frontend code:**
```javascript
// Option 1: Frontier model with user's key
const response = await fetch(`${API_URL}/api/eval/comprehensive-test`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelName: "gpt-4",
    message: userPrompt,
    apiConfig: {
      baseURL: "https://api.openai.com/v1",
      apiKey: userApiKey  // From user input
    }
  })
});

// Option 2: Small OSS model (free!)
const response = await fetch(`${API_URL}/api/eval/comprehensive-test`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelName: "microsoft/phi-2",
    message: userPrompt,
    provider: "hf-user-model"  // Routes to your Space
  })
});
```

---

## 🔄 Request Flow

### Example: User tests `microsoft/phi-2` (no API key)

```
1. User submits model name "microsoft/phi-2" on frontend
   ↓
2. Frontend → Backend (Render)
   POST /api/eval/comprehensive-test
   ↓
3. Backend detects provider="hf-user-model"
   ↓
4. Backend → HF User Model Space
   POST https://your-user-models.hf.space/infer
   { model: "microsoft/phi-2", prompt: "..." }
   ↓
5. HF Space loads microsoft/phi-2, runs inference
   ↓
6. Backend receives response
   ↓
7. Backend → HF Judge Space (for evaluation)
   POST https://your-judge-space.hf.space/infer
   { adapter: "math", prompt: "Evaluate..." }
   ↓
8. Backend runs benchmark validators
   ↓
9. Backend returns complete evaluation to frontend
   ↓
10. Frontend displays results to user
```

---

## 📊 Cost Breakdown

| Component | Free Tier | Paid Option |
|-----------|----------|-------------|
| **Backend (Render)** | Free (sleeps after 15min inactivity) | $7/month (always on) |
| **Frontend (Vercel)** | FREE ✅ | - |
| **MongoDB Atlas** | Free 512MB | - |
| **HF Judge Space** | Free CPU (slower) | T4 GPU $0.60/hour |
| **HF User Model Space** | Free CPU (slower) | T4 GPU $0.60/hour |

**Recommended for production:**
- Render: $7/month (always on)
- HF Spaces: Start free, upgrade to GPU when needed
- **Total: ~$7-25/month**

---

## ✅ Testing Checklist

### Backend (Render):
```bash
# Health check
curl https://your-backend.onrender.com/api/health

# Test with frontier model (provide your own key)
curl -X POST https://your-backend.onrender.com/api/eval/comprehensive-test \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gpt-3.5-turbo",
    "message": "What is 2+2?",
    "apiConfig": {
      "baseURL": "https://api.openai.com/v1",
      "apiKey": "sk-..."
    }
  }'

# Test with small OSS model (no key needed!)
curl -X POST https://your-backend.onrender.com/api/eval/comprehensive-test \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "microsoft/phi-2",
    "message": "What is 2+2?",
    "provider": "hf-user-model"
  }'
```

### HF Judge Space:
```bash
curl https://your-judge-space.hf.space/
# Should return: { "status": "ok", "adapters": ["base", "math", "msur"] }
```

### HF User Model Space:
```bash
curl https://your-user-models.hf.space/
# Should return: { "status": "ok", "max_model_size": "3B parameters" }
```

---

## 🎨 Frontend UI Components

### Model Selection:
```jsx
<select onChange={handleModelChoice}>
  <option value="frontier">Use My API Key (OpenAI, Anthropic, etc.)</option>
  <option value="oss">Use Small Open-Source Model (FREE)</option>
</select>

{modelChoice === 'frontier' && (
  <>
    <input placeholder="Model name (e.g., gpt-4)" />
    <input placeholder="API Key" type="password" />
    <input placeholder="Base URL" />
  </>
)}

{modelChoice === 'oss' && (
  <select>
    <option value="microsoft/phi-2">Phi-2 (2.7B)</option>
    <option value="TinyLlama/TinyLlama-1.1B-Chat-v1.0">TinyLlama (1.1B)</option>
    <option value="stabilityai/stablelm-2-1_6b">StableLM (1.6B)</option>
  </select>
)}
```

---

## 📝 Summary of Changes

1. ✅ **llmservice.js**: Added `inferUserModelSpace()` for dynamic model loading
2. ✅ **.env**: Separated judge and user model Space endpoints
3. ✅ **judgeservice.js**: Updated to use `HF_JUDGE_SPACE_ENDPOINT`
4. ✅ **Documentation**: Created [HF_USER_MODEL_SPACE.md](HF_USER_MODEL_SPACE.md)

---

## 🚦 Next Steps

1. **Deploy HF Judge Space** (see [HF_SPACE_SETUP.md](HF_SPACE_SETUP.md))
2. **Deploy HF User Model Space** (see [HF_USER_MODEL_SPACE.md](HF_USER_MODEL_SPACE.md))
3. **Update `.env`** with both Space URLs
4. **Test locally**: `npm run dev`
5. **Deploy to Render**
6. **Deploy frontend to Vercel**
7. **Test end-to-end!**

🎉 **You now have a production-ready LLM evaluation platform!**
