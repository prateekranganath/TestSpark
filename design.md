# Design Document: TestSpark – LLM Evaluation Engine

## Overview

TestSpark is a Node.js backend system that provides comprehensive evaluation capabilities for Large Language Models through a RESTful API. The system architecture follows a layered design pattern with clear separation of concerns across controllers, services, models, and validators.

The core innovation is the Universal Model Adapter, which abstracts away provider-specific API differences and enables testing of any OpenAI-compatible model from providers including OpenAI, Ollama, Azure OpenAI, and Together AI. This adapter handles request formatting, response parsing, and error handling uniformly across all providers.

The system supports three evaluation modes:

1. **Automated Test Generation**: Creates synthetic test cases that probe model weaknesses in ambiguity handling, contradiction detection, and negation understanding
2. **Standardized Benchmarks**: Executes industry-standard tests (AIME for mathematics, MMLU for multitask understanding, MSUR for multi-subject reasoning) with benchmark-specific validation strategies
3. **AI-Powered Judging**: Employs an LLM-based judge to evaluate responses across four criteria (accuracy, relevance, coherence, completeness) with detailed scoring and feedback

The architecture is designed for scalability, supporting concurrent evaluation runs through asynchronous processing and connection pooling. All evaluation data persists to MongoDB, enabling comprehensive analytics and performance tracking.

## Architecture

### High-Level Architecture

TestSpark follows a four-layer architecture:

**Presentation Layer (Controllers)**
- Handles HTTP request/response cycle
- Validates incoming requests
- Routes requests to appropriate services
- Formats responses as JSON

**Business Logic Layer (Services)**
- Implements core evaluation workflows
- Orchestrates interactions between components
- Manages evaluation run lifecycle
- Coordinates test generation, execution, and judging

**Data Access Layer (Models)**
- Defines MongoDB schemas using Mongoose
- Provides CRUD operations
- Handles data validation and relationships
- Manages database connections

**Integration Layer (Adapters & Validators)**
- Universal Model Adapter: Interfaces with external LLM APIs
- Validators: Implement benchmark-specific validation logic (AIME, MMLU, MSUR)
- External service integration and error handling


### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      RESTful API Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Evaluation   │  │  Benchmark   │  │  Analytics   │      │
│  │ Controller   │  │  Controller  │  │  Controller  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────────┐
│         │    Business Logic Layer (Services)  │             │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌───────▼──────┐      │
│  │ Evaluation   │  │     Test     │  │  Analytics   │      │
│  │   Service    │  │  Generator   │  │   Service    │      │
│  └──────┬───────┘  │   Service    │  └───────┬──────┘      │
│         │          └──────┬───────┘          │             │
│         │                 │                  │             │
│  ┌──────▼─────────────────▼──────────────────▼──────┐      │
│  │              AI Judge Service                     │      │
│  └──────┬────────────────────────────────────────────┘      │
└─────────┼───────────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────────┐
│         │         Integration Layer                         │
│  ┌──────▼───────────────┐  ┌──────────────────────┐        │
│  │ Universal Model      │  │   Validators         │        │
│  │     Adapter          │  │  - AIME Validator    │        │
│  │                      │  │  - MMLU Validator    │        │
│  │  - OpenAI           │  │  - MSUR Validator    │        │
│  │  - Ollama           │  └──────────────────────┘        │
│  │  - Azure OpenAI     │                                   │
│  │  - Together AI      │                                   │
│  └─────────────────────┘                                   │
└────────────────────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────────┐
│         │         Data Access Layer                         │
│  ┌──────▼───────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │  EvalRun     │  │ TestCase │  │  Model   │  │Judgement││
│  │   Model      │  │  Model   │  │ Response │  │  Model  ││
│  │              │  │          │  │  Model   │  │         ││
│  └──────────────┘  └──────────┘  └──────────┘  └─────────┘│
└────────────────────────────────────────────────────────────┘
          │
          ▼
    ┌──────────┐
    │ MongoDB  │
    └──────────┘
```

## Components and Interfaces

### Controllers Layer

**EvaluationController**
- Responsibilities: Handle evaluation run CRUD operations
- Endpoints:
  - `POST /api/evaluations` - Create new evaluation run
  - `POST /api/evaluations/:id/start` - Start evaluation execution
  - `GET /api/evaluations/:id` - Get evaluation status and results
  - `DELETE /api/evaluations/:id` - Delete evaluation run
- Dependencies: EvaluationService
- Input validation: Request body schemas, parameter validation
- Error handling: 400 for validation errors, 404 for not found, 500 for server errors

**BenchmarkController**
- Responsibilities: Handle benchmark test execution
- Endpoints:
  - `POST /api/benchmarks/aime` - Run AIME benchmark
  - `POST /api/benchmarks/mmlu` - Run MMLU benchmark
  - `POST /api/benchmarks/msur` - Run MSUR benchmark
  - `POST /api/tests/comprehensive` - Run all tests (generated + benchmarks)
  - `POST /api/tests/generate` - Generate synthetic test cases
- Dependencies: EvaluationService, TestGeneratorService
- Input validation: Model configuration, benchmark type validation
- Error handling: Provider-specific error mapping

**AnalyticsController**
- Responsibilities: Provide evaluation analytics and statistics
- Endpoints:
  - `GET /api/analytics/:evaluationId` - Get detailed analytics for evaluation run
  - `GET /api/analytics/benchmarks/:type` - Get benchmark-specific statistics
- Dependencies: AnalyticsService
- Query parameters: Filter by test type, date range
- Response format: JSON with aggregated metrics


### Services Layer

**EvaluationService**
- Responsibilities: Orchestrate evaluation run lifecycle
- Key methods:
  - `createEvaluation(modelConfig)` - Initialize evaluation run with pending status
  - `startEvaluation(evaluationId)` - Execute all test cases for the evaluation
  - `getEvaluationStatus(evaluationId)` - Retrieve current status and results
  - `deleteEvaluation(evaluationId)` - Remove evaluation and cascade delete related data
- Workflow:
  1. Load test cases from database
  2. For each test case, call Universal Model Adapter
  3. Apply appropriate validation strategy (rule-based, LLM-judged, rubric-based)
  4. Persist results and update evaluation status
- Dependencies: UniversalModelAdapter, Validators, Models
- Error handling: Retry logic for transient failures, graceful degradation

**TestGeneratorService**
- Responsibilities: Generate synthetic test cases
- Key methods:
  - `generateAmbiguityTests(count)` - Create tests with ambiguous prompts
  - `generateContradictionTests(count)` - Create tests with contradictory statements
  - `generateNegationTests(count)` - Create tests requiring negation understanding
- Generation strategies:
  - Template-based generation with parameter variation
  - Prompt engineering for LLM-assisted generation
  - Validation of generated test quality
- Dependencies: UniversalModelAdapter (for LLM-assisted generation), TestCaseModel
- Output: Persisted test cases with metadata

**AIJudgeService**
- Responsibilities: Evaluate model responses using LLM-based judging
- Key methods:
  - `judgeResponse(modelResponse, expectedOutput, rubric?)` - Evaluate response across criteria
  - `parseJudgement(judgeOutput)` - Extract scores and feedback from judge response
- Judging prompt structure:
  - System prompt defining evaluation criteria
  - User prompt with test case, expected output, and model response
  - Structured output format (JSON) for scores and feedback
- Criteria evaluation:
  - Accuracy: Factual correctness and alignment with expected output
  - Relevance: Appropriateness to the prompt
  - Coherence: Logical flow and consistency
  - Completeness: Coverage of all required aspects
- Dependencies: UniversalModelAdapter, JudgementModel
- Configuration: Configurable judge model (default: GPT-4)

**AnalyticsService**
- Responsibilities: Aggregate and compute evaluation statistics
- Key methods:
  - `getEvaluationAnalytics(evaluationId)` - Compute comprehensive statistics
  - `getBenchmarkStatistics(benchmarkType, filters)` - Get benchmark-specific metrics
  - `calculatePassRate(testResults)` - Compute pass/fail percentages
  - `calculateAverageScores(judgements)` - Compute mean scores per criterion
- Computed metrics:
  - Overall: Total tests, pass count, fail count, pass rate
  - Performance: Average response time, total token usage
  - Quality: Average scores for accuracy, relevance, coherence, completeness
  - Benchmark-specific: Pass rates per benchmark type
- Dependencies: EvalRunModel, TestCaseModel, ModelResponseModel, JudgementModel
- Optimization: Aggregation pipelines for efficient computation

### Universal Model Adapter

**Design Philosophy**
The Universal Model Adapter provides a unified interface for interacting with any OpenAI-compatible API provider. It abstracts provider-specific differences in endpoint URLs, authentication methods, and response formats.

**Interface**
```typescript
interface ModelConfig {
  provider: 'openai' | 'ollama' | 'azure' | 'together' | string;
  apiKey: string;
  baseURL: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

interface ModelRequest {
  messages: Message[] | string | Message;
  config: ModelConfig;
}

interface ModelResponse {
  text: string;
  responseTime: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
}
```

**Key Methods**
- `sendRequest(request: ModelRequest): Promise<ModelResponse>` - Send request to provider
- `formatRequest(messages, config)` - Convert to provider-specific format
- `parseResponse(providerResponse, config)` - Extract standardized response
- `handleError(error, provider)` - Map provider errors to standard format

**Provider-Specific Handling**

*OpenAI*
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Authentication: Bearer token in Authorization header
- Request format: Standard OpenAI chat completions format
- Response parsing: Extract from `choices[0].message.content`

*Ollama*
- Endpoint: `http://localhost:11434/api/chat` (configurable)
- Authentication: None (local deployment)
- Request format: Similar to OpenAI with minor differences
- Response parsing: Extract from `message.content`

*Azure OpenAI*
- Endpoint: `https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}`
- Authentication: API key in `api-key` header
- Request format: OpenAI-compatible
- Response parsing: Same as OpenAI

*Together AI*
- Endpoint: `https://api.together.xyz/v1/chat/completions`
- Authentication: Bearer token in Authorization header
- Request format: OpenAI-compatible
- Response parsing: Same as OpenAI

**Message Format Normalization**
- Array format: `[{role: 'user', content: 'text'}]` - Pass through
- String format: `'text'` - Convert to `[{role: 'user', content: 'text'}]`
- Object format: `{role: 'user', content: 'text'}` - Wrap in array

**Error Handling**
- Network errors: Retry with exponential backoff (max 3 attempts)
- Rate limiting: Respect retry-after headers
- Invalid responses: Return descriptive error with provider context
- Timeout: Configurable timeout (default 30 seconds)


### Validators Layer

**AIMEValidator**
- Validation strategy: Rule-based numeric extraction and exact matching
- Key methods:
  - `validate(modelResponse, expectedAnswer): ValidationResult`
  - `extractNumericAnswer(responseText): number | null`
- Extraction logic:
  1. Search for numeric patterns in response text
  2. Handle various formats: "42", "The answer is 42", "42.0"
  3. Extract last numeric value if multiple present
  4. Return null if no numeric value found
- Comparison: Exact equality check (with floating-point tolerance)
- Result: `{passed: boolean, extractedAnswer: number | null, expectedAnswer: number}`

**MMLUValidator**
- Validation strategy: LLM-judged validation
- Key methods:
  - `validate(modelResponse, expectedAnswer, question): Promise<ValidationResult>`
- Workflow:
  1. Construct judging prompt with question, expected answer, and model response
  2. Call AIJudgeService with focus on factual correctness
  3. Parse judge decision (correct/incorrect)
  4. Return validation result with judge feedback
- Judge prompt emphasizes:
  - Subject matter accuracy
  - Factual correctness
  - Alignment with expected answer (allowing for paraphrasing)
- Result: `{passed: boolean, judgeFeedback: string, accuracyScore: number}`

**MSURValidator**
- Validation strategy: Rubric-based grading with threshold
- Key methods:
  - `validate(modelResponse, rubric, passingThreshold): Promise<ValidationResult>`
- Workflow:
  1. Construct judging prompt with rubric criteria
  2. Call AIJudgeService with rubric-specific evaluation
  3. Extract numeric score from judge response
  4. Compare score to passing threshold
  5. Return validation result with detailed rubric scores
- Rubric structure:
  - Multiple criteria with point values
  - Detailed scoring guidelines per criterion
  - Total possible points
- Passing logic: `score >= passingThreshold`
- Result: `{passed: boolean, score: number, maxScore: number, criteriaScores: object, feedback: string}`

## Data Models

### EvalRun Schema

```typescript
{
  _id: ObjectId,
  modelConfig: {
    provider: String,
    model: String,
    temperature: Number,
    maxTokens: Number,
    topP: Number,
    apiKey: String (encrypted)
  },
  status: String, // 'pending' | 'running' | 'completed' | 'failed'
  testCases: [ObjectId], // References to TestCase documents
  createdAt: Date,
  updatedAt: Date,
  completedAt: Date,
  metadata: {
    totalTests: Number,
    passedTests: Number,
    failedTests: Number,
    averageResponseTime: Number,
    totalTokenUsage: Number
  }
}
```

**Indexes**
- `_id`: Primary key
- `status`: For filtering by status
- `createdAt`: For time-based queries
- Compound index on `(status, createdAt)` for efficient status + time filtering

**Validation Rules**
- `status` must be one of: pending, running, completed, failed
- `temperature` must be between 0.0 and 2.0
- `maxTokens` must be positive integer
- `topP` must be between 0.0 and 1.0
- `modelConfig.provider` and `modelConfig.model` are required

### TestCase Schema

```typescript
{
  _id: ObjectId,
  type: String, // 'ambiguity' | 'contradiction' | 'negation' | 'benchmark'
  benchmark: String, // 'aime' | 'mmlu' | 'msur' | null
  prompt: String,
  expectedOutput: String,
  validationStrategy: String, // 'rule-based' | 'llm-judged' | 'rubric-based'
  rubric: Object, // For MSUR tests
  metadata: {
    difficulty: String,
    subject: String,
    tags: [String]
  },
  createdAt: Date
}
```

**Indexes**
- `_id`: Primary key
- `type`: For filtering by test type
- `benchmark`: For filtering by benchmark
- Compound index on `(type, benchmark)` for efficient filtering

**Validation Rules**
- `type` must be one of: ambiguity, contradiction, negation, benchmark
- `benchmark` required when type is 'benchmark'
- `validationStrategy` must be one of: rule-based, llm-judged, rubric-based
- `prompt` and `expectedOutput` are required
- `rubric` required when validationStrategy is 'rubric-based'

### ModelResponse Schema

```typescript
{
  _id: ObjectId,
  evalRunId: ObjectId, // Reference to EvalRun
  testCaseId: ObjectId, // Reference to TestCase
  responseText: String,
  responseTime: Number, // milliseconds
  tokenUsage: {
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number
  },
  validationResult: {
    passed: Boolean,
    extractedAnswer: Mixed, // Type depends on validation strategy
    feedback: String
  },
  timestamp: Date,
  provider: String,
  model: String
}
```

**Indexes**
- `_id`: Primary key
- `evalRunId`: For querying responses by evaluation run
- `testCaseId`: For querying responses by test case
- Compound index on `(evalRunId, testCaseId)` for efficient lookups

**Validation Rules**
- `evalRunId` and `testCaseId` must reference existing documents
- `responseTime` must be non-negative
- `tokenUsage` fields must be non-negative integers
- `validationResult.passed` is required boolean

### Judgement Schema

```typescript
{
  _id: ObjectId,
  modelResponseId: ObjectId, // Reference to ModelResponse
  accuracyScore: Number, // 0-100
  relevanceScore: Number, // 0-100
  coherenceScore: Number, // 0-100
  completenessScore: Number, // 0-100
  feedback: {
    accuracy: String,
    relevance: String,
    coherence: String,
    completeness: String,
    overall: String
  },
  judgeModel: String, // Model used for judging
  timestamp: Date
}
```

**Indexes**
- `_id`: Primary key
- `modelResponseId`: For querying judgements by response

**Validation Rules**
- `modelResponseId` must reference existing ModelResponse
- All score fields must be between 0 and 100
- All feedback fields are required strings
- `judgeModel` is required


## API Design

### Endpoint Structure

**Evaluation Management**
- `POST /api/evaluations` - Create evaluation run
  - Request body: `{modelConfig: ModelConfig, testCaseIds?: string[]}`
  - Response: `{evaluationId: string, status: string, createdAt: string}`
  - Status codes: 201 (created), 400 (validation error), 500 (server error)

- `POST /api/evaluations/:id/start` - Start evaluation execution
  - Path parameter: `id` (evaluation ID)
  - Response: `{evaluationId: string, status: string, message: string}`
  - Status codes: 200 (started), 404 (not found), 409 (already running), 500 (server error)

- `GET /api/evaluations/:id` - Get evaluation status and results
  - Path parameter: `id` (evaluation ID)
  - Response: `{evaluation: EvalRun, results: ModelResponse[], analytics: object}`
  - Status codes: 200 (success), 404 (not found), 500 (server error)

- `DELETE /api/evaluations/:id` - Delete evaluation run
  - Path parameter: `id` (evaluation ID)
  - Response: `{message: string, deletedCount: number}`
  - Status codes: 200 (deleted), 404 (not found), 409 (cannot delete running), 500 (server error)

**Benchmark Testing**
- `POST /api/benchmarks/aime` - Run AIME benchmark
  - Request body: `{modelConfig: ModelConfig}`
  - Response: `{evaluationId: string, testCount: number, status: string}`
  - Status codes: 201 (created), 400 (validation error), 500 (server error)

- `POST /api/benchmarks/mmlu` - Run MMLU benchmark
  - Request body: `{modelConfig: ModelConfig, subjects?: string[]}`
  - Response: `{evaluationId: string, testCount: number, status: string}`
  - Status codes: 201 (created), 400 (validation error), 500 (server error)

- `POST /api/benchmarks/msur` - Run MSUR benchmark
  - Request body: `{modelConfig: ModelConfig, passingThreshold?: number}`
  - Response: `{evaluationId: string, testCount: number, status: string}`
  - Status codes: 201 (created), 400 (validation error), 500 (server error)

**Test Generation**
- `POST /api/tests/generate` - Generate synthetic test cases
  - Request body: `{types: string[], count: number}`
  - Response: `{generatedTests: number, testCaseIds: string[]}`
  - Status codes: 201 (created), 400 (validation error), 500 (server error)

- `POST /api/tests/comprehensive` - Run comprehensive test suite
  - Request body: `{modelConfig: ModelConfig, includeGenerated: boolean, includeBenchmarks: string[]}`
  - Response: `{evaluationId: string, totalTests: number, breakdown: object}`
  - Status codes: 201 (created), 400 (validation error), 500 (server error)

**Analytics**
- `GET /api/analytics/:evaluationId` - Get evaluation analytics
  - Path parameter: `evaluationId`
  - Query parameters: `?includeDetails=true`
  - Response: `{analytics: AnalyticsReport}`
  - Status codes: 200 (success), 404 (not found), 500 (server error)

- `GET /api/analytics/benchmarks/:type` - Get benchmark statistics
  - Path parameter: `type` (aime | mmlu | msur)
  - Query parameters: `?startDate=ISO8601&endDate=ISO8601`
  - Response: `{benchmarkStats: BenchmarkStatistics}`
  - Status codes: 200 (success), 400 (invalid type), 500 (server error)

### Response Formats

**Success Response**
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Response**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid model configuration",
    "details": {
      "field": "temperature",
      "issue": "Must be between 0.0 and 2.0"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Analytics Report Format**
```json
{
  "evaluationId": "eval_123",
  "overall": {
    "totalTests": 150,
    "passedTests": 120,
    "failedTests": 30,
    "passRate": 0.80
  },
  "performance": {
    "averageResponseTime": 1250,
    "totalTokenUsage": 45000,
    "averageTokensPerTest": 300
  },
  "qualityScores": {
    "accuracy": 85.5,
    "relevance": 88.2,
    "coherence": 90.1,
    "completeness": 82.7
  },
  "benchmarkBreakdown": {
    "aime": {
      "totalTests": 50,
      "passedTests": 35,
      "passRate": 0.70
    },
    "mmlu": {
      "totalTests": 50,
      "passedTests": 42,
      "passRate": 0.84
    },
    "msur": {
      "totalTests": 50,
      "passedTests": 43,
      "passRate": 0.86
    }
  }
}
```

## Benchmark Validation Workflow

### AIME Workflow

```
1. Load AIME test cases from database
   ↓
2. For each test case:
   a. Submit problem to model via Universal Adapter
   b. Receive model response
   c. Extract numeric answer using regex patterns
   d. Compare to expected answer (exact match)
   e. Mark as passed/failed
   f. Persist ModelResponse with validation result
   ↓
3. Update EvalRun with completion status
   ↓
4. Return results with pass/fail counts
```

**Numeric Extraction Patterns**
- Pattern 1: `\b(\d+\.?\d*)\b` - Standalone numbers
- Pattern 2: `answer is (\d+\.?\d*)` - Explicit answer statements
- Pattern 3: `= (\d+\.?\d*)` - Equation results
- Strategy: Try patterns in order, use last match if multiple found

### MMLU Workflow

```
1. Load MMLU test cases from database
   ↓
2. For each test case:
   a. Submit question to model via Universal Adapter
   b. Receive model response
   c. Submit to AI Judge with expected answer
   d. AI Judge evaluates factual correctness
   e. Parse judge decision (correct/incorrect)
   f. Mark as passed/failed based on judge decision
   g. Persist ModelResponse and Judgement
   ↓
3. Update EvalRun with completion status
   ↓
4. Return results with pass/fail counts and average scores
```

**Judge Prompt Template**
```
You are evaluating an LLM's response to a knowledge question.

Question: {question}
Expected Answer: {expectedAnswer}
Model Response: {modelResponse}

Evaluate the response for factual correctness and subject matter accuracy.
Consider the response correct if it conveys the same meaning as the expected answer,
even if worded differently.

Provide your evaluation in JSON format:
{
  "correct": true/false,
  "accuracyScore": 0-100,
  "feedback": "explanation"
}
```

### MSUR Workflow

```
1. Load MSUR test cases with rubrics from database
   ↓
2. For each test case:
   a. Submit question to model via Universal Adapter
   b. Receive model response
   c. Submit to AI Judge with rubric
   d. AI Judge evaluates against rubric criteria
   e. Extract numeric score from judge response
   f. Compare score to passing threshold
   g. Mark as passed/failed based on threshold
   h. Persist ModelResponse and Judgement with rubric scores
   ↓
3. Update EvalRun with completion status
   ↓
4. Return results with pass/fail counts and rubric score breakdown
```

**Judge Prompt Template**
```
You are evaluating an LLM's response using a detailed rubric.

Question: {question}
Model Response: {modelResponse}

Rubric:
{rubricCriteria}

Evaluate the response against each rubric criterion and assign points.
Provide detailed feedback for each criterion.

Provide your evaluation in JSON format:
{
  "criteriaScores": {
    "criterion1": points,
    "criterion2": points,
    ...
  },
  "totalScore": sum,
  "maxScore": total_possible,
  "feedback": {
    "criterion1": "explanation",
    "criterion2": "explanation",
    ...
  }
}
```


## Sequence Diagrams

### Comprehensive Test Execution Flow

```
Client          API           Evaluation      Test          Universal      AI Judge      Database
  │             Controller     Service        Generator      Adapter        Service
  │                │              │               │              │              │            │
  │─POST /tests/comprehensive────>│              │              │              │            │
  │                │              │               │              │              │            │
  │                │──createEval()─>│             │              │              │            │
  │                │              │──save()───────────────────────────────────────────────>│
  │                │              │<─evalId───────────────────────────────────────────────│
  │                │              │               │              │              │            │
  │                │              │──generate()──>│              │              │            │
  │                │              │               │──save()──────────────────────────────>│
  │                │              │<─testIds──────│              │              │            │
  │                │              │               │              │              │            │
  │                │              │──loadBenchmarks()────────────────────────────────────>│
  │                │              │<─benchmarkTests──────────────────────────────────────│
  │                │              │               │              │              │            │
  │                │              │──for each test case──────────────────────────────────│
  │                │              │               │              │              │            │
  │                │              │──sendRequest()──────────────>│              │            │
  │                │              │               │              │─API call────>│            │
  │                │              │               │              │<─response────│            │
  │                │              │<─modelResponse───────────────│              │            │
  │                │              │               │              │              │            │
  │                │              │──validate()──────────────────────────────>│            │
  │                │              │               │              │              │            │
  │                │              │──if LLM-judged or rubric-based──────────>│            │
  │                │              │               │              │──sendRequest()────────>│
  │                │              │               │              │<─judgeResponse─────────│
  │                │              │<─judgement────────────────────────────────│            │
  │                │              │               │              │              │            │
  │                │              │──saveResponse()──────────────────────────────────────>│
  │                │              │──saveJudgement()─────────────────────────────────────>│
  │                │              │               │              │              │            │
  │                │              │──end loop────────────────────────────────────────────│
  │                │              │               │              │              │            │
  │                │              │──updateStatus('completed')───────────────────────────>│
  │                │              │               │              │              │            │
  │                │<─results─────│               │              │              │            │
  │<─200 OK + analytics───────────│               │              │              │            │
```

### Evaluation Run Lifecycle

```
Client          API           Evaluation      Database
  │             Controller     Service
  │                │              │               │
  │─POST /evaluations────────────>│               │
  │                │              │               │
  │                │──create()───>│               │
  │                │              │──save()──────>│
  │                │              │  status:      │
  │                │              │  'pending'    │
  │                │              │<─evalId──────│
  │                │<─evalId──────│               │
  │<─201 Created──────────────────│               │
  │                │              │               │
  │─POST /evaluations/:id/start──>│               │
  │                │              │               │
  │                │──start()────>│               │
  │                │              │──update()────>│
  │                │              │  status:      │
  │                │              │  'running'    │
  │                │              │               │
  │                │              │──execute()────│
  │                │              │  (async)      │
  │                │<─started─────│               │
  │<─200 OK───────────────────────│               │
  │                │              │               │
  │                │              │──[execution]──│
  │                │              │               │
  │                │              │──update()────>│
  │                │              │  status:      │
  │                │              │  'completed'  │
  │                │              │               │
  │─GET /evaluations/:id─────────>│               │
  │                │              │               │
  │                │──getStatus()─>│              │
  │                │              │──query()─────>│
  │                │              │<─evalData────│
  │                │<─results─────│               │
  │<─200 OK + data────────────────│               │
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Configuration Acceptance

*For any* valid model configuration containing required fields (provider, model, apiKey, baseURL) and optional parameters within valid ranges (temperature 0.0-2.0, maxTokens > 0, topP 0.0-1.0), the Universal Model Adapter should accept the configuration without errors.

**Validates: Requirements 1.1, 18.1, 18.2, 18.3**

### Property 2: Request Format Compliance

*For any* model request with valid configuration and messages, the Universal Model Adapter should format the request to include all required OpenAI API fields (model, messages, temperature, max_tokens, top_p) in the correct structure.

**Validates: Requirements 1.2**

### Property 3: Response Parsing Consistency

*For any* valid API provider response, the Universal Model Adapter should parse it into a standardized ModelResponse format containing text, responseTime, tokenUsage, provider, and model fields.

**Validates: Requirements 1.3**

### Property 4: Error Message Completeness

*For any* API call failure, the Universal Model Adapter should return an error message that includes both the provider name and error details.

**Validates: Requirements 1.5**

### Property 5: Message Format Normalization

*For any* message in array, string, or object format, the TestSpark System should normalize it to the format required by the target API provider without losing content.

**Validates: Requirements 2.4**

### Property 6: Invalid Format Rejection

*For any* message that is not in array, string, or object format, the TestSpark System should return an error indicating the expected formats.

**Validates: Requirements 2.5**

### Property 7: Test Generation Characteristics

*For any* test generation request of a specific type (ambiguity, contradiction, negation), the Test Generator should create test cases that exhibit the requested characteristic and can be validated as such.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 8: Test Case Persistence Round-Trip

*For any* generated test case, persisting it to the database and then querying it back should produce an equivalent test case with all fields preserved.

**Validates: Requirements 3.4**

### Property 9: Generation Result Accuracy

*For any* test generation request with count N, the Test Generator should return exactly N test case identifiers and the count should equal N.

**Validates: Requirements 3.5**

### Property 10: Benchmark Loading Completeness

*For any* benchmark type (AIME, MMLU, MSUR), loading benchmark test cases from the database should return all test cases of that benchmark type with no duplicates or omissions.

**Validates: Requirements 4.1, 5.1, 6.1**

### Property 11: Test Execution Completeness

*For any* evaluation run with N test cases, executing the evaluation should submit all N test cases to the model and produce N model responses.

**Validates: Requirements 4.2, 5.2, 6.2**

### Property 12: AIME Numeric Extraction

*For any* model response containing a numeric answer in standard formats (standalone number, "answer is X", "= X"), the AIME validator should successfully extract the numeric value.

**Validates: Requirements 4.3**

### Property 13: AIME Pass/Fail Logic

*For any* AIME test case, if the extracted numeric answer equals the expected answer, the test should be marked as passed; otherwise, it should be marked as failed.

**Validates: Requirements 4.4, 4.5, 4.6**

### Property 14: MMLU Judge Integration

*For any* MMLU model response, the system should submit the response to the AI Judge and receive a judgement containing an accuracy score and feedback.

**Validates: Requirements 5.3, 5.4**

### Property 15: MMLU Pass/Fail Logic

*For any* MMLU test case, the pass/fail status should match the AI Judge's correctness determination.

**Validates: Requirements 5.5, 5.6**

### Property 16: MSUR Rubric Integration

*For any* MSUR model response, the system should submit both the response and the associated rubric to the AI Judge and receive a judgement with rubric-aligned scores.

**Validates: Requirements 6.3, 6.4, 6.5**

### Property 17: MSUR Threshold Logic

*For any* MSUR test case with passing threshold T, if the rubric score is >= T, the test should be marked as passed; otherwise, it should be marked as failed.

**Validates: Requirements 6.6, 6.7**

### Property 18: Evaluation Creation

*For any* valid model configuration, creating an evaluation run should produce a record with a unique identifier, the provided configuration, status "pending", and timestamps.

**Validates: Requirements 7.1**

### Property 19: Status Transition

*For any* evaluation run with status "pending", starting the evaluation should update the status to "running".

**Validates: Requirements 7.2**

### Property 20: Status Monitoring

*For any* evaluation run identifier, querying the status should return the current status and associated data without modifying the evaluation.

**Validates: Requirements 7.3**

### Property 21: Completion Status Update

*For any* evaluation run that completes execution, the status should be updated to "completed" and all results should be persisted.

**Validates: Requirements 7.4**

### Property 22: Cascading Deletion

*For any* evaluation run with associated test cases, model responses, and judgements, deleting the evaluation should remove all associated records from the database.

**Validates: Requirements 7.5**

### Property 23: Running Evaluation Protection

*For any* evaluation run with status "running", attempting to delete it should be rejected with an appropriate error.

**Validates: Requirements 7.6**

### Property 24: Multi-Criteria Scoring Completeness

*For any* model response requiring judging, the AI Judge should produce a judgement containing scores for all four criteria (accuracy, relevance, coherence, completeness).

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 25: Score Range Validity

*For any* judgement produced by the AI Judge, all criterion scores should be numeric values between 0 and 100 inclusive.

**Validates: Requirements 8.5**

### Property 26: Feedback Presence

*For any* judgement produced by the AI Judge, textual feedback should be present for each of the four criteria.

**Validates: Requirements 8.6**

### Property 27: Judgement Persistence Round-Trip

*For any* judgement with all scores and feedback, persisting it to the database and querying it back should produce an equivalent judgement with all fields preserved.

**Validates: Requirements 8.7**

### Property 28: Comprehensive Test Execution

*For any* comprehensive test request, the system should execute all generated test cases (ambiguity, contradiction, negation) and all benchmark tests (AIME, MMLU, MSUR).

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 29: Result Aggregation Completeness

*For any* comprehensive test execution, the unified report should contain results from all test types (generated and benchmarks).

**Validates: Requirements 9.5**

### Property 30: Statistics Completeness

*For any* comprehensive test report, it should include overall pass rate, average scores for all four criteria, and benchmark-specific statistics.

**Validates: Requirements 9.6**

### Property 31: Timestamp Recording

*For any* model request and response, both request timestamp and response timestamp should be recorded.

**Validates: Requirements 10.1, 10.2**

### Property 32: Response Time Calculation

*For any* model response with request and response timestamps, the calculated response time should equal the difference between the two timestamps.

**Validates: Requirements 10.3**

### Property 33: Token Usage Extraction

*For any* API provider response containing token usage information, the system should extract and persist the token usage data.

**Validates: Requirements 10.4**

### Property 34: Performance Metrics Persistence

*For any* model response, the persisted record should include both response time and token usage (if available).

**Validates: Requirements 10.5**

### Property 35: Analytics Metrics Inclusion

*For any* analytics report, it should include response time and token usage metrics.

**Validates: Requirements 10.6**

### Property 36: Analytics Count Accuracy

*For any* evaluation run, the analytics should report total test count, pass count, and fail count that sum correctly (total = pass + fail).

**Validates: Requirements 11.1**

### Property 37: Analytics Score Calculation

*For any* evaluation run with judgements, the analytics should calculate average scores for all four criteria correctly (sum of scores / count).

**Validates: Requirements 11.2**

### Property 38: Analytics Performance Calculation

*For any* evaluation run, the analytics should calculate average response time and total token usage correctly.

**Validates: Requirements 11.3**

### Property 39: Benchmark Statistics Breakdown

*For any* evaluation run containing multiple benchmark types, the analytics should provide separate pass rates for AIME, MMLU, and MSUR.

**Validates: Requirements 11.4**

### Property 40: Analytics Filtering

*For any* analytics request with filters (test type, benchmark, time range), the returned analytics should only include data matching all specified filters.

**Validates: Requirements 11.5**

### Property 41: Analytics JSON Format

*For any* analytics request via the RESTful API, the response should be valid JSON that can be parsed without errors.

**Validates: Requirements 11.6**

### Property 42: Data Persistence Round-Trip

*For any* record type (EvalRun, TestCase, ModelResponse, Judgement), creating a record with all required fields, persisting it, and querying it back should produce an equivalent record with all fields preserved.

**Validates: Requirements 13.1, 13.2, 13.3, 13.4**

### Property 43: Database Error Handling

*For any* database write operation that fails, the system should return an error and not leave the database in an inconsistent state.

**Validates: Requirements 13.5**

### Property 44: Query Capability

*For any* record type, the system should support querying by identifier, status (where applicable), and timestamp.

**Validates: Requirements 13.6**

### Property 45: Configuration Validation

*For any* system startup with missing required configuration (MongoDB connection string or API provider credentials), the system should fail to start and log a descriptive error message.

**Validates: Requirements 14.5**

### Property 46: API Error Logging

*For any* API call failure to an API provider, the system should log an error containing the provider name, model name, and error details.

**Validates: Requirements 15.1**

### Property 47: Database Error Logging

*For any* database operation failure, the system should log an error containing the operation type and affected collection.

**Validates: Requirements 15.2**

### Property 48: Validation Error Response

*For any* request with validation errors, the system should return a 400 status code with specific details about which validation failed.

**Validates: Requirements 15.3**

### Property 49: Internal Error Response

*For any* internal server error, the system should return a 500 status code and log the full error stack trace.

**Validates: Requirements 15.4**

### Property 50: Request Logging

*For any* API request, the system should log the timestamp, endpoint, and request parameters.

**Validates: Requirements 15.5**

### Property 51: Authentication Enforcement

*For any* API request with valid authentication, the request should be processed; for any request without valid authentication, the system should return a 401 status code.

**Validates: Requirements 16.1, 16.2**

### Property 52: Credential Security

*For any* error message or API response, API keys should not be present in the output.

**Validates: Requirements 16.4**

### Property 53: Input Sanitization

*For any* user input containing potentially malicious content (SQL injection, NoSQL injection, XSS), the system should sanitize or reject the input.

**Validates: Requirements 16.5**

### Property 54: Concurrent Execution Safety

*For any* set of concurrent evaluation runs, all runs should complete without data corruption and each run's data should remain isolated.

**Validates: Requirements 17.1**

### Property 55: Overload Handling

*For any* system state where load exceeds capacity, new requests should be queued and clients should receive appropriate status messages.

**Validates: Requirements 17.4**

### Property 56: Parameter Range Validation

*For any* evaluation creation request with temperature outside 0.0-2.0, max_tokens <= 0, or top_p outside 0.0-1.0, the system should return an error indicating the valid range.

**Validates: Requirements 18.5**

### Property 57: Default Parameter Application

*For any* evaluation creation request without optional parameters, the system should use default values (temperature: 0.7, max_tokens: 2048, top_p: 1.0).

**Validates: Requirements 18.4**


## Error Handling

### Error Categories

**Validation Errors (400)**
- Invalid model configuration parameters
- Missing required fields
- Out-of-range parameter values
- Invalid message formats
- Malformed request bodies

**Authentication Errors (401)**
- Missing API key
- Invalid API key
- Expired credentials

**Not Found Errors (404)**
- Evaluation run not found
- Test case not found
- Invalid endpoint

**Conflict Errors (409)**
- Attempting to delete running evaluation
- Attempting to start already running evaluation
- Duplicate resource creation

**External Service Errors (502/503)**
- API provider unavailable
- API provider rate limiting
- API provider timeout

**Internal Server Errors (500)**
- Database connection failures
- Unexpected exceptions
- Data corruption

### Error Handling Strategy

**Retry Logic**
- Network errors: Exponential backoff, max 3 retries
- Rate limiting: Respect retry-after headers
- Timeout: Configurable timeout (default 30s)
- Transient failures: Automatic retry with backoff

**Error Propagation**
- Controllers catch service errors and map to HTTP status codes
- Services catch adapter/validator errors and add context
- Adapters catch provider errors and standardize format
- All errors logged with full context

**Graceful Degradation**
- If AI Judge unavailable, fall back to rule-based validation where possible
- If token usage unavailable, continue without token metrics
- If optional features fail, log warning and continue core operation

**Error Response Format**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "issue": "specific issue description"
    },
    "requestId": "unique_request_id",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Logging Strategy

**Log Levels**
- DEBUG: Detailed execution flow, variable values
- INFO: Request/response logging, operation completion
- WARN: Recoverable errors, degraded functionality
- ERROR: Unrecoverable errors, exceptions

**Log Format**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "ERROR",
  "component": "UniversalModelAdapter",
  "message": "API call failed",
  "context": {
    "provider": "openai",
    "model": "gpt-4",
    "error": "Rate limit exceeded",
    "requestId": "req_123"
  },
  "stackTrace": "..."
}
```

**Sensitive Data Handling**
- API keys: Never logged, masked in error messages
- User data: Sanitized before logging
- Credentials: Stored encrypted, never in logs

## Security Considerations

### Authentication and Authorization

**API Key Authentication**
- API keys passed in `X-API-Key` header
- Keys stored hashed in database
- Key validation on every request
- Rate limiting per API key (100 requests/minute)

**API Provider Credentials**
- Stored in environment variables
- Encrypted at rest
- Never exposed in responses or logs
- Rotated regularly

### Input Validation

**Request Validation**
- Schema validation for all request bodies
- Type checking for all parameters
- Range validation for numeric values
- Length limits for string fields

**Injection Prevention**
- MongoDB query sanitization
- NoSQL injection prevention
- XSS prevention in error messages
- Command injection prevention

### Data Security

**Encryption**
- HTTPS for all external communications
- API keys encrypted at rest
- Sensitive configuration encrypted
- Database connections encrypted (TLS)

**Access Control**
- Evaluation runs isolated by API key
- No cross-user data access
- Admin endpoints require elevated privileges

### Rate Limiting

**Per-API-Key Limits**
- 100 requests per minute
- 1000 requests per hour
- Configurable per key

**Global Limits**
- 1000 concurrent evaluation runs
- 10000 requests per minute system-wide

**Response Headers**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705318200
```

## Scalability Strategy

### Horizontal Scaling

**Stateless Design**
- No session state in API servers
- All state persisted to database
- Load balancer distributes requests
- Multiple API server instances

**Database Scaling**
- MongoDB replica sets for read scaling
- Sharding for write scaling
- Connection pooling (min: 10, max: 100)
- Query optimization with indexes

### Asynchronous Processing

**Evaluation Execution**
- Evaluation runs execute asynchronously
- Client receives immediate response with evaluation ID
- Client polls for status updates
- Background workers process evaluations

**Queue Management**
- In-memory queue for pending evaluations
- Configurable concurrency limit
- Priority queue for urgent evaluations
- Dead letter queue for failed evaluations

### Caching Strategy

**Response Caching**
- Cache analytics results (TTL: 5 minutes)
- Cache benchmark test cases (TTL: 1 hour)
- Cache model responses for identical inputs (TTL: 24 hours)
- Cache invalidation on data updates

**Database Query Optimization**
- Indexes on frequently queried fields
- Aggregation pipelines for analytics
- Projection to limit returned fields
- Pagination for large result sets

### Performance Targets

**Response Times**
- API endpoints: < 200ms (excluding model calls)
- Model API calls: < 5s (provider-dependent)
- Analytics queries: < 500ms
- Database queries: < 100ms

**Throughput**
- 1000 requests/second per API server
- 100 concurrent evaluation runs
- 10000 test cases per evaluation run

## Deployment Architecture

### Infrastructure Components

**Application Tier**
- Node.js API servers (multiple instances)
- Load balancer (NGINX or cloud load balancer)
- Auto-scaling based on CPU/memory
- Health check endpoints

**Database Tier**
- MongoDB replica set (1 primary, 2 secondaries)
- Automated backups (daily)
- Point-in-time recovery
- Monitoring and alerting

**Monitoring and Logging**
- Centralized logging (ELK stack or cloud logging)
- Metrics collection (Prometheus or cloud metrics)
- Alerting (PagerDuty or cloud alerting)
- Distributed tracing (Jaeger or cloud tracing)

### Deployment Environments

**Development**
- Single API server instance
- Local MongoDB instance
- Mock API providers for testing
- Debug logging enabled

**Staging**
- 2 API server instances
- MongoDB replica set (3 nodes)
- Real API providers with test accounts
- Info logging enabled

**Production**
- 5+ API server instances (auto-scaling)
- MongoDB replica set (3+ nodes)
- Real API providers with production accounts
- Warn/Error logging enabled
- High availability configuration

### CI/CD Pipeline

**Build Stage**
- Dependency installation
- TypeScript compilation
- Linting and code quality checks
- Unit test execution

**Test Stage**
- Integration tests
- Property-based tests
- API contract tests
- Performance tests

**Deploy Stage**
- Container image build
- Image scanning for vulnerabilities
- Deployment to target environment
- Health check verification
- Rollback on failure

### Monitoring and Observability

**Key Metrics**
- Request rate and latency
- Error rate by endpoint
- Evaluation run duration
- Database query performance
- API provider response times
- Token usage and costs

**Alerts**
- High error rate (> 5%)
- Slow response times (> 1s)
- Database connection failures
- API provider failures
- High memory/CPU usage
- Disk space low

**Dashboards**
- Real-time request metrics
- Evaluation run statistics
- API provider health
- Database performance
- Cost tracking (token usage)

## Testing Strategy

### Dual Testing Approach

TestSpark employs both unit testing and property-based testing to ensure comprehensive coverage and correctness.

**Unit Tests**
- Focus on specific examples and edge cases
- Test individual components in isolation
- Verify error handling and boundary conditions
- Mock external dependencies (API providers, database)
- Fast execution for rapid feedback

**Property-Based Tests**
- Verify universal properties across all inputs
- Generate random test data (100+ iterations per property)
- Catch edge cases not considered in unit tests
- Validate correctness properties from design document
- Each test tagged with feature name and property number

**Complementary Coverage**
- Unit tests catch concrete bugs in specific scenarios
- Property tests verify general correctness across input space
- Together they provide comprehensive validation

### Testing Layers

**Unit Tests**
- Controllers: Request validation, response formatting, error handling
- Services: Business logic, workflow orchestration, state management
- Adapters: Request formatting, response parsing, provider-specific logic
- Validators: Validation strategies, scoring logic, threshold checks
- Models: Schema validation, data integrity, query methods

**Integration Tests**
- API endpoint testing with real HTTP requests
- Database integration with test MongoDB instance
- Service-to-service communication
- End-to-end workflows (create → execute → analyze)

**Property-Based Tests**
- Configuration acceptance (Property 1)
- Request/response formatting (Properties 2, 3, 5)
- Data persistence round-trips (Properties 8, 27, 42)
- Validation logic (Properties 13, 15, 17)
- Analytics calculations (Properties 36, 37, 38)
- Error handling (Properties 43, 45, 48, 49)
- Security (Properties 51, 52, 53)

### Property Test Configuration

**Framework**: fast-check (for JavaScript/TypeScript)

**Configuration**
- Minimum 100 iterations per property test
- Seed-based reproducibility for failures
- Shrinking to find minimal failing examples
- Timeout: 30 seconds per property

**Test Tagging Format**
```javascript
// Feature: testspark-llm-evaluation-engine, Property 1: Configuration Acceptance
test('Universal Adapter accepts valid configurations', () => {
  fc.assert(
    fc.property(validConfigGenerator, (config) => {
      expect(() => adapter.validateConfig(config)).not.toThrow();
    }),
    { numRuns: 100 }
  );
});
```

**Generators**
- `validConfigGenerator`: Generates valid model configurations
- `messageGenerator`: Generates messages in various formats
- `testCaseGenerator`: Generates test cases with all required fields
- `responseGenerator`: Generates API provider responses
- `evaluationRunGenerator`: Generates evaluation run data

### Test Data Management

**Fixtures**
- Sample AIME problems with expected answers
- Sample MMLU questions with correct answers
- Sample MSUR questions with rubrics
- Mock API provider responses
- Sample evaluation runs with results

**Test Database**
- Separate MongoDB instance for testing
- Reset between test suites
- Seeded with fixture data
- Isolated from production data

### Continuous Testing

**Pre-commit**
- Linting and formatting checks
- Unit tests for changed files
- Fast property tests (10 iterations)

**CI Pipeline**
- All unit tests
- All property tests (100 iterations)
- Integration tests
- Code coverage reporting (target: 80%)

**Nightly**
- Extended property tests (1000 iterations)
- Performance tests
- Security scans
- Dependency vulnerability checks

## Future Enhancements

### Phase 2 Features

**Custom Benchmark Support**
- User-defined benchmarks with custom validation
- Benchmark versioning and management
- Benchmark sharing and collaboration

**Advanced Analytics**
- Trend analysis over time
- Model comparison reports
- Performance regression detection
- Cost optimization recommendations

**Batch Processing**
- Bulk evaluation runs
- Scheduled evaluations
- Parallel execution optimization

### Phase 3 Features

**Multi-Modal Support**
- Image input evaluation
- Audio input evaluation
- Video input evaluation
- Multi-modal benchmarks

**Collaborative Features**
- Team workspaces
- Shared evaluation runs
- Role-based access control
- Audit logging

**Advanced Judging**
- Multiple judge consensus
- Human-in-the-loop judging
- Custom judging criteria
- Judge model comparison

### Infrastructure Improvements

**Performance**
- Redis caching layer
- GraphQL API option
- WebSocket for real-time updates
- Streaming responses

**Reliability**
- Circuit breakers for API providers
- Fallback providers
- Automatic failover
- Disaster recovery

**Observability**
- Enhanced tracing
- Custom metrics
- Real-time dashboards
- Anomaly detection
