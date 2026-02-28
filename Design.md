# TESTSPARK - System Design & Architecture

## 🎯 Project Overview

**TESTSPARK** is a comprehensive LLM evaluation platform designed for hackathons and prototyping. It allows users to test any language model (frontier or open-source) against standard benchmarks (AIME, MMLU, MSUR), custom datasets, and generated test cases with adversarial patterns.

### Key Features
- ✅ **Custom Dataset Evaluation** - Test any model with your own JSON data
- ✅ **3 Benchmark Suites** - AIME (math), MMLU (knowledge), MSUR (proofs)
- ✅ **Test Case Generation** - Generate ambiguity, contradiction, negation variants
- ✅ **Multi-Provider Support** - OpenAI, Anthropic, Together AI, HuggingFace
- ✅ **Free Tier Option** - Use small HF models (<3B) without API keys
- ✅ **LLM Judge System** - Semantic evaluation with specialized adapters

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                  Frontend (Vercel)                     │
│              React/Next.js/Vue/Svelte                  │
│                                                        │
│  Features:                                             │
│  • Model selection (Frontier vs OSS)                  │
│  • JSON dataset input with validation                 │
│  • Benchmark testing interface                        │
│  • Results visualization & export                     │
│  • API key management (user's keys)                   │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTPS/REST API
                 │
┌────────────────▼───────────────────────────────────────┐
│              Backend API (Render)                      │
│           Node.js + Express + MongoDB                  │
│                                                        │
│  Services:                                             │
│  • Evaluation Orchestration                           │
│  • Test Case Generation                               │
│  • Model Response Handling                            │
│  • Judge System Integration                           │
│  • Results Storage & Retrieval                        │
└──────┬─────────────────────┬──────────────────────────┘
       │                     │
       │                     │
┌──────▼──────────┐   ┌─────▼────────────────────────────┐
│  Judge Space    │   │    User Model Space              │
│  (HF Space #1)  │   │    (HF Space #2)                 │
├─────────────────┤   ├──────────────────────────────────┤
│ Base Model +    │   │ Dynamic Model Loading:           │
│ Adapters:       │   │ • microsoft/phi-2                │
│ • math (AIME)   │   │ • Qwen/Qwen2.5-0.5B              │
│ • msur (MSUR)   │   │ • TinyLlama-1.1B                 │
│ • base (MMLU)   │   │ • Any model <3B params           │
│                 │   │                                  │
│ + Generation:   │   │ Max: 3B parameters               │
│ • Adversarial   │   │ Cache: Last 1-2 models           │
│   test patterns │   │                                  │
└─────────────────┘   └──────────────────────────────────┘

            ┌────────────────────────────┐
            │   MongoDB Atlas (Cloud)    │
            │                            │
            │  Collections:              │
            │  • evalruns                │
            │  • testcases               │
            │  • modelresponses          │
            │  • judgements              │
            │  • customevals             │
            └────────────────────────────┘

            ┌────────────────────────────┐
            │  External LLM APIs         │
            │  (User's API Keys)         │
            │                            │
            │  • OpenAI (gpt-4)          │
            │  • Anthropic (claude)      │
            │  • Together AI             │
            │  • HuggingFace Inference   │
            └────────────────────────────┘
```

---

## 📊 Data Flow

### Flow 1: Custom Dataset Evaluation (Frontend User Journey)

```
User Action: Paste JSON dataset + Select Model
                    ↓
Frontend: Validate JSON format & fields
                    ↓
POST /api/eval/custom-dataset
                    ↓
Backend Controller (eval.controller.js)
                    ↓
┌──────────────────────────────────────────────┐
│  Route Model Based on Provider:              │
│                                               │
│  IF provider === "hf-user-model"             │
│    → Call User Model Space (FREE, no key)    │
│    → llmservice.inferUserModelSpace()        │
│                                               │
│  ELSE IF provider === "openai"/"anthropic"   │
│    → Call user's API with their key          │
│    → llmservice.llm_call()                   │
└──────────────────┬───────────────────────────┘
                   ↓
        For Each Test Case:
        1. Get model response
        2. Evaluate (exact_match/contains/llm_judge)
        3. Record result
                   ↓
        Store in MongoDB (customevals)
                   ↓
        Return Results to Frontend
                   ↓
Frontend: Display accuracy, pass/fail, individual results
```

### Flow 2: Benchmark Testing

```
User: Select model + benchmark (AIME/MMLU/MSUR)
                    ↓
POST /api/eval/test-benchmark
                    ↓
Backend: Load benchmark suite from /benchmarks folder
                    ↓
For Each Problem:
    ↓
    Get Model Response (User Model OR their API)
    ↓
    Send to Judge Space with appropriate adapter:
    • AIME → math adapter (fn_index: 2)
    • MSUR → msur adapter (fn_index: 2)  
    • MMLU → base model (fn_index: 2)
    ↓
    Judge Returns: {score, reasoning, passed}
    ↓
    Store: modelresponses + judgements
    ↓
Calculate benchmark statistics
                    ↓
Return: Overall accuracy, per-category breakdown
```

### Flow 3: Test Case Generation

```
User: Provide parent prompt + Select patterns
                    ↓
POST /api/generator/generate
Body: {
  parentPromptId: "tc_xxx",
  types: ["ambiguity", "contradiction", "negation"],
  useJudgeSpace: true
}
                    ↓
Backend: generatorservice.js
                    ↓
IF useJudgeSpace && all 3 types:
    → Call Judge Space /generate_all_patterns (fn_index: 3)
    → Returns all 3 variants in ONE call (~1 min)
ELSE:
    → Traditional method (3 separate LLM calls ~3 min)
                    ↓
Store generated test cases in MongoDB
                    ↓
Return: Array of new test cases
```

---

## 🗄️ Database Schema

### Collection: `customevals`
```javascript
{
  _id: ObjectId,
  modelName: String,                    // "gpt-4" or "microsoft/phi-2"
  provider: String,                     // "openai", "hf-user-model", etc.
  evaluationType: String,               // "exact_match", "contains", "llm_judge"
  datasetSize: Number,
  results: {
    total: Number,
    passed: Number,
    failed: Number,
    accuracy: Number                    // Percentage
  },
  individualResults: [{
    index: Number,
    input: String,
    expected: String,
    actual: String,
    passed: Boolean,
    score: Number,
    error: String
  }],
  metadata: {
    userId: String,
    sessionId: String,
    tags: [String]
  },
  status: String,                       // "completed", "failed"
  createdAt: Date,
  completedAt: Date
}
```

### Collection: `evalruns`
```javascript
{
  _id: ObjectId,
  runName: String,
  description: String,
  status: String,                       // "pending", "running", "completed", "failed"
  modelUnderTest: {
    name: String,
    version: String,
    provider: String
  },
  judgeModel: {
    name: String,                       // Server-controlled
    version: String
  },
  testCaseIds: [String],               // References to testcases
  metrics: {
    totalTestCases: Number,
    completedTestCases: Number,
    passedTestCases: Number,
    failedTestCases: Number,
    averageScore: Number,
    averageResponseTime: Number
  },
  benchmarkResults: {
    aime: { accuracy, total, passed },
    mmlu: { accuracy, total, passed },
    msur: { accuracy, total, passed }
  },
  configuration: Object,
  startTime: Date,
  endTime: Date,
  duration: Number
}
```

### Collection: `testcases`
```javascript
{
  _id: String,                         // Custom ID like "tc_ambiguity_..."
  prompt: String,
  generatedBy: String,                 // "user", "llm", "judge-space"
  generationType: String,              // "ambiguity", "contradiction", "negation"
  parentPromptId: String,              // Reference to parent test case
  expectedOutput: String,
  metadata: {
    difficulty: String,
    category: String,
    tags: [String],
    benchmarkType: String,             // "aime", "mmlu", "msur"
    answer: Mixed,
    domain: String,
    subcategory: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Collection: `modelresponses`
```javascript
{
  _id: ObjectId,
  evalRunId: ObjectId,                 // Reference to evalrun
  testCaseId: String,                  // Reference to testcase
  modelName: String,
  modelVersion: String,
  prompt: String,
  response: String,
  responseTime: Number,                // Milliseconds
  tokensUsed: {
    input: Number,
    output: Number
  },
  status: String,                      // "success", "error", "timeout"
  error: String
}
```

### Collection: `judgements`
```javascript
{
  _id: ObjectId,
  evalRunId: ObjectId,
  modelResponseId: ObjectId,
  testCaseId: String,
  judgeModel: String,
  score: Number,                       // 0-10
  reasoning: String,
  criteria: {
    accuracy: Number,
    relevance: Number,
    coherence: Number,
    completeness: Number
  },
  passed: Boolean,                     // score >= 6.0
  feedback: String,
  benchmarkEvaluation: {
    benchmarkType: String,
    expectedAnswer: Mixed,
    modelAnswer: Mixed,
    isCorrect: Boolean
  }
}
```

---

## 🔧 Technical Stack

### Backend (Node.js/Express)
```
├── index.js                 # Server entry point, CORS enabled
├── controllers/             # Request handlers
│   ├── eval.controller.js   # 12 endpoints for evaluation
│   ├── generator.controller.js
│   └── judge.controller.js
├── services/                # Business logic
│   ├── llmservice.js        # LLM routing & Space integration
│   ├── evalservice.js       # Evaluation orchestration
│   ├── generatorservice.js  # Test case generation
│   └── judgeservice.js      # Judgment processing
├── models/                  # MongoDB schemas
├── routes/                  # API routes
├── validators/              # Input/output validation
└── benchmarks/              # AIME, MMLU, MSUR data
```

### HuggingFace Spaces (Python/Gradio)
Both Spaces use **Gradio** framework with `/api/predict` endpoints:

**Request Format:**
```json
POST /api/predict
{
  "data": [param1, param2, param3, ...],
  "fn_index": 2
}
```

**Response Format:**
```json
{
  "data": [output],
  "duration": 1.234
}
```

### Environment Configuration
```bash
# Required for Render deployment
MONGODB_URI=mongodb+srv://...
HF_USER_MODEL_SPACE_ENDPOINT=https://user-space.hf.space
HF_JUDGE_SPACE_ENDPOINT=https://judge-space.hf.space
PORT=3000

# Model configuration
JUDGE_MODEL=gpt-4
GENERATOR_MODEL=llama2:7b-chat
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=1000
```

---

## 🚀 Deployment Architecture

### 1. Backend: Render (Free Tier)
- **Type:** Web Service
- **Runtime:** Node.js 18+
- **Start Command:** `npm start`
- **Build Command:** `npm install`
- **Pros:** 
  - Free tier available
  - Auto-deploy from GitHub
  - Built-in HTTPS
- **Cons:** 
  - Spins down after 15 min inactivity
  - Cold start: ~30 seconds

### 2. Database: MongoDB Atlas (Free M0)
- **Tier:** M0 Sandbox (512MB)
- **Network Access:** 0.0.0.0/0 (allow from anywhere)
- **Connection:** Via connection string in env vars
- **Sufficient for:** 1000s of evaluations

### 3. Judge Space: HuggingFace (CPU Free or GPU Paid)
- **Hardware Options:**
  - CPU Basic (Free) - ~60s inference
  - T4 GPU ($0.60/hr) - ~5s inference
  - A10G GPU ($3/hr) - ~2s inference
- **Recommended:** T4 GPU for hackathon demos

### 4. User Model Space: HuggingFace (CPU Free)
- **Hardware:** CPU Basic (Free)
- **Model Size Limit:** <3B parameters
- **Cache:** Last 1 model in memory
- **Inference Time:** ~60s for Phi-2 (2.7B)

### 5. Frontend: Vercel (Free Tier)
- **Framework:** React/Next.js/Vue/Svelte
- **Build:** Auto-deploy from Git
- **Environment Variable:** `NEXT_PUBLIC_API_URL`
- **Custom Domain:** Supported

---

## 💡 Design Decisions

### Why Two Separate HuggingFace Spaces?

**Option A (Rejected):** One Space for Everything
- ❌ Memory constraints (models + adapters)
- ❌ Switching between tasks requires adapter loading
- ❌ High GPU cost 24/7

**Option B (Chosen):** Two Specialized Spaces
- ✅ Judge Space: Optimized for evaluation (GPU recommended)
- ✅ User Space: Dynamic loading, CPU sufficient for small models
- ✅ Independent scaling
- ✅ Free tier viable for User Space

### Why Gradio Instead of FastAPI?

- ✅ Built-in UI for testing (Space can be used standalone)
- ✅ Automatic API endpoint generation (`/api/predict`)
- ✅ Easy deployment to HF Spaces
- ✅ Good documentation and community support

### Evaluation Strategy: 3 Types

1. **exact_match** - For factual answers (math, dates, names)
2. **contains** - For flexible answers (keywords, partial matches)
3. **llm_judge** - For semantic equivalence (explanations, reasoning)

Frontend should guide users to choose appropriate type.

### Test Case Generation: Judge Space Priority

Default strategy: Use Judge Space for batch generation
- ✅ 3 variants in 1 call (~60s)
- ✅ More efficient than 3 separate calls (~180s)
- ✅ Fallback to traditional method if Space unavailable

---

## 🔐 Security Considerations

### API Keys
- ❌ **NEVER** store user API keys in backend
- ✅ Frontend sends keys in request body
- ✅ Backend uses keys for that request only
- ✅ Keys never logged or persisted

### Input Validation
- Max dataset size: 50 items (prevent abuse)
- Model size limit: 3B parameters (User Space)
- Timeout: 60s per inference
- Request rate limiting: TODO (future enhancement)

### CORS
- Enabled for all origins (`*`) - suitable for hackathon
- Production: Restrict to frontend domain only

---

## 📈 Scalability & Limitations

### Current Limits (Hackathon/Prototype)
- **Custom Dataset:** Max 50 test cases per request
- **Concurrent Requests:** ~5 (Render free tier)
- **Model Size:** Max 3B parameters (User Space)
- **Database:** 512MB storage (MongoDB free tier)

### Future Enhancements
- [ ] Rate limiting per user
- [ ] Webhook support for async evaluation
- [ ] Support for larger models (User provides GPU endpoint)
- [ ] Evaluation result caching
- [ ] User authentication & API keys
- [ ] Real-time progress updates (WebSocket)
- [ ] Batch evaluation queue system

---

## 🧪 Testing Strategy

### Unit Tests (TODO)
- Validator functions
- Model adapters
- Evaluation scoring

### Integration Tests
- Full evaluation flow
- Space API communication
- Database CRUD operations

### Manual Testing Checklist
- ✅ Custom dataset with all 3 eval types
- ✅ Each benchmark (AIME, MMLU, MSUR)
- ✅ Test case generation (all 3 patterns)
- ✅ Frontier model with user API key
- ✅ Free HF model without API key
- ✅ Error handling (invalid JSON, missing keys)

---

## 📚 References

- **Benchmarks:**
  - AIME: American Invitational Mathematics Examination
  - MMLU: Massive Multitask Language Understanding
  - MSUR: Math Undergraduate Research Problems

- **Technologies:**
  - Express.js: https://expressjs.com
  - Mongoose: https://mongoosejs.com
  - HuggingFace Spaces: https://huggingface.co/spaces
  - Gradio: https://gradio.app
  - Render: https://render.com
  - Vercel: https://vercel.com

---

**Last Updated:** February 2026
**Version:** 1.0.0
