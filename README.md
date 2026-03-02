# TESTSPARK - LLM Evaluation Platform

<p align="center">
  <strong>Comprehensive LLM testing with benchmarks, custom datasets, and adversarial test case generation</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-endpoints">API Endpoints</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#frontend-integration">Frontend Integration</a>
</p>

---

## ✨ Features

- **🤖 Session-Based Model Management** ⭐ NEW - Initialize once, use for multiple evals with loading progress
- **🎯 Custom Dataset Evaluation** - Test any LLM with your own JSON datasets
- **📊 Standard Benchmarks** - AIME (math), MMLU (knowledge), MSUR (proofs)
- **🔄 Test Case Generation** - Generate adversarial variants (ambiguity, contradiction, negation)
- **🆓 Free Tier Support** - Use small HF models (<3B params) without API keys
- **🔑 Frontier Model Support** - Test GPT-4, Claude, etc. with your own API keys
- **⚖️ LLM Judge System** - Semantic evaluation with specialized adapters
- **📈 Result Analytics** - Detailed scoring, pass/fail rates, per-category breakdown

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier)
- HuggingFace account (for Spaces)

### Local Development

```bash
# 1. Clone repository
git clone <your-repo-url>
cd TESTSPARK

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and Space URLs

# 4. Start development server
npm run dev

# Server runs on http://localhost:3000
```

### Environment Variables

```bash
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/eval

# HuggingFace Spaces
HF_USER_MODEL_SPACE_ENDPOINT=https://your-user-space.hf.space
HF_JUDGE_SPACE_ENDPOINT=https://your-judge-space.hf.space
HF_SPACE_TOKEN=                          # Optional

# Configuration
PORT=3000
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=1000
JUDGE_MODEL=gpt-4
```

---

## 📡 API Endpoints

**Base URL:** `http://localhost:3000` (development) or `https://testspark-api.onrender.com` (production)

All endpoints return JSON with the following structure:
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

### Health & Info

#### `GET /`
Get API information and available endpoints.

**Response:**
```json
{
  "message": "LLM Evaluation API",
  "version": "1.0.0",
  "endpoints": {
    "evaluation": "/api/eval",
    "generator": "/api/generator",
    "judge": "/api/judge",
    "runs": "/api/runs",
    "dashboard": "/api/dashboard",
    "compare": "/api/compare",
    "generate": "/api/generate (POST)",
    "judgeEvaluate": "/api/judge (POST)"
  }
}
```

#### `GET /api/health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-03-02T12:00:00.000Z",
  "database": "connected"
}
```

### Frontend-Compatible Aliases

The following short-path aliases are available for frontend integration:

| Alias | Maps To | Method | Description |
|-------|---------|--------|-------------|
| `/api/runs` | `/api/eval/history` | GET | Evaluation run history |
| `/api/dashboard` | `/api/eval/dashboard` | GET | Dashboard statistics |
| `/api/compare` | `/api/eval/compare` | GET | Model comparison |
| `/api/generate` | `/api/generator/generate` | POST | Generate test cases |
| `/api/judge` | `/api/judge/evaluate` | POST | Judge evaluation |

**Both paths work** - use whichever your frontend expects.

---

## � Model Initialization Endpoints (`/api/model`) ⭐ NEW

Session-based model management for improved UX. Initialize a model once, use it for multiple evaluations.

### Benefits
- **Configure once** - No need to re-enter model details for each eval
- **Loading visibility** - Track HuggingFace model warmup progress (2-5 min)
- **Session persistence** - Model stays "warm" for 24 hours
- **Better UX** - Frontend can show loading indicators and status

### 1. Initialize Model

#### `POST /api/model/initialize`

Store model configuration in session and trigger warmup for HuggingFace models.

**Request Body:**
```json
{
  "modelProvider": "huggingface",
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "baseUrl": "https://neollm007-user-model-space.hf.space",
  "apiKey": "optional",
  "adapter": "optional-lora-adapter"
}
```

**Response (HuggingFace - Loading):**
```json
{
  "success": true,
  "message": "Model initialization started",
  "status": "loading",
  "sessionId": "sess_abc123",
  "estimatedTime": "2-5 minutes for first load",
  "note": "Poll /api/model/status to check when model is ready"
}
```

**Response (OpenAI/Anthropic - Instant):**
```json
{
  "success": true,
  "message": "Model initialized successfully",
  "status": "ready",
  "sessionId": "sess_abc123",
  "modelProvider": "openai",
  "modelName": "gpt-4"
}
```

### 2. Check Model Status

#### `GET /api/model/status`

Poll this endpoint to check if the model is ready for inference.

**Response (Loading):**
```json
{
  "success": true,
  "status": "loading",
  "message": "Model is being loaded in HuggingFace Space...",
  "progress": 65,
  "modelProvider": "huggingface",
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "initializedAt": "2024-01-20T10:30:00.000Z"
}
```

**Response (Ready):**
```json
{
  "success": true,
  "status": "ready",
  "message": "Model is ready for inference",
  "modelProvider": "huggingface",
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "initializedAt": "2024-01-20T10:30:00.000Z"
}
```

**Response (Not Initialized):**
```json
{
  "success": false,
  "error": "No model configured for this session",
  "status": "not_initialized",
  "message": "Please initialize a model first using POST /api/model/initialize"
}
```

### 3. Clear Model

#### `DELETE /api/model/clear`

Remove model configuration from session.

**Response:**
```json
{
  "success": true,
  "message": "Model configuration cleared from session"
}
```

### Usage with Evaluation Endpoints

Once a model is initialized and ready, `/api/eval/custom` and `/api/eval/benchmark` automatically use the session model if no model is specified in the request.

**Example Flow:**
```javascript
// 1. Initialize model
POST /api/model/initialize
{
  "modelProvider": "huggingface",
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "baseUrl": "https://neollm007-user-model-space.hf.space"
}

// 2. Poll status until ready
GET /api/model/status  // Returns "loading"
// ... wait 10 seconds ...
GET /api/model/status  // Returns "loading"
// ... wait 10 seconds ...
GET /api/model/status  // Returns "ready" ✅

// 3. Run evaluation WITHOUT specifying model
POST /api/eval/custom
{
  "dataset": [
    {"input": "What is 2+2?", "expected": "4"}
  ]
  // No modelName, provider, or apiConfig needed!
}
```

**Important:** 
- Use `credentials: 'include'` in fetch() or `-b/-c cookies.txt` in cURL to persist session
- HuggingFace models take 2-5 minutes for first load (cold start)
- Frontier models (OpenAI, Anthropic) are instantly ready
- See [MODEL_INITIALIZATION_TESTING.md](MODEL_INITIALIZATION_TESTING.md) for detailed testing guide

---

## �🧪 Evaluation Endpoints (`/api/eval`)

### 1. Custom Dataset Evaluation ⭐ RECOMMENDED FOR FRONTEND

#### `POST /api/eval/custom-dataset`

Test any model with your own dataset. Perfect for hackathon demos!

**Request Body:**
```json
{
  "modelName": "Qwen/Qwen2.5-0.5B-Instruct",
  "provider": "hf-user-model",
  "evaluationType": "exact_match",
  "dataset": [
    {
      "input": "What is 2+2?",
      "expected": "4"
    },
    {
      "input": "What is the capital of France?",
      "expected": "Paris"
    }
  ],
  "apiConfig": {
    "apiKey": "sk-...",
    "baseURL": "https://api.openai.com/v1"
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modelName` | string | ✅ Yes | Model identifier (e.g., "gpt-4", "microsoft/phi-2") |
| `dataset` | array | ✅ Yes | Array of test cases (max 50). Each must have `input` and `expected` |
| `provider` | string | No | `"hf-user-model"` (free), `"openai"`, `"anthropic"`, `"together"`. Default: `"hf-user-model"` |
| `evaluationType` | string | No | `"exact_match"`, `"contains"`, `"llm_judge"`. Default: `"exact_match"` |
| `apiConfig` | object | Conditional | Required for frontier models. Contains `apiKey` and optional `baseURL` |

**Evaluation Types:**
- **`exact_match`** - Exact string match (case-insensitive, trimmed). Best for math, factual answers.
- **`contains`** - Check if expected is contained in output. Best for flexible answers.
- **`llm_judge`** - LLM evaluates semantic equivalence. Best for explanations, reasoning.

**Response:**
```json
{
  "success": true,
  "message": "Custom dataset evaluation completed",
  "data": {
    "evaluationId": "507f1f77bcf86cd799439011",
    "modelName": "Qwen/Qwen2.5-0.5B-Instruct",
    "provider": "hf-user-model",
    "evaluationType": "exact_match",
    "summary": {
      "total": 2,
      "passed": 1,
      "failed": 1,
      "accuracy": 50.0,
      "evaluationTimeMs": 1234
    },
    "results": [
      {
        "input": "What is 2+2?",
        "expected": "4",
        "modelOutput": "4",
        "passed": true
      },
      {
        "input": "What is the capital of France?",
        "expected": "Paris",
        "modelOutput": "The capital of France is Paris.",
        "passed": false,
        "reason": "Exact match failed"
      }
    ]
  }
}
```

**Frontend Example:**
```javascript
const response = await fetch('http://localhost:3000/api/eval/custom-dataset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelName: "Qwen/Qwen2.5-0.5B-Instruct",
    provider: "hf-user-model",  // Free, no API key needed!
    evaluationType: "exact_match",
    dataset: [
      { input: "What is 2+2?", expected: "4" },
      { input: "Capital of France?", expected: "Paris" }
    ]
  })
});

const data = await response.json();
console.log(`Accuracy: ${data.data.summary.accuracy}%`);
```

---

### 2. Benchmark Testing

#### `POST /api/eval/test-benchmark`

Test a model against a complete benchmark suite (AIME, MMLU, or MSUR).

**Request Body:**
```json
{
  "modelName": "gpt-4",
  "benchmarkType": "aime",
  "provider": "openai",
  "apiConfig": {
    "apiKey": "sk-..."
  },
  "maxProblems": 10
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modelName` | string | ✅ Yes | Model to test |
| `benchmarkType` | string | ✅ Yes | `"aime"`, `"mmlu"`, or `"msur"` |
| `provider` | string | No | Model provider. Default: `"openai"` |
| `apiConfig` | object | Conditional | API configuration for frontier models |
| `maxProblems` | number | No | Limit number of problems. Default: all |

**Response:**
```json
{
  "success": true,
  "data": {
    "benchmarkType": "aime",
    "modelName": "gpt-4",
    "overall": {
      "total": 10,
      "passed": 7,
      "accuracy": 70.0,
      "averageScore": 7.8
    },
    "byCategory": {
      "algebra": { "total": 3, "passed": 3, "accuracy": 100 },
      "geometry": { "total": 4, "passed": 2, "accuracy": 50 },
      "number_theory": { "total": 3, "passed": 2, "accuracy": 66.7 }
    },
    "results": [
      {
        "problemId": "aime_2023_1",
        "modelAnswer": "42",
        "expectedAnswer": "42",
        "passed": true,
        "score": 10,
        "reasoning": "Correct answer with proper methodology"
      }
    ]
  }
}
```

---

### 3. Comprehensive Model Test

#### `POST /api/eval/comprehensive-test`

Run a complete evaluation: generated test cases + all benchmarks.

**Request Body:**
```json
{
  "modelName": "gpt-4",
  "provider": "openai",
  "apiConfig": {
    "apiKey": "sk-..."
  },
  "includeGenerated": true,
  "includeBenchmarks": ["aime", "mmlu"]
}
```

**Response:** Combined results from generation + benchmarks.

---

### 4. Evaluation Run Management

#### `POST /api/eval/runs`
Create a new evaluation run.

**Request Body:**
```json
{
  "runName": "GPT-4 Baseline Test",
  "description": "Testing GPT-4 on math problems",
  "modelUnderTest": {
    "name": "gpt-4",
    "version": "latest",
    "provider": "openai"
  },
  "testCaseIds": ["tc_1", "tc_2", "tc_3"],
  "configuration": {
    "temperature": 0.7,
    "maxTokens": 1000
  },
  "tags": ["baseline", "math"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "evalRunId": "507f1f77bcf86cd799439011",
    "status": "pending",
    "createdAt": "2026-02-28T12:00:00.000Z"
  }
}
```

#### `POST /api/eval/runs/:evalRunId/start`
Start a pending evaluation run.

#### `GET /api/eval/runs/:evalRunId`
Get status of an evaluation run.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "runName": "GPT-4 Baseline Test",
    "status": "running",
    "progress": {
      "completed": 5,
      "total": 10,
      "percentage": 50
    }
  }
}
```

#### `GET /api/eval/runs/:evalRunId/results`
Get detailed results of a completed run.

#### `GET /api/eval/runs/:evalRunId/benchmark-stats`
Get benchmark-specific statistics.

#### `GET /api/eval/runs`
List all evaluation runs.

**Query Parameters:**
- `status` - Filter by status (`pending`, `running`, `completed`, `failed`)
- `limit` - Max results (default: 50)
- `skip` - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "runs": [
      {
        "_id": "...",
        "runName": "Test 1",
        "status": "completed",
        "createdAt": "..."
      }
    ],
    "total": 25,
    "page": 1
  }
}
```

#### `DELETE /api/eval/runs/:evalRunId`
Delete an evaluation run.

---

## 🔨 Test Case Generator Endpoints (`/api/generator`)

### 1. Generate Test Case Variants ⭐

#### `POST /api/generator/generate`

Generate adversarial test cases from a parent prompt.

**Request Body:**
```json
{
  "parentPromptId": "tc_parent_123",
  "types": ["ambiguity", "contradiction", "negation"],
  "perType": 1,
  "useJudgeSpace": true
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parentPromptId` | string | ✅ Yes | ID of parent test case |
| `types` | array | ✅ Yes | Generation types: `["ambiguity", "contradiction", "negation"]` |
| `perType` | number | No | Variants per type. Default: 1 |
| `useJudgeSpace` | boolean | No | Use Judge Space for efficient batch generation. Default: true |

**Generation Types:**
- **`ambiguity`** - Creates unclear or multi-interpretable version
- **`contradiction`** - Adds contradictory elements
- **`negation`** - Negates key aspects of the prompt

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "tc_ambiguity_1234567890",
      "prompt": "What is the capital?",
      "generatedBy": "judge-space",
      "generationType": "ambiguity",
      "parentPromptId": "tc_parent_123",
      "createdAt": "2026-02-28T12:00:00.000Z"
    },
    {
      "_id": "tc_contradiction_1234567891",
      "prompt": "What is the capital of France, which is not Paris?",
      "generationType": "contradiction",
      "parentPromptId": "tc_parent_123"
    },
    {
      "_id": "tc_negation_1234567892",
      "prompt": "What is NOT the capital of France?",
      "generationType": "negation",
      "parentPromptId": "tc_parent_123"
    }
  ]
}
```

**Note:** If `useJudgeSpace: true` and all 3 types requested, generates all in ONE efficient call (~60s). Otherwise uses traditional method (3 separate calls ~180s).

---

### 2. Test Case CRUD Operations

#### `POST /api/generator/testcases`
Create a single test case manually.

**Request Body:**
```json
{
  "prompt": "Explain quantum computing",
  "expectedOutput": "Quantum computing uses quantum mechanics...",
  "metadata": {
    "difficulty": "medium",
    "category": "science",
    "tags": ["physics", "computing"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "tc_1234567890",
    "prompt": "Explain quantum computing",
    "generatedBy": "user",
    "createdAt": "..."
  }
}
```

#### `POST /api/generator/testcases/bulk`
Create multiple test cases at once.

**Request Body:**
```json
{
  "testcases": [
    {
      "prompt": "What is AI?",
      "expectedOutput": "Artificial Intelligence..."
    },
    {
      "prompt": "What is ML?",
      "expectedOutput": "Machine Learning..."
    }
  ]
}
```

#### `GET /api/generator/testcases`
List all test cases.

**Query Parameters:**
- `generatedBy` - Filter by source (`user`, `llm`, `judge-space`)
- `generationType` - Filter by type (`ambiguity`, `contradiction`, `negation`)
- `parentPromptId` - Get children of specific parent
- `limit` - Max results (default: 50)
- `skip` - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "testcases": [...],
    "total": 42,
    "page": 1
  }
}
```

#### `GET /api/generator/testcases/:testCaseId`
Get a specific test case by ID.

#### `PATCH /api/generator/testcases/:testCaseId`
Update a test case.

**Request Body:**
```json
{
  "prompt": "Updated prompt text",
  "expectedOutput": "Updated expected output",
  "metadata": {
    "difficulty": "hard"
  }
}
```

#### `DELETE /api/generator/testcases/:testCaseId`
Delete a test case and all its children.

---

## ⚖️ Judge Endpoints (`/api/judge`)

### 1. Judge a Model Response

#### `POST /api/judge/judge`

Manually judge a model's response using the LLM judge system.

**Request Body:**
```json
{
  "evalRunId": "507f1f77bcf86cd799439011",
  "modelResponseId": "507f1f77bcf86cd799439012",
  "testCaseId": "tc_123",
  "useAdapter": "math"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `evalRunId` | string | ✅ Yes | Evaluation run ID |
| `modelResponseId` | string | ✅ Yes | Model response to judge |
| `testCaseId` | string | ✅ Yes | Test case ID |
| `useAdapter` | string | No | Judge adapter: `"math"`, `"msur"`, `"base"`. Default: `"base"` |

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "score": 8.5,
    "passed": true,
    "reasoning": "The answer demonstrates correct understanding...",
    "criteria": {
      "accuracy": 9,
      "relevance": 8,
      "coherence": 9,
      "completeness": 8
    },
    "feedback": "Excellent response with minor improvements needed in..."
  }
}
```

---

### 2. Judgement Retrieval

#### `GET /api/judge/judgements/:judgementId`
Get a specific judgement by ID.

#### `GET /api/judge/evalrun/:evalRunId/judgements`
Get all judgements for an evaluation run.

**Response:**
```json
{
  "success": true,
  "data": {
    "judgements": [...],
    "total": 10
  }
}
```

#### `GET /api/judge/evalrun/:evalRunId/stats`
Get judgement statistics for an evaluation run.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalJudgements": 10,
    "passed": 7,
    "failed": 3,
    "passRate": 70.0,
    "averageScore": 7.2,
    "scoreDistribution": {
      "0-2": 0,
      "3-5": 3,
      "6-8": 5,
      "9-10": 2
    },
    "averageCriteria": {
      "accuracy": 7.5,
      "relevance": 7.1,
      "coherence": 7.0,
      "completeness": 7.2
    }
  }
}
```

#### `GET /api/judge/testcase/:testCaseId/judgements`
Get all judgements for a specific test case across different runs.

---

## 🎨 Frontend Integration Guide

### Installation

```bash
# React/Next.js
npm install axios

# Or use fetch (built-in)
```

### Basic Setup

```javascript
// lib/api.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function evaluateCustomDataset(data) {
  const response = await fetch(`${API_BASE_URL}/api/eval/custom-dataset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Evaluation failed');
  }
  
  return await response.json();
}
```

### Example: Custom Dataset Evaluation Form

```jsx
// components/EvaluationForm.jsx
import { useState } from 'react';
import { evaluateCustomDataset } from '../lib/api';

export default function EvaluationForm() {
  const [modelName, setModelName] = useState('Qwen/Qwen2.5-0.5B-Instruct');
  const [provider, setProvider] = useState('hf-user-model');
  const [evaluationType, setEvaluationType] = useState('exact_match');
  const [dataset, setDataset] = useState([
    { input: 'What is 2+2?', expected: '4' }
  ]);
  const [apiKey, setApiKey] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = {
        modelName,
        provider,
        evaluationType,
        dataset
      };
      
      // Add API config for frontier models
      if (provider !== 'hf-user-model') {
        payload.apiConfig = {
          apiKey,
          baseURL: provider === 'openai' 
            ? 'https://api.openai.com/v1'
            : undefined
        };
      }
      
      const response = await evaluateCustomDataset(payload);
      setResults(response.data);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select value={provider} onChange={(e) => setProvider(e.target.value)}>
        <option value="hf-user-model">HuggingFace (Free)</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
      </select>
      
      <input 
        value={modelName} 
        onChange={(e) => setModelName(e.target.value)}
        placeholder="Model name"
      />
      
      {provider !== 'hf-user-model' && (
        <input 
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
        />
      )}
      
      <select value={evaluationType} onChange={(e) => setEvaluationType(e.target.value)}>
        <option value="exact_match">Exact Match</option>
        <option value="contains">Contains</option>
        <option value="llm_judge">LLM Judge</option>
      </select>
      
      <textarea 
        value={JSON.stringify(dataset, null, 2)}
        onChange={(e) => setDataset(JSON.parse(e.target.value))}
        rows={10}
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Evaluating...' : 'Evaluate'}
      </button>
      
      {results && (
        <div>
          <h3>Results</h3>
          <p>Accuracy: {results.summary.accuracy}%</p>
          <p>Passed: {results.summary.passed}/{results.summary.total}</p>
          
          {results.results.map((item, idx) => (
            <div key={idx}>
              <p>{item.input}</p>
              <p>Expected: {item.expected}</p>
              <p>Got: {item.modelOutput}</p>
              <p>{item.passed ? '✅ PASS' : '❌ FAIL'}</p>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
```

### Example: Benchmark Testing

```javascript
// Run AIME benchmark
async function testAIME(modelName, apiKey) {
  const response = await fetch(`${API_BASE_URL}/api/eval/test-benchmark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelName,
      benchmarkType: 'aime',
      provider: 'openai',
      apiConfig: { apiKey },
      maxProblems: 10
    })
  });
  
  return await response.json();
}
```

### Example: Test Case Generation

```javascript
// Generate adversarial test cases
async function generateVariants(parentTestCaseId) {
  const response = await fetch(`${API_BASE_URL}/api/generator/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentPromptId: parentTestCaseId,
      types: ['ambiguity', 'contradiction', 'negation'],
      useJudgeSpace: true
    })
  });
  
  return await response.json();
}
```

### Error Handling

```javascript
async function safeApiCall(apiFunction, ...args) {
  try {
    const result = await apiFunction(...args);
    
    if (!result.success) {
      throw new Error(result.message || 'API call failed');
    }
    
    return result.data;
  } catch (error) {
    console.error('API Error:', error);
    
    // Handle specific error types
    if (error.message.includes('API key')) {
      alert('Invalid API key. Please check your credentials.');
    } else if (error.message.includes('dataset')) {
      alert('Invalid dataset format. Please check your JSON.');
    } else {
      alert('An error occurred. Please try again.');
    }
    
    throw error;
  }
}
```

---

## 🧪 Local Frontend Testing Guide

### Prerequisites

- Backend deployed at: `https://testspark-api.onrender.com` (or your Render URL)
- Frontend project cloned locally
- Node.js 18+ installed

### Step 1: Verify Backend is Live

Before starting frontend testing, confirm backend endpoints are working:

```powershell
# Test health check
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/health"

# Test root endpoint (should show new aliases)
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/"

# Test new frontend-compatible endpoints
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/dashboard"
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/runs"
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/compare"
```

**Expected:** All should return `200 OK` with JSON responses.

### Step 2: Configure Frontend API Base URL

Navigate to your frontend project:

```powershell
cd path\to\testspark-frontend
```

**Verify `src/services/api.js` configuration:**

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: "https://testspark-api.onrender.com",  // ✅ Your deployed backend
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 120000  // 2 minutes for slow model loading
});

export default api;
```

**Important Checklist:**
- ✅ `baseURL` must point to your deployed backend
- ✅ No trailing slash on the URL
- ✅ Include `https://` protocol
- ✅ Timeout should be at least 120 seconds (first model load is slow)

### Step 3: Install Dependencies

```powershell
npm install
```

### Step 4: Start Frontend Development Server

```powershell
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Step 5: Testing Checklist

Open `http://localhost:5173` in your browser and test each feature:

#### ✅ **Test 1: Dashboard Page**

**URL:** `http://localhost:5173/dashboard`

**What to check:**
- Statistics cards display (Total Runs, Completed, Active, Avg Accuracy)
- Recent runs list renders
- No console errors (press F12 → Console tab)

**Backend call:** `GET /api/dashboard`

**Expected response structure:**
```json
{
  "success": true,
  "data": {
    "totalRuns": 0,
    "completedRuns": 0,
    "activeRuns": 0,
    "averageAccuracy": "0.0%",
    "recentActivity": 0,
    "lastRunTime": null
  }
}
```

**Note:** Stats will be `0` until you run at least one evaluation.

---

#### ✅ **Test 2: Runs/Evaluation History**

**URL:** `http://localhost:5173/runs`

**What to check:**
- Page loads without errors
- "Create New Run" button visible
- Table/cards render (may be empty initially)

**Backend call:** `GET /api/runs`

**Expected response:**
```json
{
  "success": true,
  "count": 0,
  "evaluations": []
}
```

---

#### ✅ **Test 3: Custom Evaluation (Most Important)**

**URL:** `http://localhost:5173/evaluation` or `/custom-evaluation`

**Test steps:**

1. **Fill the form:**
   - Model Name: `TinyLlama/TinyLlama-1.1B-Chat-v1.0`
   - Provider: `hf-user-model`
   - Evaluation Type: `contains`
   
2. **Add test case:**
   - Input: `What is 2+2?`
   - Expected: `4`

3. **Submit** and wait (2-5 minutes for first request)

**Backend call:** `POST /api/eval/custom`

**Request body:**
```json
{
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "provider": "hf-user-model",
  "evaluationType": "contains",
  "dataset": [
    {"input": "What is 2+2?", "expected": "4"}
  ]
}
```

**Expected result:**
```json
{
  "success": true,
  "evaluationId": "...",
  "summary": {
    "total": 1,
    "passed": 1,
    "failed": 0,
    "accuracy": "100.0%",
    "totalTime": "45.2s"
  },
  "results": [...]
}
```

**⏱️ Performance note:** 
- First request: 2-5 minutes (model download + loading)
- Subsequent requests: 10-30 seconds (model cached)

---

#### ✅ **Test 4: Benchmark Evaluation**

**URL:** `http://localhost:5173/benchmark`

**Test steps:**

1. Select benchmark: `AIME` (math problems)
2. Choose model: `TinyLlama/TinyLlama-1.1B-Chat-v1.0`
3. Set limit: `3` (start small)
4. Click "Run Benchmark"

**Backend call:** `POST /api/eval/benchmark`

**Request body:**
```json
{
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "provider": "hf-user-model",
  "benchmarkName": "AIME",
  "limit": 3
}
```

**Note:** This will take 3-5 minutes for 3 problems.

---

#### ✅ **Test 5: Model Comparison**

**URL:** `http://localhost:5173/compare`

**What to check:**
- Page loads without errors
- Comparison table/chart renders
- Shows models you've tested (empty until evaluations run)

**Backend call:** `GET /api/compare`

**Expected response:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        "provider": "hf-user-model",
        "totalRuns": 2,
        "totalTests": 5,
        "totalPassed": 3,
        "averageAccuracy": "60.0%",
        "lastRun": "2026-03-02T10:30:45.210Z"
      }
    ]
  }
}
```

---

#### ✅ **Test 6: Test Case Generator**

**URL:** `http://localhost:5173/generator`

**Test steps:**

1. Enter parent prompt ID (create one first if needed)
2. Select pattern types:
   - ☑️ Ambiguity
   - ☑️ Contradiction
   - ☑️ Negation
3. Click "Generate"

**Backend call:** `POST /api/generate`

**Request body:**
```json
{
  "parentPromptId": "tc_001",
  "types": ["ambiguity", "contradiction", "negation"],
  "perType": 1,
  "useJudgeSpace": true
}
```

**Note:** Requires parent test case to exist in database first.

---

#### ✅ **Test 7: Judge Evaluation**

**URL:** `http://localhost:5173/judge`

**Test steps:**

1. Enter prompt: `What is 2+2?`
2. Enter response: `The answer is 4`
3. Select adapter: `base`
4. Click "Evaluate"

**Backend call:** `POST /api/judge`

**Request body:**
```json
{
  "prompt": "What is 2+2?",
  "response": "The answer is 4",
  "adapter": "base"
}
```

**Expected result:**
```json
{
  "success": true,
  "evaluation": {
    "score": 9.5,
    "criteria": {
      "accuracy": 10,
      "relevance": 10,
      "coherence": 9,
      "completeness": 9
    },
    "reasoning": "Correct and concise...",
    "passed": true,
    "feedback": "Excellent response"
  }
}
```

---

### Common Issues & Solutions

#### 🔴 **Issue 1: CORS Error**

```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
- Backend has CORS enabled, but may need 1-2 minutes to deploy
- Clear browser cache (Ctrl+Shift+Delete)
- Restart frontend dev server
- Wait for backend deployment to complete

---

#### 🔴 **Issue 2: Request Timeout**

```
AxiosError: timeout of 120000ms exceeded
```

**Cause:** First HuggingFace model request takes 2-5 minutes (downloading ~4GB model)

**Solutions:**

1. **Increase timeout** in `src/services/api.js`:
   ```javascript
   timeout: 300000  // 5 minutes
   ```

2. **Use faster model:**
   - Model: `Qwen/Qwen2.5-0.5B-Instruct` (smaller, faster)
   - Only ~2GB download

3. **Test with OpenAI instead** (instant, requires API key):
   ```json
   {
     "modelName": "gpt-3.5-turbo",
     "provider": "openai",
     "apiConfig": {"apiKey": "sk-..."}
   }
   ```

---

#### 🔴 **Issue 3: 404 Not Found**

```
POST /api/eval/custom → 404
```

**Solutions:**
- Wait 2 minutes after git push for backend deployment
- Test backend directly: `curl https://testspark-api.onrender.com/api/health`
- Check Render dashboard for deployment status
- Verify `baseURL` in `src/services/api.js` is correct

---

#### 🔴 **Issue 4: Empty Dashboard / No Data**

**This is normal!** 

Dashboard will show zeros until you:
1. Run at least one custom evaluation (Test 3)
2. Wait for it to complete
3. Refresh dashboard page

**To populate data:**
- Run 2-3 custom evaluations with different models
- Try one benchmark test
- Data will then appear in Dashboard and Compare pages

---

### Browser DevTools Monitoring

**Open DevTools (F12) → Network tab** to monitor API calls:

**On Dashboard page load:**
```
✅ GET /api/dashboard → 200 OK (0.5s)
✅ GET /api/runs → 200 OK (0.3s)
```

**During evaluation submission:**
```
⏳ POST /api/eval/custom → (pending... 2-5 min)
✅ POST /api/eval/custom → 200 OK
```

**What to look for:**
- ✅ All requests show `200 OK` status
- ✅ Response tab shows JSON data
- ❌ Red requests = errors (check response for details)
- ❌ CORS errors = backend not deployed or wrong URL

---

### Quick Backend Verification Script

Run this in PowerShell before testing frontend:

```powershell
Write-Host "Testing Backend Endpoints..." -ForegroundColor Cyan

Write-Host "`n1. Health Check" -ForegroundColor Yellow
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/health"

Write-Host "`n2. Dashboard Endpoint" -ForegroundColor Yellow
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/dashboard"

Write-Host "`n3. Runs History" -ForegroundColor Yellow
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/runs"

Write-Host "`n4. Model Comparison" -ForegroundColor Yellow
Invoke-RestMethod -Uri "https://testspark-api.onrender.com/api/compare"

Write-Host "`n✅ All endpoints responding!" -ForegroundColor Green
```

---

### Success Criteria

✅ **Frontend is working correctly when:**

1. ✅ Dashboard page loads and shows statistics
2. ✅ Runs page displays without errors
3. ✅ Custom evaluation form submits successfully
4. ✅ At least one evaluation completes and shows results
5. ✅ Browser console shows no CORS errors
6. ✅ Network tab shows `200 OK` responses
7. ✅ Results are saved and appear in history

---

### Testing Priorities

**Must test (critical path):**
1. ✅ Custom Evaluation (Test 3) - Core feature
2. ✅ Dashboard (Test 1) - User landing page
3. ✅ Runs History (Test 2) - Results tracking

**Should test:**
4. ✅ Benchmark (Test 4) - Standard testing
5. ✅ Compare (Test 5) - Analytics

**Nice to test:**
6. ✅ Generator (Test 6) - Advanced feature
7. ✅ Judge (Test 7) - Evaluation system

---

### Performance Expectations

| Operation | First Time | Subsequent |
|-----------|------------|------------|
| Dashboard load | 1-2s | <1s |
| Runs list | 1-2s | <1s |
| Custom eval (HF) | 2-5 min | 10-30s |
| Custom eval (OpenAI) | 3-10s | 3-10s |
| Benchmark (3 tests) | 3-8 min | 30-90s |
| Judge evaluation | 5-15s | 5-15s |

**Note:** First HuggingFace model request is slow due to:
1. Model download (~4GB)
2. Model loading into memory
3. First inference compilation

---

## 🚀 Deployment

### 1. MongoDB Atlas Setup

1. Create free M0 cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create database named `eval`
3. Get connection string
4. **Network Access:** Add IP `0.0.0.0/0` (allow from anywhere)

### 2. HuggingFace Spaces

**Deploy Judge Space:**
- See [SPACE_2_JUDGE_MODEL_INSTRUCTIONS.md](SPACE_2_JUDGE_MODEL_INSTRUCTIONS.md)
- Hardware: T4 GPU recommended ($0.60/hr)
- Copy Space URL for env vars

**Deploy User Model Space:**
- See [SPACE_1_USER_MODEL_INSTRUCTIONS.md](SPACE_1_USER_MODEL_INSTRUCTIONS.md)
- Hardware: CPU Free tier works
- Copy Space URL for env vars

### 3. Backend on Render

1. **Create Web Service:**
   - Connect GitHub repository
   - Select Node.js environment
   
2. **Build Settings:**
   ```
   Build Command: npm install
   Start Command: npm start
   ```

3. **Environment Variables:**
   ```
   MONGODB_URI=<your-mongodb-connection-string>
   HF_USER_MODEL_SPACE_ENDPOINT=<user-space-url>
   HF_JUDGE_SPACE_ENDPOINT=<judge-space-url>
   PORT=3000
   JUDGE_MODEL=gpt-4
   DEFAULT_TEMPERATURE=0.7
   DEFAULT_MAX_TOKENS=1000
   NODE_ENV=production
   ```

4. **Deploy** - Render auto-deploys from Git pushes

### 4. Frontend on Vercel

1. **Connect Repository** to Vercel
2. **Environment Variable:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   ```
3. **Deploy** - Auto-deploys from Git

---

## 📊 Example Datasets

### Math Problems (exact_match)
```json
{
  "modelName": "Qwen/Qwen2.5-0.5B-Instruct",
  "provider": "hf-user-model",
  "evaluationType": "exact_match",
  "dataset": [
    { "input": "What is 15 + 27?", "expected": "42" },
    { "input": "What is 8 * 7?", "expected": "56" },
    { "input": "What is 100 - 45?", "expected": "55" }
  ]
}
```

### General Knowledge (contains)
```json
{
  "modelName": "gpt-4",
  "provider": "openai",
  "evaluationType": "contains",
  "apiConfig": { "apiKey": "sk-..." },
  "dataset": [
    { "input": "Who painted the Mona Lisa?", "expected": "Leonardo da Vinci" },
    { "input": "What is the largest ocean?", "expected": "Pacific" },
    { "input": "What year did World War II end?", "expected": "1945" }
  ]
}
```

### Reasoning (llm_judge)
```json
{
  "modelName": "gpt-4",
  "provider": "openai",
  "evaluationType": "llm_judge",
  "apiConfig": { "apiKey": "sk-..." },
  "dataset": [
    {
      "input": "Explain the concept of machine learning",
      "expected": "Machine learning is a subset of AI where computers learn from data without explicit programming"
    }
  ]
}
```

---

## 🐛 Troubleshooting

### Common Issues

**"Database connection error"**
- Check MongoDB URI in environment variables
- Verify Network Access allows 0.0.0.0/0
- Ensure database name is `eval`

**"Space endpoint unavailable"**
- Verify HuggingFace Space is deployed and running
- Check Space URLs in environment variables
- Test Space directly: `https://your-space.hf.space`

**"API key invalid"** (for frontier models)
- Ensure user provided valid API key in request
- Check format: OpenAI starts with `sk-`
- Verify key has required permissions

**"Model too large"** (for HF models)
- User Model Space only supports <3B parameter models
- Recommend: Phi-2 (2.7B), Qwen-0.5B, TinyLlama-1.1B
- For larger models, use frontier APIs with user's key

**"Evaluation timeout"**
- Free tier Spaces may be slow (~60s per request)
- Consider upgrading Space to GPU
- Reduce dataset size for testing

---

## 📚 Additional Documentation

- **[Design.md](Design.md)** - System architecture and technical decisions
- **[CUSTOM_EVAL_USAGE.md](CUSTOM_EVAL_USAGE.md)** - Detailed custom eval API guide
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete deployment walkthrough
- **[HF_SPACE_SETUP.md](HF_SPACE_SETUP.md)** - HuggingFace Space configuration

---

## 🤝 Contributing

This is a hackathon/prototype project. Contributions welcome!

### Future Enhancements
- [ ] User authentication & API keys
- [ ] WebSocket for real-time progress
- [ ] Result export (CSV, JSON, PDF)
- [ ] Evaluation comparison (model A vs B)
- [ ] Custom benchmark upload
- [ ] Rate limiting & usage quotas
- [ ] Caching for repeated evaluations

---

## 📝 License

MIT License - See LICENSE file for details

---

## 💬 Support

- **Issues:** Open a GitHub issue
- **Questions:** Check existing documentation first
- **Demos:** See example frontend implementations

---

<p align="center">
  Made for hackathons 🚀
  <br>
  Built with Node.js • Express • MongoDB • HuggingFace Spaces
</p>
