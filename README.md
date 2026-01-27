# LLM Evaluation Engine

A comprehensive Node.js backend for evaluating Large Language Models (LLMs) using automated test case generation, benchmark testing, and AI-powered judging. **Now with universal model adapter support for testing any model from any provider!**

## 🎯 Features

### Core Capabilities
- **Universal Model Adapter**: Test ANY model from ANY API provider (OpenAI, Anthropic, Together AI, Ollama, etc.)
- **Flexible API Integration**: Works with any OpenAI-compatible API client
- **Automated Test Case Generation**: Generate test cases with ambiguity, contradiction, and negation patterns
- **Benchmark Testing**: Standardized evaluation across AIME, MMLU, and MSUR benchmarks
- **Comprehensive Model Testing**: Single endpoint to test models on generated cases + all benchmarks
- **Evaluation Runs**: Execute batch evaluations across multiple test cases
- **AI-Powered Judging**: Automated response evaluation using judge models
- **Multi-Criteria Scoring**: Evaluate responses on accuracy, relevance, coherence, and completeness
- **Detailed Analytics**: Track metrics, pass rates, and performance statistics with benchmark-specific insights
- **RESTful API**: Clean, organized endpoints for all operations

### Benchmark Support
- **AIME** (American Invitational Mathematics Examination): Mathematical reasoning with rule-based validation
- **MMLU** (Massive Multitask Language Understanding): Multi-domain knowledge with LLM-judged validation
- **MSUR** (Mathematical Sciences Undergraduate Research): Proof writing with rubric-based grading

## 🚀 Model Adapter

The **universal adapter** allows you to evaluate any model with custom configuration:

### Quick Start
```javascript
// Test any model via REST API
POST /api/eval/test-custom-model
{
  "modelName": "your-model-name",
  "testCaseId": "test-case-id",
  "parameters": {
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

### Supported Features
- ✅ Multiple message formats (array, string, object)
- ✅ Custom API clients (OpenAI, Together AI, Azure, etc.)
- ✅ Flexible parameters (temperature, max_tokens, top_p, etc.)
- ✅ Standardized response format
- ✅ Full benchmark validation support

📖 **[Complete Adapter Documentation](./ADAPTER_USAGE.md)**

## 🏗️ Architecture

```
TESTSPARK/
├── controllers/        # Request handlers and validation
│   ├── eval.controller.js
│   ├── generator.controller.js
│   └── judge.controller.js
├── services/          # Business logic layer
│   ├── evalservice.js         # Evaluation orchestration + benchmark routing
│   ├── generatorservice.js    # Test case generation
│   ├── judgeservice.js        # Response judgement + benchmark integration
│   └── llmservice.js          # LLM API interface + Universal Adapter
├── models/            # MongoDB schemas
│   ├── evalrun.js
│   ├── testcase.js            # Extended with benchmark metadata
│   ├── modelresponse.js
│   └── judgement.js           # Enhanced with benchmarkEvaluation
├── validators/        # Output validators
│   └── output/
│       ├── aimevalidator.js   # AIME numeric validation
│       ├── mmluvalidator.js   # MMLU LLM-judged validation
│       └── mmsurvalidator.js  # MSUR rubric-based grading
├── benchmarks/        # Benchmark test data
│   ├── AIME/          # Math problems (problems.json)
│   ├── MMLU/          # Multi-domain questions (questions.json)
│   └── MSUR/          # Math research tasks (task.json)
├── examples/          # Usage examples
│   ├── adapterExamples.js     # Adapter function examples
│   └── httpApiExamples.js     # HTTP API request examples
├── tools/             # Utility scripts
│   ├── benchmarkLoader.js     # Load benchmark data to DB
│   └── testBenchmarkIntegration.js
├── routes/            # API endpoints
│   ├── eval.routes.js
│   ├── generator.routes.js
│   └── judge.routes.js
├── prompts/           # System prompts
│   ├── judge.txt
│   └── generators/
│       ├── ambiguity.txt
│       ├── contradiction.txt
│       └── negation.txt
└── db/                # Database connection
    └── connectdb.js
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB (local or Atlas)
- Ollama or OpenAI API (for LLM inference)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd TESTSPARK
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configurations
```

4. Load benchmark data (optional but recommended):
```bash
node tools/benchmarkLoader.js
```

5. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3000`

## 📝 Environment Variables

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_API_KEY=ollama
GENERATOR_MODEL=llama2:7b-chat
JUDGE_MODEL=gpt-4                    # Recommended for benchmark validation
DEFAULT_TEMPERATURE=0.7
PASSING_SCORE=6.0
```

## 📚 API Documentation

### Quick Testing Endpoints

#### Test Custom Model 🆕
```bash
POST /api/eval/test-custom-model
```
Test any model from any provider with custom configuration. Supports flexible parameters and custom API clients.

**Body:**
```json
{
  "modelName": "your-model-name",
  "testCaseId": "test-case-id",
  "parameters": {
    "temperature": 0.7,
    "max_tokens": 1000,
    "top_p": 0.9
  },
  "judgeModel": "gpt-4"
}
```

**Response:** Complete test results with model response, judgement, benchmark validation, and performance metrics.

**Use Cases:**
- Test any OpenAI-compatible model
- Custom parameter tuning
- Different API providers (Together AI, Anthropic, etc.)
- Quick validation before full evaluation

#### Test Single Benchmark
```bash
POST /api/eval/test-benchmark
```
Test model on one benchmark test case with detailed validation and judgement.

**Body:**
```json
{
  "modelName": "gpt-4",
  "testCaseId": "AIME-01",
  "temperature": 0.1
}
```

**Response:** Detailed judgement with benchmark validation, quality assessment, and smart recommendation (EXCELLENT/GOOD/POOR/FAILED).

#### Comprehensive Model Test 🌟
```bash
POST /api/eval/comprehensive-test
```
Complete evaluation: Generate test variants + Test all 3 benchmarks in one call.

**Body:**
```json
{
  "modelName": "gpt-4",
  "userPrompt": "Explain quantum entanglement",
  "samplesPerBenchmark": 3
}
```

**Response:** Comprehensive analysis with:
- Generated test performance (original, ambiguity, contradiction, negation)
- Benchmark performance (AIME, MMLU, MSUR)
- Overall verdict, strengths, weaknesses, and recommendations

### Evaluation Routes (`/api/eval`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/runs` | Create new evaluation run |
| GET | `/runs` | Get all evaluation runs |
| GET | `/runs/:evalRunId` | Get evaluation run status |
| GET | `/runs/:evalRunId/results` | Get full evaluation results with benchmark metrics |
| GET | `/runs/:evalRunId/benchmark-stats` | Get detailed benchmark statistics |
| POST | `/runs/:evalRunId/start` | Start evaluation run |
| POST | `/evaluate` | Run single evaluation |
| POST | `/test-benchmark` | Quick test on single benchmark case |
| POST | `/comprehensive-test` | Generate tests + All benchmarks evaluation |
| DELETE | `/runs/:evalRunId` | Delete evaluation run |

### Generator Routes (`/api/generator`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate` | Generate test cases from parent |
| POST | `/testcases` | Create single test case |
| POST | `/testcases/bulk` | Bulk create test cases |
| GET | `/testcases` | Get all test cases |
| GET | `/testcases/:testCaseId` | Get test case by ID |
| PATCH | `/testcases/:testCaseId` | Update test case |
| DELETE | `/testcases/:testCaseId` | Delete test case |

### Judge Routes (`/api/judge`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/judge` | Judge a model response |
| GET | `/judgements/:judgementId` | Get judgement by ID |
| GET | `/evalrun/:evalRunId/judgements` | Get judgements for eval run |
| GET | `/evalrun/:evalRunId/stats` | Get statistics for eval run |
| GET | `/testcase/:testCaseId/judgements` | Get judgements for test case |

## 🔧 Usage Examples

### Quick Benchmark Test

```bash
curl -X POST http://localhost:3000/api/eval/test-benchmark \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gpt-4",
    "testCaseId": "AIME-01"
  }'
```

### Comprehensive Test (All Features)

```bash
curl -X POST http://localhost:3000/api/eval/comprehensive-test \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gpt-4",
    "userPrompt": "Explain machine learning in simple terms",
    "samplesPerBenchmark": 3
  }'
```

### Create a Test Case

```bash
curl -X POST http://localhost:3000/api/generator/testcases \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum entanglement in simple terms",
    "expectedOutput": "A clear, simple explanation",
    "metadata": {
      "difficulty": "medium",
      "category": "physics"
    }
  }'
```

### Generate Test Cases

```bash
curl -X POST http://localhost:3000/api/generator/generate \
  -H "Content-Type: application/json" \
  -d '{
    "parentPromptId": "tc_101",
    "types": ["ambiguity", "contradiction", "negation"],
    "perType": 2
  }'
```

### Create Evaluation Run with Benchmarks

```bash
curl -X POST http://localhost:3000/api/eval/runs \
  -H "Content-Type: application/json" \
  -d '{
    "runName": "GPT-4 AIME Benchmark",
    "description": "Evaluating GPT-4 on AIME problems",
    "modelUnderTest": {
      "name": "gpt-4",
      "version": "latest"
    },
    "judgeModel": {
      "name": "gpt-4"
    },
    "testCaseIds": ["AIME-01", "AIME-02", "AIME-03"],
    "configuration": {
      "temperature": 0.1
    }
  }'
```

### Start Evaluation Run

```bash
curl -X POST http://localhost:3000/api/eval/runs/{evalRunId}/start
```

### Get Benchmark Statistics

```bash
curl http://localhost:3000/api/eval/runs/{evalRunId}/benchmark-stats
```

## 📊 Data Models

### EvalRun
Master schema for evaluation runs with metrics, configuration, and status tracking.

### TestCase
Test prompts with generation metadata, parent-child relationships, and **benchmark-specific fields**:
- `benchmarkType`: AIME, MMLU, or MSUR
- `answer`, `expected_answer`: Expected outputs
- `domain`, `subcategory`, `topic`: Classification
- `difficulty`, `evaluation_type`: Test characteristics

### ModelResponse
Model outputs with performance metrics (response time, tokens used).

### Judgement
Evaluation results with multi-criteria scoring, detailed feedback, and **benchmark evaluation**:
- `benchmarkEvaluation`: Contains validator results, pass/fail, score, confidence, severity
- Combined general judgement + benchmark-specific validation

## 🎯 Benchmark Validators

### AIME Validator
- **Type**: Rule-based
- **Method**: Exact numeric match
- **Speed**: Fast (synchronous)
- **Use**: Mathematical problems with numeric answers

### MMLU Validator
- **Type**: LLM-judged
- **Method**: Conceptual correctness with confidence scoring
- **Speed**: 2-5 seconds per test
- **Use**: Multi-domain knowledge questions

### MSUR Validator
- **Type**: LLM-judged
- **Method**: Rubric-based grading (0.0, 0.5, 1.0)
- **Speed**: 2-5 seconds per test
- **Use**: Mathematical proof writing and construction

## 🧪 Test Case Generation Types

- **Original**: Base prompt from user
- **Ambiguity**: Vague or underspecified prompts
- **Contradiction**: Conflicting or impossible requirements
- **Negation**: Prompts with negative constraints

## 🎯 Evaluation Criteria

Each response is evaluated on:
- **Accuracy** (0-10): Factual correctness
- **Relevance** (0-10): Alignment with prompt
- **Coherence** (0-10): Logical structure
- **Completeness** (0-10): Thorough coverage

**Plus Benchmark Validation**:
- Pass/Fail based on benchmark-specific validator
- Normalized score (0-1 scale)
- Confidence level (for LLM-judged benchmarks)

**Passing Score**: 6.0/10 (configurable)

## 📈 Performance Insights

### Overall Verdicts (Comprehensive Test)
- **EXCEPTIONAL**: 90%+ accuracy, 8.5+ avg score
- **EXCELLENT**: 80%+ accuracy, 8.0+ avg score
- **GOOD**: 70%+ accuracy, 7.0+ avg score
- **SATISFACTORY**: 60%+ accuracy, 6.0+ avg score
- **NEEDS IMPROVEMENT**: 50%+ accuracy
- **POOR**: Below 50% accuracy

### Recommendations (Single Test)
- **EXCELLENT**: Passed benchmark + quality ✅✅
- **GOOD**: Passed benchmark, failed quality ✅❌
- **POOR**: Failed benchmark, passed quality ❌✅
- **FAILED**: Failed both ❌❌

## 🛠️ Development

```bash
# Start in development mode
npm run dev

# Load benchmark data
node tools/benchmarkLoader.js

# Test benchmark integration
node tools/testBenchmarkIntegration.js

# Run tests
npm test

# Lint code
npm run lint
```

## 📖 Additional Documentation

- **[BENCHMARK_GUIDE.md](BENCHMARK_GUIDE.md)** - Complete benchmark testing guide
- **[docs/COMPREHENSIVE_TEST_ENDPOINT.md](docs/COMPREHENSIVE_TEST_ENDPOINT.md)** - Comprehensive test endpoint documentation
- **[docs/QUICK_TEST_ENDPOINT.md](docs/QUICK_TEST_ENDPOINT.md)** - Quick benchmark test endpoint guide
- **[CHANGES_SUMMARY.md](CHANGES_SUMMARY.md)** - Summary of benchmark integration changes

## 📦 Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **openai**: LLM API client (compatible with Ollama)
- **dotenv**: Environment configuration

## 🔑 Key Features Comparison

| Feature | Quick Test | Comprehensive Test | Full Eval Run |
|---------|-----------|-------------------|---------------|
| Scope | 1 test case | Generated + Benchmarks | Custom suite |
| Execution | ~2-5s | ~30-65s | Variable |
| Test Generation | ❌ | ✅ | ❌ |
| All Benchmarks | ❌ | ✅ | Optional |
| Detailed Analysis | ✅ | ✅ | ✅ |
| Use Case | Spot check | Complete eval | Production runs |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT

## 👤 Author

Prateek Ranganath

## 🙏 Acknowledgments

Built for comprehensive LLM evaluation and testing workflows.

---

## 📋 README Update History

### Latest Updates (January 2026)

The README has been comprehensively updated with all benchmark and comprehensive testing features.

#### New Sections Added

**1. Enhanced Features Section**
- Added "Core Capabilities" subsection
- Added "Benchmark Support" subsection with AIME, MMLU, MSUR descriptions
- Highlighted comprehensive model testing capability

**2. Updated Architecture**
- Added validators/ directory structure
- Added benchmarks/ directory with data locations
- Added tools/ directory with utility scripts
- Noted enhanced models (testcase.js, judgement.js)
- Updated services descriptions with benchmark routing

**3. Enhanced Getting Started**
- Added step to load benchmark data: `node tools/benchmarkLoader.js`
- Updated project name from EVAL to TESTSPARK

**4. Updated Environment Variables**
- Changed JUDGE_MODEL recommendation to gpt-4 for benchmark validation

**5. New Quick Testing Endpoints Section**
- `/test-benchmark` - Single benchmark test with detailed validation
- `/comprehensive-test` - Complete evaluation with generated tests + all benchmarks

**6. Enhanced API Routes**
- `/runs/:evalRunId/benchmark-stats` endpoint
- `/test-benchmark` endpoint
- `/comprehensive-test` endpoint
- Enhanced descriptions with benchmark mentions

**7. Expanded Usage Examples**
- Quick benchmark test
- Comprehensive test with all features
- Creating eval runs with benchmarks
- Getting benchmark statistics

**8. Enhanced Data Models Section**
- Added benchmark-specific fields to TestCase model
- Added benchmarkEvaluation to Judgement model
- Detailed explanation of new fields

**9. New Benchmark Validators Section**
- AIME Validator (rule-based, fast)
- MMLU Validator (LLM-judged, with confidence)
- MSUR Validator (rubric-based grading)

**10. Updated Test Generation Types**
- Added "Original" type for base prompt

**11. Enhanced Evaluation Criteria**
- Added benchmark validation section
- Added pass/fail, score, confidence metrics

**12. New Performance Insights Section**
- Overall verdicts for comprehensive tests (EXCEPTIONAL to POOR)
- Recommendations for single tests (EXCELLENT to FAILED)

**13. Enhanced Development Section**
- Added benchmark loader command
- Added integration test command
- Added tools/ scripts

**14. New Additional Documentation Section**
- Links to BENCHMARK_GUIDE.md
- Links to COMPREHENSIVE_TEST_ENDPOINT.md
- Links to QUICK_TEST_ENDPOINT.md
- Links to CHANGES_SUMMARY.md

**15. New Key Features Comparison Table**
- Comparison of Quick Test vs Comprehensive Test vs Full Eval Run

#### Summary of Key Features Added

✅ **Benchmark System Overview**
- Three benchmarks (AIME, MMLU, MSUR) with distinct validation methods
- Rule-based vs LLM-judged approaches
- Performance characteristics (speed, accuracy)

✅ **New Endpoints**
- `/test-benchmark` for quick single-test validation
- `/comprehensive-test` for complete model evaluation
- `/benchmark-stats` for detailed analytics

✅ **Enhanced Data Models**
- TestCase with benchmark metadata fields
- Judgement with benchmarkEvaluation subdocument
- Clear distinction between general and benchmark evaluation

✅ **Validator System**
- Three specialized validators with clear purposes
- Performance expectations (synchronous vs async)
- Scoring methodologies

✅ **Tools & Utilities**
- benchmarkLoader.js for data import
- testBenchmarkIntegration.js for testing
- Clear usage instructions

✅ **Comprehensive Testing Flow**
- Generate variants (ambiguity, contradiction, negation)
- Test all benchmarks
- Analyze performance with insights
- Get recommendations and identify strengths/weaknesses

✅ **Quick Reference**
- Feature comparison table
- Use case guidance
- Performance considerations
- Documentation links

#### What Users Can Now Understand

1. **What benchmarks are supported** and how they work
2. **How to test models** using quick single tests or comprehensive evaluation
3. **What validators do** and how they differ
4. **How data models have evolved** to support benchmarks
5. **Where to find detailed documentation** for each feature
6. **How to load benchmark data** and test the system
7. **Performance expectations** for different testing approaches
8. **When to use each endpoint** based on needs

The README now provides a complete, production-ready overview while remaining concise and easy to scan!

---

## 🔌 Universal Model Adapter - Detailed Guide

### Overview
The adapter function allows you to test **any model** from **any API provider** with your evaluation framework. It provides a flexible, standardized interface for model testing.

### Adapter Architecture

Located in `services/llmservice.js`, the adapter handles:
- Multiple input types (array, string, message object)
- Any OpenAI-compatible API client
- Custom parameters and configuration
- Standardized response format

### Message Format Support

The adapter accepts three message formats:

#### 1. Array Format (Standard)
```javascript
{
  messages: [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "Hello!" }
  ]
}
```

#### 2. String Format (Auto-converts to user message)
```javascript
{
  messages: "What is 2+2?"
}
```

#### 3. Single Message Object
```javascript
{
  messages: { role: "user", content: "Explain quantum computing" }
}
```

### Adapter Function Reference

```javascript
async function adapter(client, model, parameters)
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `client` | Object | No | openai | OpenAI-compatible API client |
| `model` | String | No | "llama3.2" | Model name to use |
| `parameters` | Object | Yes | - | Request parameters |

**Parameters Object:**
```javascript
{
  messages: Array|String|Object,  // Required - conversation messages
  temperature: Number,             // Optional - 0.0 to 2.0
  max_tokens: Number,             // Optional - max response length
  top_p: Number,                  // Optional - nucleus sampling
  frequency_penalty: Number,      // Optional - 0.0 to 2.0
  presence_penalty: Number        // Optional - 0.0 to 2.0
}
```

**Response Format:**
```javascript
{
  text: String,        // The model's response content
  usage: {
    prompt_tokens: Number,
    completion_tokens: Number,
    total_tokens: Number
  }
}
```

### Supported API Providers

The adapter works with any OpenAI-compatible API:
- ✅ **Ollama** (default, configured at http://localhost:11434/v1)
- ✅ **OpenAI** (GPT-3.5, GPT-4, etc.)
- ✅ **Together AI** (Mixtral, LLaMA, etc.)
- ✅ **Azure OpenAI** (Enterprise deployments)
- ✅ **Anthropic** (Claude with wrapper)
- ✅ **Any custom provider** with OpenAI-compatible API

### Configuration Examples

#### Default Ollama (Pre-configured)
```javascript
// Already configured - just use model name
POST /api/eval/test-custom-model
{
  "modelName": "llama3.2",
  "testCaseId": "YOUR_TEST_CASE_ID"
}
```

#### Together AI Setup
```javascript
import OpenAI from 'openai';

const togetherClient = new OpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY
});

// Use in adapter
adapter(togetherClient, 'mistralai/Mixtral-8x7B-Instruct-v0.1', {
  messages: 'Hello',
  temperature: 0.7
});
```

#### Azure OpenAI Setup
```javascript
const azureClient = new OpenAI({
  baseURL: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_KEY
  }
});
```

#### OpenAI Setup
```javascript
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

### Usage Examples

#### Example 1: Quick Test with Default Settings
```bash
curl -X POST http://localhost:3000/api/eval/test-custom-model \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "llama3.2",
    "testCaseId": "YOUR_TEST_CASE_ID"
  }'
```

#### Example 2: Test with Custom Parameters
```bash
curl -X POST http://localhost:3000/api/eval/test-custom-model \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gpt-3.5-turbo",
    "testCaseId": "YOUR_TEST_CASE_ID",
    "parameters": {
      "temperature": 0.5,
      "max_tokens": 500,
      "top_p": 0.9
    }
  }'
```

#### Example 3: Full Evaluation with Custom Model
```javascript
// Step 1: Create eval run
const evalRun = await fetch('http://localhost:3000/api/eval/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    runName: 'Custom Model Evaluation',
    modelUnderTest: {
      name: 'my-custom-model',
      version: 'v1.0'
    },
    judgeModel: {
      name: 'gpt-4',
      version: 'latest'
    },
    testCaseIds: ['test1', 'test2', 'test3'],
    configuration: { temperature: 0.7 }
  })
});

// Step 2: Start with custom parameters
await fetch(`http://localhost:3000/api/eval/runs/${evalRun.data._id}/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    parameters: {
      temperature: 0.8,
      max_tokens: 1500,
      top_p: 0.9
    }
  })
});
```

#### Example 4: Compare Multiple Models
```javascript
const models = ['llama3.2', 'mistral', 'phi3'];
const testCaseId = 'YOUR_TEST_CASE_ID';

for (const model of models) {
  const response = await fetch('http://localhost:3000/api/eval/test-custom-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelName: model,
      testCaseId: testCaseId,
      parameters: { temperature: 0.7 }
    })
  });
  
  const result = await response.json();
  console.log(`${model}: Score ${result.data.judgement.score}/10`);
}
```

### Python Integration Example

```python
import requests

def test_custom_model(model_name, test_case_id, parameters=None):
    url = "http://localhost:3000/api/eval/test-custom-model"
    payload = {
        "modelName": model_name,
        "testCaseId": test_case_id,
        "parameters": parameters or {}
    }
    
    response = requests.post(url, json=payload)
    return response.json()

# Usage
result = test_custom_model(
    "llama3.2",
    "test_case_id_here",
    {"temperature": 0.8, "max_tokens": 1000}
)
print(f"Score: {result['data']['judgement']['score']}/10")
print(f"Passed: {result['data']['judgement']['passed']}")
```

### JavaScript/Node.js Integration Example

```javascript
async function testCustomModel(modelName, testCaseId, parameters = {}) {
  const response = await fetch('http://localhost:3000/api/eval/test-custom-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName, testCaseId, parameters })
  });
  
  return await response.json();
}

// Usage
const result = await testCustomModel(
  'llama3.2',
  'test_case_id_here',
  { temperature: 0.8, max_tokens: 1000 }
);

console.log(`Score: ${result.data.judgement.score}/10`);
console.log(`Response: ${result.data.modelResponse.text}`);
```

### Environment Variables

Add to your `.env` file:

```bash
# Default Ollama (already configured)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_API_KEY=ollama

# Optional: Other providers
TOGETHER_API_KEY=your_together_key
ANTHROPIC_API_KEY=your_anthropic_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint
AZURE_OPENAI_KEY=your_azure_key
OPENAI_API_KEY=your_openai_key

# Judge model for evaluations
JUDGE_MODEL=gpt-4
```

### Troubleshooting

#### Error: "Parameters must include messages array"
**Solution:** Ensure you pass a valid messages parameter in one of the supported formats (array, string, or object).

#### Error: "Invalid messages format"
**Solution:** Messages must be either:
- Array: `[{role: "user", content: "text"}]`
- String: `"text"`
- Object: `{role: "user", content: "text"}`

#### Error: "Adapter error: ..."
**Solution:** Check:
- Client is properly configured with correct baseURL and apiKey
- Model name is correct for the provider
- Network connectivity to API endpoint
- API key has proper permissions

#### Empty or null response
**Solution:**
- Verify model name spelling matches provider's model list
- Check if model requires specific parameters
- Ensure sufficient max_tokens
- Review API provider's documentation

### Best Practices

1. **Error Handling**: Always wrap API calls in try-catch blocks
2. **Rate Limiting**: Implement delays between requests for external APIs
3. **Token Limits**: Set appropriate `max_tokens` based on your model
4. **Temperature**: 
   - Use 0.1-0.3 for deterministic tasks (math, code)
   - Use 0.7-1.0 for creative tasks (writing, brainstorming)
5. **Security**: Store API keys in environment variables, never in code
6. **Testing**: Test with quick endpoint before running full evaluations

### What's Included

✅ **Core Implementation**
- Universal adapter function (`services/llmservice.js`)
- Updated evaluation service (`services/evalservice.js`)
- Enhanced controller with testCustomModel (`controllers/eval.controller.js`)
- New route: `POST /api/eval/test-custom-model`

✅ **Features**
- Multiple input format support
- Flexible parameter configuration
- Standardized response format
- Full benchmark validation support
- Backward compatibility maintained

✅ **Benefits**
- Test any OpenAI-compatible model
- Switch between providers seamlessly
- Custom configuration per request
- Easy REST API integration
- Provider agnostic architecture

