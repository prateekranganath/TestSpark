# LLM Evaluation Engine

A comprehensive Node.js backend for evaluating Large Language Models (LLMs) using automated test case generation, benchmark testing, and AI-powered judging.

## 🎯 Features

### Core Capabilities
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
│   └── llmservice.js          # LLM API interface
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
