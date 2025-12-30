# LLM Evaluation API

A comprehensive Node.js backend for evaluating Large Language Models (LLMs) using automated test case generation and AI-powered judging.

## 🎯 Features

- **Automated Test Case Generation**: Generate test cases with ambiguity, contradiction, and negation patterns
- **Evaluation Runs**: Execute batch evaluations across multiple test cases
- **AI-Powered Judging**: Automated response evaluation using judge models
- **Multi-Criteria Scoring**: Evaluate responses on accuracy, relevance, coherence, and completeness
- **Comprehensive Analytics**: Track metrics, pass rates, and performance statistics
- **RESTful API**: Clean, organized endpoints for all operations

## 🏗️ Architecture

```
EVAL/
├── controllers/        # Request handlers and validation
│   ├── eval.controller.js
│   ├── generator.controller.js
│   └── judge.controller.js
├── services/          # Business logic layer
│   ├── evalservice.js
│   ├── generatorservice.js
│   ├── judgeservice.js
│   └── llmservice.js
├── models/            # MongoDB schemas
│   ├── evalrun.js
│   ├── testcase.js
│   ├── modelresponse.js
│   └── judgement.js
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
- Ollama (for local LLM inference)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd EVAL
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

4. Start the server:
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
JUDGE_MODEL=llama2:7b-chat
DEFAULT_TEMPERATURE=0.7
PASSING_SCORE=6.0
```

## 📚 API Documentation

### Evaluation Routes (`/api/eval`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/runs` | Create new evaluation run |
| GET | `/runs` | Get all evaluation runs |
| GET | `/runs/:evalRunId` | Get evaluation run status |
| GET | `/runs/:evalRunId/results` | Get full evaluation results |
| POST | `/runs/:evalRunId/start` | Start evaluation run |
| POST | `/evaluate` | Run single evaluation |
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

### Create Evaluation Run

```bash
curl -X POST http://localhost:3000/api/eval/runs \
  -H "Content-Type: application/json" \
  -d '{
    "runName": "GPT-4 Physics Test",
    "description": "Evaluating GPT-4 on physics questions",
    "modelUnderTest": {
      "name": "gpt-4",
      "version": "latest"
    },
    "judgeModel": {
      "name": "llama2:7b-chat"
    },
    "testCaseIds": ["tc_101", "tc_102", "tc_103"],
    "configuration": {
      "temperature": 0.7,
      "maxTokens": 1000
    }
  }'
```

### Start Evaluation Run

```bash
curl -X POST http://localhost:3000/api/eval/runs/{evalRunId}/start
```

### Get Results

```bash
curl http://localhost:3000/api/eval/runs/{evalRunId}/results
```

## 📊 Data Models

### EvalRun
Master schema for evaluation runs with metrics, configuration, and status tracking.

### TestCase
Test prompts with generation metadata and parent-child relationships.

### ModelResponse
Model outputs with performance metrics (response time, tokens used).

### Judgement
Evaluation results with multi-criteria scoring and detailed feedback.

## 🧪 Test Case Generation Types

- **Ambiguity**: Vague or underspecified prompts
- **Contradiction**: Conflicting or impossible requirements
- **Negation**: Prompts with negative constraints

## 🎯 Evaluation Criteria

Each response is evaluated on:
- **Accuracy** (0-10): Factual correctness
- **Relevance** (0-10): Alignment with prompt
- **Coherence** (0-10): Logical structure
- **Completeness** (0-10): Thorough coverage

**Passing Score**: 6.0/10 (configurable)

## 🛠️ Development

```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## 📦 Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **openai**: LLM API client (compatible with Ollama)
- **dotenv**: Environment configuration

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
