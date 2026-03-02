# TESTSPARK Backend API Documentation

**Version:** 2.0  
**Base URL (Production):** `https://testspark-api.onrender.com`  
**Base URL (Development):** `http://localhost:3000`

---

## Table of Contents

- [Overview](#overview)
- [Authentication & Sessions](#authentication--sessions)
- [Model Initialization Workflow](#model-initialization-workflow)
- [API Endpoints](#api-endpoints)
  - [Model Management](#model-management)
  - [Evaluation Endpoints](#evaluation-endpoints)
  - [Dashboard & Analytics](#dashboard--analytics)
  - [Test Case Generation](#test-case-generation)
  - [Judge System](#judge-system)
- [Frontend Integration Guide](#frontend-integration-guide)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

TESTSPARK is a session-based LLM evaluation platform that allows you to:

1. **Initialize a model once** - Specify only the model name, backend handles HuggingFace Space loading
2. **Track loading progress** - Poll status endpoint to show loading indicators
3. **Run multiple evaluations** - Use the session model for unlimited evaluations without re-configuration
4. **Benchmark testing** - Test against standard benchmarks (AIME, MMLU, MSUR)
5. **Generate adversarial test cases** - Create test variants automatically

### Key Features

- ✅ **Simplified API** - Only model name required, server manages HF Space URLs
- ✅ **Session Management** - No cookies, frontend stores and sends sessionId
- ✅ **Progress Tracking** - Real-time model loading status with progress indicators
- ✅ **Multiple Providers** - HuggingFace (free), OpenAI, Anthropic, etc.
- ✅ **Automatic Fallback** - Eval endpoints use session model if not specified

---

## Authentication & Sessions

### Session Flow

TESTSPARK uses **stateless sessions** - no cookies required!

1. **Frontend** calls `POST /api/model/initialize` with `{ modelName }`
2. **Backend** returns `{ sessionId: "sess_xxx..." }`
3. **Frontend** stores sessionId (localStorage/state)
4. **Frontend** passes sessionId in subsequent requests via:
   - Query parameter: `?sessionId=sess_xxx`
   - Header: `X-Session-Id: sess_xxx`
   - Request body: `{ sessionId: "sess_xxx", ... }`

### CORS Configuration

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization, X-Session-Id
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
```

No `withCredentials` needed - simple fetch/axios calls work!

---

## Model Initialization Workflow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  1. Frontend: User enters model name                   │
│     e.g., "TinyLlama/TinyLlama-1.1B-Chat-v1.0"        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  2. POST /api/model/initialize                          │
│     Request: { "modelName": "TinyLlama/..." }          │
│     Response: {                                         │
│       "success": true,                                  │
│       "status": "loading",                              │
│       "sessionId": "sess_1234567890_abc123"            │
│     }                                                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  3. Frontend: Store sessionId                           │
│     localStorage.setItem('sessionId', sessionId)        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  4. Frontend: Poll status every 10 seconds              │
│     GET /api/model/status?sessionId=sess_xxx            │
│                                                          │
│     While status === "loading":                         │
│       Show progress indicator (2-5 min estimated)       │
│                                                          │
│     When status === "ready":                            │
│       Enable evaluation features                        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  5. Frontend: Run evaluations                           │
│     POST /api/eval/custom-dataset?sessionId=sess_xxx    │
│     (No modelName needed - uses session model!)         │
└─────────────────────────────────────────────────────────┘
```

### Timeline Expectations

| Action | Time | Notes |
|--------|------|-------|
| Initialize request | <1s | Returns immediately |
| Model download (first time) | 2-5 min | HuggingFace cold start |
| Status check | <3s | Quick inference test |
| Evaluation (model ready) | 10-30s | Per test case |

---

## API Endpoints

### Model Management

#### 1. Initialize Model

**Endpoint:** `POST /api/model/initialize`

**Purpose:** Start loading a HuggingFace model in the backend User Model Space.

**Request Body:**
```json
{
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| modelName | string | ✅ Yes | HuggingFace model identifier |

**Response (Success - Loading):**
```json
{
  "success": true,
  "message": "Model initialization started",
  "status": "loading",
  "sessionId": "sess_1709388123456_abc123",
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "estimatedTime": "2-5 minutes for first load",
  "note": "Poll GET /api/model/status?sessionId=sess_1709388123456_abc123"
}
```

**Response (Error - Missing modelName):**
```json
{
  "success": false,
  "error": "modelName is required",
  "example": {
    "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
  }
}
```

**Frontend Example:**
```javascript
const response = await fetch('https://testspark-api.onrender.com/api/model/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelName: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0'
  })
});

const data = await response.json();
if (data.success) {
  // Store sessionId for later use
  localStorage.setItem('sessionId', data.sessionId);
  console.log('Model loading started, sessionId:', data.sessionId);
  
  // Start polling status
  pollModelStatus(data.sessionId);
}
```

---

#### 2. Check Model Status

**Endpoint:** `GET /api/model/status`

**Purpose:** Check if the initialized model is ready for inference.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | ✅ Yes | Session ID from initialize response |

**Alternative:** Send as header `X-Session-Id: sess_xxx`

**Response (Loading):**
```json
{
  "success": true,
  "status": "loading",
  "message": "Model is being loaded in HuggingFace Space...",
  "progress": 65,
  "modelProvider": "huggingface",
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "sessionId": "sess_1709388123456_abc123",
  "initializedAt": "2026-03-02T14:30:00.000Z"
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
  "sessionId": "sess_1709388123456_abc123",
  "initializedAt": "2026-03-02T14:30:00.000Z"
}
```

**Response (Error - No Session):**
```json
{
  "success": false,
  "error": "sessionId is required",
  "status": "not_initialized",
  "hint": "Pass sessionId as query param: /api/model/status?sessionId=xxx"
}
```

**Response (Error - Session Not Found):**
```json
{
  "success": false,
  "error": "No model configured for this session",
  "status": "not_initialized",
  "message": "Please initialize a model first using POST /api/model/initialize"
}
```

**Frontend Example (Polling):**
```javascript
async function pollModelStatus(sessionId) {
  const checkStatus = async () => {
    const response = await fetch(
      `https://testspark-api.onrender.com/api/model/status?sessionId=${sessionId}`
    );
    const data = await response.json();
    
    if (data.success && data.status === 'ready') {
      console.log('✅ Model ready!');
      // Enable evaluation features
      enableEvaluationUI();
      return true;
    } else if (data.success && data.status === 'loading') {
      console.log(`⏳ Loading... Progress: ${data.progress || 'unknown'}%`);
      // Continue polling
      setTimeout(checkStatus, 10000); // Check again in 10s
    } else {
      console.error('❌ Error:', data.error);
    }
  };
  
  checkStatus();
}
```

---

#### 3. Clear Model Session

**Endpoint:** `DELETE /api/model/clear`

**Purpose:** Remove model configuration from session (cleanup).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | ✅ Yes | Session ID to clear |

**Response:**
```json
{
  "success": true,
  "message": "Model configuration cleared from session"
}
```

**Frontend Example:**
```javascript
async function clearSession(sessionId) {
  await fetch(
    `https://testspark-api.onrender.com/api/model/clear?sessionId=${sessionId}`,
    { method: 'DELETE' }
  );
  localStorage.removeItem('sessionId');
}
```

---

### Evaluation Endpoints

#### 1. Custom Dataset Evaluation

**Endpoint:** `POST /api/eval/custom-dataset`

**Purpose:** Evaluate a model with your own test cases.

**Query Parameters (Optional):**
| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | string | Use session model (no modelName needed) |

**Request Body (With modelName):**
```json
{
  "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
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
  "temperature": 0.7,
  "max_tokens": 512
}
```

**Request Body (With sessionId - No modelName):**
```json
{
  "sessionId": "sess_1709388123456_abc123",
  "evaluationType": "contains",
  "dataset": [
    {
      "input": "What is 2+2?",
      "expected": "4"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| modelName | string | ⚠️ If no session | Model identifier |
| provider | string | No | Default: `hf-user-model` |
| evaluationType | string | No | `exact_match`, `contains`, `llm_judge` (default: `exact_match`) |
| dataset | array | ✅ Yes | Test cases (max 50) |
| sessionId | string | ⚠️ If no modelName | Use session model |
| temperature | number | No | Generation temperature (default: 0.7) |
| max_tokens | number | No | Max tokens (default: 512) |

**Response:**
```json
{
  "success": true,
  "message": "Custom dataset evaluation completed",
  "data": {
    "evaluationId": "65f3a1b2c3d4e5f6a7b8c9d0",
    "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    "provider": "hf-user-model",
    "evaluationType": "exact_match",
    "summary": {
      "total": 2,
      "passed": 1,
      "failed": 1,
      "accuracy": "50.0%",
      "totalTime": "45.2s"
    },
    "results": [
      {
        "index": 1,
        "input": "What is 2+2?",
        "expected": "4",
        "actual": "4",
        "passed": true,
        "score": 1.0,
        "evaluationMethod": "exact_match"
      },
      {
        "index": 2,
        "input": "What is the capital of France?",
        "expected": "Paris",
        "actual": "The capital of France is Paris.",
        "passed": false,
        "score": 0.0,
        "evaluationMethod": "exact_match"
      }
    ]
  }
}
```

**Evaluation Types:**

| Type | Description | Best For |
|------|-------------|----------|
| `exact_match` | Case-insensitive exact string match | Math, short factual answers |
| `contains` | Check if expected is in output | Flexible answers, explanations |
| `llm_judge` | LLM evaluates semantic correctness | Open-ended, reasoning tasks |

**Frontend Example (Using Session Model):**
```javascript
async function runEvaluation(sessionId, dataset) {
  const response = await fetch(
    `https://testspark-api.onrender.com/api/eval/custom-dataset?sessionId=${sessionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evaluationType: 'contains',
        dataset: dataset
      })
    }
  );
  
  const data = await response.json();
  console.log(`Accuracy: ${data.data.summary.accuracy}`);
  return data;
}
```

---

#### 2. Benchmark Testing

**Endpoint:** `POST /api/eval/test-benchmark`

**Purpose:** Test model against standard benchmarks (AIME, MMLU, MSUR).

**Request Body (With Session):**
```json
{
  "sessionId": "sess_1709388123456_abc123",
  "testCaseId": "tc_aime_problem_123",
  "temperature": 0.1
}
```

**Request Body (With Model):**
```json
{
  "modelName": "gpt-4",
  "provider": "openai",
  "apiConfig": {
    "apiKey": "sk-...",
    "baseURL": "https://api.openai.com/v1"
  },
  "testCaseId": "tc_aime_problem_123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| testCaseId | string | ✅ Yes | Test case ID from database |
| sessionId | string | ⚠️ Or modelName | Use session model |
| modelName | string | ⚠️ Or sessionId | Model identifier |
| provider | string | No | Model provider |
| apiConfig | object | No | API configuration |
| temperature | number | No | Default: 0.1 |

**Response:**
```json
{
  "success": true,
  "data": {
    "testInfo": {
      "testCaseId": "tc_aime_problem_123",
      "prompt": "Solve: Find the value of x...",
      "expectedOutput": "42",
      "benchmarkType": "AIME",
      "difficulty": "hard",
      "category": "algebra"
    },
    "modelInfo": {
      "name": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
      "temperature": 0.1,
      "responseTime": 2345,
      "tokensUsed": 156
    },
    "modelResponse": {
      "id": "65f3a1b2c3d4e5f6a7b8c9d1",
      "text": "The value of x is 42",
      "status": "completed"
    },
    "generalJudgement": {
      "score": 9.5,
      "maxScore": 10,
      "passed": true,
      "reasoning": "Correct answer with proper methodology",
      "criteria": {
        "accuracy": 10,
        "relevance": 9,
        "coherence": 9,
        "completeness": 10
      }
    }
  }
}
```

---

### Dashboard & Analytics

#### 1. Dashboard Statistics

**Endpoint:** `GET /api/dashboard`

**Purpose:** Get overview statistics for dashboard display.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRuns": 45,
    "completedRuns": 42,
    "activeRuns": 3,
    "averageAccuracy": "73.5%",
    "recentActivity": 15,
    "lastRunTime": "2026-03-02T14:25:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function loadDashboard() {
  const response = await fetch('https://testspark-api.onrender.com/api/dashboard');
  const data = await response.json();
  
  // Update UI
  document.getElementById('total-runs').textContent = data.data.totalRuns;
  document.getElementById('accuracy').textContent = data.data.averageAccuracy;
}
```

---

#### 2. Evaluation History

**Endpoint:** `GET /api/runs`

**Purpose:** Get list of all evaluation runs.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: `pending`, `running`, `completed`, `failed` |
| limit | number | Max results (default: 50) |
| skip | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "count": 42,
  "evaluations": [
    {
      "_id": "65f3a1b2c3d4e5f6a7b8c9d0",
      "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
      "provider": "hf-user-model",
      "evaluationType": "exact_match",
      "datasetSize": 10,
      "results": {
        "accuracy": 80.0,
        "passed": 8,
        "failed": 2
      },
      "completedAt": "2026-03-02T14:20:00.000Z"
    }
  ]
}
```

---

#### 3. Model Comparison

**Endpoint:** `GET /api/compare`

**Purpose:** Compare performance across different models.

**Response:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        "provider": "hf-user-model",
        "totalRuns": 15,
        "totalTests": 150,
        "totalPassed": 105,
        "averageAccuracy": "70.0%",
        "lastRun": "2026-03-02T14:20:00.000Z"
      },
      {
        "modelName": "gpt-4",
        "provider": "openai",
        "totalRuns": 8,
        "totalTests": 80,
        "totalPassed": 75,
        "averageAccuracy": "93.8%",
        "lastRun": "2026-03-02T13:15:00.000Z"
      }
    ]
  }
}
```

---

### Test Case Generation

#### Generate Test Case Variants

**Endpoint:** `POST /api/generate`

**Purpose:** Generate adversarial test case variants (ambiguity, contradiction, negation).

**Request Body:**
```json
{
  "parentPromptId": "tc_parent_123",
  "types": ["ambiguity", "contradiction", "negation"],
  "perType": 1,
  "useJudgeSpace": true
}
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "generatedCases": [
    {
      "_id": "tc_ambiguity_456",
      "prompt": "What is the capital?",
      "generationType": "ambiguity",
      "parentPromptId": "tc_parent_123"
    },
    {
      "_id": "tc_contradiction_457",
      "prompt": "What is the capital of France, which is not Paris?",
      "generationType": "contradiction"
    },
    {
      "_id": "tc_negation_458",
      "prompt": "What is NOT the capital of France?",
      "generationType": "negation"
    }
  ]
}
```

---

### Judge System

#### Judge Model Response

**Endpoint:** `POST /api/judge`

**Purpose:** Use LLM judge to evaluate a response.

**Request Body:**
```json
{
  "prompt": "What is 2+2?",
  "response": "The answer is 4",
  "adapter": "base"
}
```

**Response:**
```json
{
  "success": true,
  "evaluation": {
    "score": 9.5,
    "passed": true,
    "reasoning": "Correct and concise answer",
    "criteria": {
      "accuracy": 10,
      "relevance": 10,
      "coherence": 9,
      "completeness": 9
    },
    "feedback": "Excellent response with proper clarity"
  }
}
```

---

## Frontend Integration Guide

### Complete React/Next.js Example

```javascript
// lib/api.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://testspark-api.onrender.com';

class TestSparkAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.sessionId = null;
  }

  // Load sessionId from storage
  loadSession() {
    this.sessionId = localStorage.getItem('sessionId');
    return this.sessionId;
  }

  // Save sessionId to storage
  saveSession(sessionId) {
    this.sessionId = sessionId;
    localStorage.setItem('sessionId', sessionId);
  }

  // Initialize model
  async initializeModel(modelName) {
    const response = await fetch(`${this.baseURL}/api/model/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelName })
    });

    const data = await response.json();
    if (data.success && data.sessionId) {
      this.saveSession(data.sessionId);
    }
    return data;
  }

  // Check model status
  async checkModelStatus() {
    if (!this.sessionId) throw new Error('No session ID');

    const response = await fetch(
      `${this.baseURL}/api/model/status?sessionId=${this.sessionId}`
    );
    return await response.json();
  }

  // Poll until model is ready
  async waitForModelReady(onProgress) {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.checkModelStatus();
          
          if (status.success && status.status === 'ready') {
            resolve(status);
          } else if (status.success && status.status === 'loading') {
            if (onProgress) onProgress(status);
            setTimeout(poll, 10000); // Poll every 10 seconds
          } else {
            reject(new Error(status.error || 'Failed to load model'));
          }
        } catch (error) {
          reject(error);
        }
      };
      poll();
    });
  }

  // Run custom evaluation
  async runEvaluation(dataset, evaluationType = 'contains') {
    if (!this.sessionId) throw new Error('No session ID - initialize model first');

    const response = await fetch(
      `${this.baseURL}/api/eval/custom-dataset?sessionId=${this.sessionId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationType,
          dataset
        })
      }
    );

    return await response.json();
  }

  // Get dashboard stats
  async getDashboard() {
    const response = await fetch(`${this.baseURL}/api/dashboard`);
    return await response.json();
  }

  // Get evaluation history
  async getHistory() {
    const response = await fetch(`${this.baseURL}/api/runs`);
    return await response.json();
  }

  // Clear session
  async clearSession() {
    if (!this.sessionId) return;

    await fetch(
      `${this.baseURL}/api/model/clear?sessionId=${this.sessionId}`,
      { method: 'DELETE' }
    );
    
    localStorage.removeItem('sessionId');
    this.sessionId = null;
  }
}

export default new TestSparkAPI();
```

### React Component Example

```jsx
// components/ModelInitializer.jsx
import { useState } from 'react';
import api from '../lib/api';

export default function ModelInitializer({ onReady }) {
  const [modelName, setModelName] = useState('TinyLlama/TinyLlama-1.1B-Chat-v1.0');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);

    try {
      // Initialize model
      const initResult = await api.initializeModel(modelName);
      
      if (!initResult.success) {
        throw new Error(initResult.error);
      }

      console.log('Model initialization started:', initResult.sessionId);

      // Wait for model to be ready
      await api.waitForModelReady((status) => {
        setProgress(status);
        console.log(`Loading: ${status.progress || 'unknown'}%`);
      });

      console.log('✅ Model ready!');
      setLoading(false);
      
      if (onReady) onReady();

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="model-initializer">
      <h2>Initialize Model</h2>
      
      <input
        type="text"
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
        placeholder="Model name (e.g., TinyLlama/TinyLlama-1.1B-Chat-v1.0)"
        disabled={loading}
      />

      <button onClick={handleInitialize} disabled={loading}>
        {loading ? 'Loading...' : 'Initialize Model'}
      </button>

      {loading && progress && (
        <div className="progress">
          <p>{progress.message}</p>
          {progress.progress && <p>Progress: {progress.progress}%</p>}
          <p>This may take 2-5 minutes for first load...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
```

### Evaluation Component Example

```jsx
// components/Evaluator.jsx
import { useState } from 'react';
import api from '../lib/api';

export default function Evaluator() {
  const [dataset, setDataset] = useState([
    { input: 'What is 2+2?', expected: '4' }
  ]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEvaluate = async () => {
    setLoading(true);

    try {
      const response = await api.runEvaluation(dataset, 'contains');
      
      if (response.success) {
        setResults(response.data);
      } else {
        alert(`Error: ${response.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="evaluator">
      <h2>Run Evaluation</h2>
      
      <textarea
        value={JSON.stringify(dataset, null, 2)}
        onChange={(e) => setDataset(JSON.parse(e.target.value))}
        rows={10}
      />

      <button onClick={handleEvaluate} disabled={loading}>
        {loading ? 'Evaluating...' : 'Run Evaluation'}
      </button>

      {results && (
        <div className="results">
          <h3>Results</h3>
          <p>Accuracy: {results.summary.accuracy}</p>
          <p>Passed: {results.summary.passed}/{results.summary.total}</p>
          
          {results.results.map((result, idx) => (
            <div key={idx} className={result.passed ? 'pass' : 'fail'}>
              <p><strong>Input:</strong> {result.input}</p>
              <p><strong>Expected:</strong> {result.expected}</p>
              <p><strong>Got:</strong> {result.actual}</p>
              <p>{result.passed ? '✅ PASS' : '❌ FAIL'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling

### Common Error Responses

#### 1. Missing SessionId
```json
{
  "success": false,
  "error": "sessionId is required",
  "status": "not_initialized",
  "hint": "Pass sessionId as query param: /api/model/status?sessionId=xxx"
}
```

**Solution:** Include sessionId in request

#### 2. Session Not Found
```json
{
  "success": false,
  "error": "No model configured for this session",
  "status": "not_initialized",
  "message": "Please initialize a model first using POST /api/model/initialize"
}
```

**Solution:** Call `/api/model/initialize` first

#### 3. Model Not Ready
```json
{
  "success": false,
  "error": "Session model is not ready yet. Please wait for initialization to complete.",
  "tip": "Poll GET /api/model/status?sessionId=sess_xxx"
}
```

**Solution:** Continue polling status endpoint

#### 4. Invalid Dataset
```json
{
  "success": false,
  "error": "dataset must be an array",
  "received": "string"
}
```

**Solution:** Ensure dataset is valid array format

---

## Examples

### Complete Workflow Example (cURL)

```bash
# 1. Initialize model
curl -X POST https://testspark-api.onrender.com/api/model/initialize \
  -H "Content-Type: application/json" \
  -d '{"modelName":"TinyLlama/TinyLlama-1.1B-Chat-v1.0"}'

# Response: {"success":true,"sessionId":"sess_1709388123456_abc123",...}
# Copy the sessionId

# 2. Check status (repeat until ready)
curl "https://testspark-api.onrender.com/api/model/status?sessionId=sess_1709388123456_abc123"

# Response (loading): {"success":true,"status":"loading","progress":50,...}
# Response (ready): {"success":true,"status":"ready",...}

# 3. Run evaluation
curl -X POST "https://testspark-api.onrender.com/api/eval/custom-dataset?sessionId=sess_1709388123456_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluationType": "contains",
    "dataset": [
      {"input":"What is 2+2?","expected":"4"},
      {"input":"What is the capital of France?","expected":"Paris"}
    ]
  }'

# 4. Get dashboard
curl "https://testspark-api.onrender.com/api/dashboard"

# 5. Get history
curl "https://testspark-api.onrender.com/api/runs"

# 6. Clear session (optional)
curl -X DELETE "https://testspark-api.onrender.com/api/model/clear?sessionId=sess_1709388123456_abc123"
```

### JavaScript/Fetch Example

```javascript
// Complete flow
async function completeWorkflow() {
  // 1. Initialize
  const initRes = await fetch('https://testspark-api.onrender.com/api/model/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelName: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0'
    })
  });
  const { sessionId } = await initRes.json();
  console.log('SessionId:', sessionId);

  // 2. Poll status
  const waitForReady = async () => {
    const statusRes = await fetch(
      `https://testspark-api.onrender.com/api/model/status?sessionId=${sessionId}`
    );
    const status = await statusRes.json();
    
    if (status.status === 'ready') {
      return true;
    } else if (status.status === 'loading') {
      console.log('Loading...', status.progress);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return waitForReady();
    }
  };
  await waitForReady();

  // 3. Run evaluation
  const evalRes = await fetch(
    `https://testspark-api.onrender.com/api/eval/custom-dataset?sessionId=${sessionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evaluationType: 'contains',
        dataset: [
          { input: 'What is 2+2?', expected: '4' }
        ]
      })
    }
  );
  const results = await evalRes.json();
  console.log('Accuracy:', results.data.summary.accuracy);
}

completeWorkflow();
```

---

## Environment Variables

Backend requires these environment variables:

```bash
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/eval

# HuggingFace Spaces (server-side URLs)
HF_USER_MODEL_SPACE_ENDPOINT=https://neollm007-user-model-space.hf.space
HF_JUDGE_SPACE_ENDPOINT=https://your-judge-space.hf.space
HF_SPACE_TOKEN=hf_xxx  # Optional, for private spaces

# Server Config
PORT=3000
NODE_ENV=production

# Optional
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=512
```

---

## Rate Limits & Constraints

- **Max dataset size:** 50 test cases per evaluation
- **HuggingFace model size:** <3B parameters (free tier)
- **Session duration:** 24 hours (auto-cleanup)
- **First model load:** 2-5 minutes (cold start)
- **Subsequent requests:** 10-30 seconds per test case

---

## Support & Troubleshooting

### Common Issues

**Q: Model status stuck at "loading" for >10 minutes**  
A: HuggingFace Space may be down. Check Space health: `https://neollm007-user-model-space.hf.space`

**Q: "No model configured for this session" error**  
A: SessionId expired or invalid. Re-initialize with POST /api/model/initialize

**Q: Evaluation returns timeout**  
A: First inference is slow (model loading). Wait 2-5 minutes after status becomes "ready"

**Q: Can I use multiple models simultaneously?**  
A: Yes! Each sessionId represents one model. Store multiple sessionIds for different models.

---

**Last Updated:** March 2, 2026  
**API Version:** 2.0  
**Backend Repository:** https://github.com/prateekranganath/TestSpark
