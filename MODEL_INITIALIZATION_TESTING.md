# Model Initialization Flow - Testing Guide

## Overview
New session-based model management system that allows users to configure a model once and use it across multiple evaluations.

## Architecture Changes

### New Services
1. **services/sessionservice.js** - In-memory session storage for model configurations
2. **services/hfspaceservice.js** - HuggingFace Space warmup and status checking

### New Controllers & Routes
3. **controllers/model.controller.js** - Model initialization logic
4. **routes/model.routes.js** - Model API endpoints

### Updated Files
5. **index.js** - Added express-session middleware and model routes
6. **controllers/eval.controller.js** - Updated to use session models as default
7. **package.json** - Added express-session dependency

## New API Endpoints

### POST /api/model/initialize
Initialize a model for the user session.

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

**Response (HuggingFace):**
```json
{
  "success": true,
  "message": "Model initialization started",
  "status": "loading",
  "sessionId": "session_1234567890",
  "estimatedTime": "2-5 minutes for first load",
  "note": "Poll /api/model/status to check when model is ready"
}
```

**Response (OpenAI/Anthropic):**
```json
{
  "success": true,
  "message": "Model initialized successfully",
  "status": "ready",
  "sessionId": "session_1234567890",
  "modelProvider": "openai",
  "modelName": "gpt-4"
}
```

### GET /api/model/status
Check the status of the initialized model.

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

### DELETE /api/model/clear
Clear the model configuration from the session.

**Response:**
```json
{
  "success": true,
  "message": "Model configuration cleared from session"
}
```

## Updated Eval Endpoints

Both `/api/eval/custom` and `/api/eval/benchmark` now support session-based models:

### Behavior Changes:
1. **No model in request** → Uses session model (if initialized and ready)
2. **Model in request** → Overrides session model
3. **No model in request + No session model** → Returns error with hint
4. **Session model not ready** → Returns error asking to wait/poll status

### Example: Using Session Model
```bash
# Step 1: Initialize model
curl -X POST http://localhost:3000/api/model/initialize \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{
    "modelProvider": "huggingface",
    "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    "baseUrl": "https://neollm007-user-model-space.hf.space"
  }'

# Step 2: Poll status until ready
curl -X GET http://localhost:3000/api/model/status \
  -b cookies.txt -c cookies.txt

# Step 3: Run evaluation WITHOUT specifying model
curl -X POST http://localhost:3000/api/eval/custom \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{
    "dataset": [
      {"input": "What is 2+2?", "expected": "4"},
      {"input": "Capital of France?", "expected": "Paris"}
    ],
    "evaluationType": "exact_match"
  }'

# Uses the stored session model automatically!
```

## Testing Plan

### Test Case 1: HuggingFace Model Initialization
**Objective:** Test full HF model initialization flow

**Steps:**
1. Initialize HF model via POST /api/model/initialize
2. Verify response has `status: "loading"`
3. Poll GET /api/model/status every 10 seconds
4. Wait for `status: "ready"` (2-5 minutes)
5. Run custom eval without model params
6. Verify eval uses session model successfully

**Expected Results:**
- Initialization returns immediately with "loading"
- Status changes from "loading" to "ready" after warmup
- Eval works without providing model details
- Server logs show "Using session model" messages

### Test Case 2: Frontier Model Initialization (OpenAI)
**Objective:** Test instant-ready frontier models

**Steps:**
1. Initialize OpenAI model via POST /api/model/initialize
2. Verify response has `status: "ready"` immediately
3. Run custom eval without model params
4. Verify successful evaluation

**Expected Results:**
- Initialization returns immediately with "ready"
- No polling needed
- Eval works instantly with session model

### Test Case 3: Model Override
**Objective:** Verify request params override session model

**Steps:**
1. Initialize TinyLlama via POST /api/model/initialize
2. Wait until ready
3. Run custom eval WITH different model in request body
4. Verify eval uses the request model, not session model

**Expected Results:**
- Server logs show using request model, not session
- Evaluation completes with specified model

### Test Case 4: No Model Error
**Objective:** Test error handling when no model available

**Steps:**
1. Do NOT initialize any model
2. Run custom eval without model params
3. Verify error response with helpful hint

**Expected Results:**
- 400 error with message about initializing model first
- Response includes hint to use POST /api/model/initialize

### Test Case 5: Model Not Ready Error
**Objective:** Test error when using model before warmup completes

**Steps:**
1. Initialize HF model
2. Immediately run custom eval (before ready)
3. Verify error about model still loading

**Expected Results:**
- 400 error with "Model is not ready yet"
- Response includes tip to poll /api/model/status

### Test Case 6: Session Persistence
**Objective:** Verify model persists across multiple requests

**Steps:**
1. Initialize HF model and wait until ready
2. Run custom eval #1 without model params
3. Run custom eval #2 without model params
4. Run custom eval #3 without model params
5. Verify all three use same session model

**Expected Results:**
- All evaluations succeed
- Server logs show session model reuse
- No need to reload model between requests

### Test Case 7: Clear Model
**Objective:** Test clearing session model

**Steps:**
1. Initialize model
2. Run eval successfully
3. DELETE /api/model/clear
4. Try to run eval without model params
5. Verify error about no model

**Expected Results:**
- Clear operation succeeds
- Subsequent eval fails with "no model" error
- Must reinitialize to continue

### Test Case 8: Benchmark Endpoint with Session
**Objective:** Test session model on benchmark endpoint

**Steps:**
1. Initialize model
2. Wait until ready
3. Run POST /api/eval/benchmark without model params
4. Verify benchmark eval uses session model

**Expected Results:**
- Benchmark eval works with session model
- Results saved correctly to database

## Manual Testing with cURL

### Full HuggingFace Flow
```bash
# Create cookies file for session persistence
touch cookies.txt

# Step 1: Initialize
curl -X POST http://localhost:3000/api/model/initialize \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{
    "modelProvider": "huggingface",
    "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    "baseUrl": "https://neollm007-user-model-space.hf.space"
  }'

# Expected: {"success": true, "status": "loading", ...}

# Step 2: Check status (repeat until ready)
curl -X GET http://localhost:3000/api/model/status \
  -b cookies.txt -c cookies.txt

# Expected (initially): {"success": true, "status": "loading", ...}
# Expected (after 2-5 min): {"success": true, "status": "ready", ...}

# Step 3: Run evaluation without model
curl -X POST http://localhost:3000/api/eval/custom \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{
    "dataset": [
      {"input": "What is 2+2?", "expected": "4"}
    ],
    "evaluationType": "contains"
  }'

# Expected: Successful evaluation using session model

# Step 4: Clear model
curl -X DELETE http://localhost:3000/api/model/clear \
  -b cookies.txt -c cookies.txt

# Expected: {"success": true, "message": "Model configuration cleared from session"}
```

### OpenAI Flow (Instant Ready)
```bash
curl -X POST http://localhost:3000/api/model/initialize \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{
    "modelProvider": "openai",
    "modelName": "gpt-4",
    "apiKey": "your-openai-key"
  }'

# Expected: {"success": true, "status": "ready", ...}
# Instantly ready, no polling needed!
```

## Browser Testing (Frontend)

### Using Fetch API
```javascript
// Initialize model
const initResponse = await fetch('http://localhost:3000/api/model/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    modelProvider: 'huggingface',
    modelName: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
    baseUrl: 'https://neollm007-user-model-space.hf.space'
  })
});

const initData = await initResponse.json();
console.log('Init:', initData);

// Poll status
async function pollStatus() {
  const statusResponse = await fetch('http://localhost:3000/api/model/status', {
    credentials: 'include'
  });
  
  const statusData = await statusResponse.json();
  console.log('Status:', statusData);
  
  if (statusData.status === 'loading') {
    setTimeout(pollStatus, 10000); // Poll every 10 seconds
  } else if (statusData.status === 'ready') {
    console.log('✅ Model ready!');
    runEvaluation();
  }
}

pollStatus();

// Run evaluation (no model needed)
async function runEvaluation() {
  const evalResponse = await fetch('http://localhost:3000/api/eval/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      dataset: [
        { input: "What is 2+2?", expected: "4" },
        { input: "What is the capital of France?", expected: "Paris" }
      ],
      evaluationType: 'contains'
    })
  });
  
  const evalData = await evalResponse.json();
  console.log('Evaluation:', evalData);
}
```

## Environment Variables

Add to `.env`:
```bash
# Session secret for express-session
SESSION_SECRET=your-super-secret-key-change-this-in-production

# HuggingFace Space endpoints
HF_USER_MODEL_SPACE_ENDPOINT=https://neollm007-user-model-space.hf.space
HF_SPACE_TOKEN=optional-hf-token-for-private-spaces
```

## Deployment Checklist

- [x] Install express-session: `npm install express-session`
- [x] Add SESSION_SECRET to Render environment variables
- [x] Commit and push all changes to GitHub
- [ ] Wait for Render auto-deploy (~2-3 minutes)
- [ ] Test production endpoints with cookies
- [ ] Update frontend to use new flow

## Production Considerations

### Session Storage
Current implementation uses in-memory Map, which means:
- ✅ Fast access
- ✅ Simple implementation
- ❌ Sessions lost on server restart
- ❌ Won't work with multiple server instances (horizontal scaling)

**For production, consider:**
- MongoDB session store (connect-mongo)
- Redis session store (connect-redis)
- Database-backed sessions

### Session Cleanup
- Auto-cleanup runs every hour
- Removes sessions older than 24 hours
- No manual cleanup needed

### Security
- Sessions are HTTP-only cookies
- HTTPS required in production (secure flag)
- Change SESSION_SECRET before deployment
- Never expose SESSION_SECRET in logs

## Troubleshooting

### Issue: "No session ID found"
**Cause:** Cookies not being sent with requests  
**Fix:** Use `credentials: 'include'` in fetch or `-b/-c cookies.txt` in cURL

### Issue: Status never changes from "loading"
**Cause:** HF Space cold start or model too large  
**Fix:** Wait up to 5 minutes for first load. Check HF Space logs for errors.

### Issue: "Session model is not ready yet"
**Cause:** Trying to use model before warmup completes  
**Fix:** Continue polling /api/model/status until `status: "ready"`

### Issue: Eval doesn't use session model
**Cause:** Cookies not persisting or wrong session  
**Fix:** Verify cookie file exists (cURL) or credentials included (browser)

### Issue: Sessions disappearing
**Cause:** Server restart clears in-memory sessions  
**Fix:** Reinitialize model after server restart, or use persistent storage (Redis/MongoDB)

## Success Metrics

Implementation is successful when:
1. ✅ User can initialize HF model once
2. ✅ User can poll status endpoint until ready
3. ✅ User can run multiple evals without re-specifying model
4. ✅ Server logs show "Using session model" messages
5. ✅ No errors in eval.controller with session fallback
6. ✅ Frontier models (OpenAI) work instantly
7. ✅ Model override still works when specified in request
8. ✅ Clear endpoint removes session model correctly

## Next Steps

1. Test locally with cURL (Test Cases 1-8)
2. Verify no errors in backend logs
3. Commit and push to GitHub
4. Wait for Render deployment
5. Test production endpoints
6. Update frontend to use new flow
7. Consider implementing persistent session storage
8. Add session analytics/monitoring
