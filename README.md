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

**Base URL:** `http://localhost:3000` (development) or `https://your-app.onrender.com` (production)

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
    "judge": "/api/judge"
  }
}
```

#### `GET /api/health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-02-28T12:00:00.000Z",
  "database": "connected"
}
```

---

## 🧪 Evaluation Endpoints (`/api/eval`)

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
