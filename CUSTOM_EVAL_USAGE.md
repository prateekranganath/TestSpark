# Custom Dataset Evaluation API

## Overview
The Custom Dataset Evaluation endpoint allows users to test any LLM model (frontier or small HuggingFace models) with their own datasets by pasting JSON data directly. Perfect for hackathon demos!

## Endpoint
```
POST /api/eval/custom-dataset
```

## Request Body

### Required Fields
- `modelName` (string): Name of the model to evaluate
- `dataset` (array): Array of test cases (max 50 for prototype)
  - Each item must have: `input` (string) and `expected` (string)

### Optional Fields
- `provider` (string): Model provider type
  - `"hf-user-model"` - Small HuggingFace model (free, <3B params)
  - `"openai"` - OpenAI models (requires apiConfig)
  - `"anthropic"` - Anthropic models (requires apiConfig)
  - `"together"` - Together AI models (requires apiConfig)
  - Default: `"hf-user-model"`

- `apiConfig` (object): Required for frontier models
  - `apiKey` (string): Your API key
  - `baseURL` (string, optional): Custom base URL

- `evaluationType` (string): How to evaluate outputs
  - `"exact_match"` - Exact match (case-insensitive, trimmed)
  - `"contains"` - Check if expected is contained in output
  - `"llm_judge"` - Use LLM judge for semantic evaluation
  - Default: `"exact_match"`

## Examples

### Example 1: HuggingFace Small Model (Free)
```bash
curl -X POST http://localhost:3000/api/eval/custom-dataset \
  -H "Content-Type: application/json" \
  -d '{
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
      },
      {
        "input": "Who wrote Romeo and Juliet?",
        "expected": "Shakespeare"
      }
    ]
  }'
```

### Example 2: OpenAI GPT-4 (Requires API Key)
```bash
curl -X POST http://localhost:3000/api/eval/custom-dataset \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gpt-4",
    "provider": "openai",
    "apiConfig": {
      "apiKey": "sk-your-openai-api-key-here"
    },
    "evaluationType": "llm_judge",
    "dataset": [
      {
        "input": "Explain quantum computing in simple terms",
        "expected": "Quantum computing uses quantum mechanics principles like superposition and entanglement to perform calculations that would be impossible for classical computers."
      },
      {
        "input": "What are the benefits of renewable energy?",
        "expected": "Renewable energy reduces carbon emissions, provides sustainable power, and decreases dependence on fossil fuels."
      }
    ]
  }'
```

### Example 3: Anthropic Claude with Contains Evaluation
```bash
curl -X POST http://localhost:3000/api/eval/custom-dataset \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "claude-3-sonnet-20240229",
    "provider": "anthropic",
    "apiConfig": {
      "apiKey": "sk-ant-your-anthropic-api-key-here"
    },
    "evaluationType": "contains",
    "dataset": [
      {
        "input": "List three programming languages",
        "expected": "Python"
      },
      {
        "input": "Name a famous scientist",
        "expected": "Einstein"
      }
    ]
  }'
```

## Response Format

### Success Response (200 OK)
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
      "total": 3,
      "passed": 2,
      "failed": 1,
      "accuracy": 66.67,
      "evaluationTimeMs": 1543
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
      },
      {
        "input": "Who wrote Romeo and Juliet?",
        "expected": "Shakespeare",
        "modelOutput": "William Shakespeare",
        "passed": false,
        "reason": "Exact match failed"
      }
    ]
  }
}
```

### Error Response (400 Bad Request)
```json
{
  "success": false,
  "error": "Invalid dataset format: Each item must have 'input' and 'expected' fields",
  "example": {
    "input": "Your question here",
    "expected": "Expected answer here"
  }
}
```

## Evaluation Types Explained

### 1. Exact Match (`exact_match`)
- **Best for:** Math problems, factual answers, specific formats
- **How it works:** Compares outputs after converting to lowercase and trimming whitespace
- **Example:**
  - Expected: `"4"`
  - Passes: `"4"`, `" 4 "`, `"4 "`
  - Fails: `"four"`, `"The answer is 4"`

### 2. Contains (`contains`)
- **Best for:** Flexible answers, keywords, partial matches
- **How it works:** Checks if expected string is contained in model output (case-insensitive)
- **Example:**
  - Expected: `"Paris"`
  - Passes: `"Paris"`, `"The capital is Paris"`, `"paris, france"`
  - Fails: `"France"`, `"French capital"`

### 3. LLM Judge (`llm_judge`)
- **Best for:** Semantic equivalence, complex answers, explanations
- **How it works:** Uses HuggingFace Judge Space to evaluate if answers are semantically equivalent
- **Example:**
  - Expected: `"Shakespeare"`
  - Passes: `"William Shakespeare"`, `"Shakespeare wrote it"`, `"The Bard"`
  - Fails: `"Charles Dickens"`, `"Unknown"`

## Dataset Format Requirements

### Valid Dataset
```json
{
  "dataset": [
    {
      "input": "Question or prompt here",
      "expected": "Expected answer here"
    }
  ]
}
```

### Invalid Datasets (Will Error)

❌ Missing required fields:
```json
{
  "dataset": [
    {
      "question": "What is 2+2?"  // Should be "input", not "question"
    }
  ]
}
```

❌ Wrong data types:
```json
{
  "dataset": [
    {
      "input": 123,  // Should be string, not number
      "expected": "4"
    }
  ]
}
```

❌ Too many examples:
```json
{
  "dataset": [
    // More than 50 items - will be rejected
  ]
}
```

## Tips for Frontend Integration

### 1. Textarea for JSON Input
```javascript
const exampleDataset = {
  modelName: "Qwen/Qwen2.5-0.5B-Instruct",
  provider: "hf-user-model",
  evaluationType: "exact_match",
  dataset: [
    {
      input: "What is 2+2?",
      expected: "4"
    }
  ]
};

// Stringify for textarea
const jsonText = JSON.stringify(exampleDataset, null, 2);
```

### 2. Load Example Buttons
Create pre-populated examples for different use cases:
- Math problems with exact_match
- General knowledge with contains
- Complex reasoning with llm_judge

### 3. Model Selection
```javascript
const modelOptions = {
  "HuggingFace Small Models (Free)": [
    "Qwen/Qwen2.5-0.5B-Instruct",
    "Qwen/Qwen2.5-1.5B-Instruct",
    "microsoft/phi-2"
  ],
  "Frontier Models (API Key Required)": [
    { provider: "openai", model: "gpt-4" },
    { provider: "anthropic", model: "claude-3-sonnet-20240229" },
    { provider: "together", model: "meta-llama/Llama-3-70b-chat-hf" }
  ]
};
```

### 4. Validation Before Sending
```javascript
function validateDataset(data) {
  // Check modelName
  if (!data.modelName || typeof data.modelName !== 'string') {
    return "Model name is required";
  }
  
  // Check dataset
  if (!Array.isArray(data.dataset) || data.dataset.length === 0) {
    return "Dataset must be a non-empty array";
  }
  
  if (data.dataset.length > 50) {
    return "Dataset cannot exceed 50 examples";
  }
  
  // Check each item
  for (let i = 0; i < data.dataset.length; i++) {
    const item = data.dataset[i];
    if (!item.input || typeof item.input !== 'string') {
      return `Item ${i + 1}: 'input' must be a string`;
    }
    if (!item.expected || typeof item.expected !== 'string') {
      return `Item ${i + 1}: 'expected' must be a string`;
    }
  }
  
  // Check apiConfig for frontier models
  if (data.provider !== "hf-user-model" && !data.apiConfig?.apiKey) {
    return "API key required for frontier models";
  }
  
  return null; // Valid
}
```

### 5. Display Results
```javascript
function displayResults(results) {
  const { summary, results: items } = results.data;
  
  // Summary card
  console.log(`Accuracy: ${summary.accuracy}%`);
  console.log(`Passed: ${summary.passed}/${summary.total}`);
  console.log(`Time: ${summary.evaluationTimeMs}ms`);
  
  // Individual results
  items.forEach((item, idx) => {
    console.log(`\n${idx + 1}. ${item.input}`);
    console.log(`Expected: ${item.expected}`);
    console.log(`Got: ${item.modelOutput}`);
    console.log(`Status: ${item.passed ? '✅ PASS' : '❌ FAIL'}`);
    if (item.reason) console.log(`Reason: ${item.reason}`);
  });
}
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `modelName is required` | Missing modelName field | Add `"modelName": "model-name"` |
| `dataset must be a non-empty array` | Dataset is missing or empty | Add array with at least 1 item |
| `dataset cannot exceed 50 examples` | Too many test cases | Reduce to max 50 items |
| `Each item must have 'input' and 'expected' fields` | Wrong field names | Use `input` and `expected`, not `question`/`answer` |
| `API key is required for frontier models` | Missing apiConfig | Add `apiConfig: { apiKey: "..." }` |
| `Invalid provider` | Unknown provider value | Use: `hf-user-model`, `openai`, `anthropic`, or `together` |

## Database Schema

Results are stored in the `customevals` collection:

```javascript
{
  _id: ObjectId,
  modelName: String,
  provider: String,
  evaluationType: String,
  datasetSize: Number,
  results: {
    total: Number,
    passed: Number,
    failed: Number,
    accuracy: Number
  },
  individualResults: [
    {
      input: String,
      expected: String,
      modelOutput: String,
      passed: Boolean,
      reason: String
    }
  ],
  metadata: {
    evaluationTimeMs: Number
  },
  status: String, // 'completed' or 'failed'
  createdAt: Date,
  updatedAt: Date
}
```

## Next Steps

1. **Deploy HuggingFace Spaces** (see HF_USER_MODEL_SPACE.md):
   - Judge Space with math/msur adapters
   - User Model Space for dynamic loading

2. **Set Environment Variables**:
   ```bash
   HF_JUDGE_SPACE_ENDPOINT=https://your-judge-space.hf.space
   HF_USER_MODEL_SPACE_ENDPOINT=https://your-user-model-space.hf.space
   HF_SPACE_TOKEN=your_huggingface_token  # Optional
   ```

3. **Test the Endpoint**:
   - Start with small HF model (no API key needed)
   - Try all 3 evaluation types
   - Test error cases (missing fields, wrong format)

4. **Build Frontend** (Vercel):
   - JSON textarea with syntax highlighting
   - Model selector with API key input
   - Evaluation type dropdown
   - Results display with pass/fail indicators
   - "Load Example" buttons

5. **Demo Preparation**:
   - Prepare 3-5 example datasets
   - Test with both free and paid models
   - Have API keys ready for demo
   - Show error handling capabilities

## Support

For issues or questions:
1. Check error message and example in response
2. Validate JSON format with online validator
3. Ensure HuggingFace Spaces are deployed and URLs are correct
4. Check environment variables are set
5. Verify MongoDB connection

---

**Happy Testing! 🚀**
