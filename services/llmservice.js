import OpenAI from "openai";

// Default Ollama client for local development (optional in production)
const defaultOllamaClient = process.env.NODE_ENV === 'development' 
    ? new OpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' })
    : null;

/**
 * Create API client from configuration
 * @param {Object} apiConfig - API configuration { baseURL, apiKey }
 * @returns {Object} - OpenAI-compatible client
 */
function createClientFromConfig(apiConfig) {
    if (!apiConfig || !apiConfig.baseURL || !apiConfig.apiKey) {
        throw new Error("apiConfig must include baseURL and apiKey");
    }
    
    return new OpenAI({
        baseURL: apiConfig.baseURL,
        apiKey: apiConfig.apiKey
    });
}

function fetchWithTimeout(url, options, timeout = 60000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    return fetch(url, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(id));
}

/**
 * Infer using HuggingFace Space for judge models with adapter support
 * @param {String} modelName - HuggingFace model ID (optional for Space)
 * @param {Object} messages - Conversation messages
 * @param {Object} parameters - Generation parameters including adapter
 * @returns {Object} - Standardized response { text, usage }
 */
async function inferJudgeSpace(modelName, messages, parameters) {
    try {
        const hfSpaceEndpoint = process.env.HF_JUDGE_SPACE_ENDPOINT;
        const hfSpaceToken = process.env.HF_SPACE_TOKEN; // Optional for private spaces
        
        if (!hfSpaceEndpoint) {
            throw new Error("HF_JUDGE_SPACE_ENDPOINT environment variable not set");
        }

        // Format prompt from messages
        let prompt = messages.map(m => {
            if (m.role === 'system') return `System: ${m.content}`;
            if (m.role === 'user') return `User: ${m.content}`;
            if (m.role === 'assistant') return `Assistant: ${m.content}`;
            return m.content;
        }).join('\n');

        // Determine which adapter to use
        const adapter = parameters.adapter || 'base';

        // Make request to HF Space endpoint
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (hfSpaceToken) {
            headers['Authorization'] = `Bearer ${hfSpaceToken}`;
        }

        // Call the FastAPI /infer endpoint
        const response = await fetchWithTimeout(`${hfSpaceEndpoint}/infer`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                prompt: prompt,
                adapter: adapter,
                temperature: parameters.temperature || 0.3,
                max_tokens: parameters.max_tokens || 512,
                top_p: parameters.top_p || 1.0
            })
        }, 60000);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HF Judge Space API error: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        
        // FastAPI returns the response directly
        return {
            text: result.text,
            usage: {
                prompt_tokens: result.usage?.prompt_tokens || 0,
                completion_tokens: result.usage?.completion_tokens || 0,
                total_tokens: result.usage?.total_tokens || 0
            }
        };
    } catch (error) {
        throw new Error(`HF Judge Space inference error: ${error.message}`);
    }
}

/**
 * Infer using HuggingFace Space for user models (small OSS models <3B)
 * Dynamically loads the model on-demand
 * @param {String} modelName - HuggingFace model ID (e.g., "microsoft/phi-2")
 * @param {Object} messages - Conversation messages
 * @param {Object} parameters - Generation parameters
 * @returns {Object} - Standardized response { text, usage }
 */
async function inferUserModelSpace(modelName, messages, parameters) {
    try {
        // Prefer session-provided endpoint (apiConfig.baseURL), fall back to env var
        const userModelSpaceEndpoint =
            parameters?.apiConfig?.baseURL || process.env.HF_USER_MODEL_SPACE_ENDPOINT;
        const hfSpaceToken = process.env.HF_SPACE_TOKEN; // Optional for private spaces

        if (!userModelSpaceEndpoint) {
            throw new Error("HF_USER_MODEL_SPACE_ENDPOINT not configured. User must provide apiConfig for their own inference endpoint.");
        }

        if (!modelName) {
            throw new Error("Model name is required for HuggingFace Space inference");
        }

        // Build prompt — prepend a system instruction if none is present so
        // small chat-tuned models (e.g. TinyLlama-Chat) always return output.
        const hasSystem = messages.some(m => m.role === 'system');
        const systemPrefix = hasSystem
            ? ''
            : 'System: You are a helpful assistant. Answer the question directly and concisely.\n';

        const prompt = systemPrefix + messages.map(m => {
            if (m.role === 'system')    return `System: ${m.content}`;
            if (m.role === 'user')      return `User: ${m.content}`;
            if (m.role === 'assistant') return `Assistant: ${m.content}`;
            return m.content;
        }).join('\n');

        // Make request to HF Space endpoint
        const headers = { 'Content-Type': 'application/json' };
        if (hfSpaceToken) {
            headers['Authorization'] = `Bearer ${hfSpaceToken}`;
        }

        console.log(`Loading user model: ${modelName} from HF Space: ${userModelSpaceEndpoint}`);

        // Step 1: Load the model (Space skips reload if already loaded)
        const loadResponse = await fetchWithTimeout(`${userModelSpaceEndpoint}/load`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: modelName,
                adapter: parameters.adapter || null
            })
        }, 60000);

        if (!loadResponse.ok) {
            const errorText = await loadResponse.text();
            throw new Error(`HF User Model Space load error: ${loadResponse.statusText} - ${errorText}`);
        }

        const loadResult = await loadResponse.json();
        if (loadResult.error) {
            throw new Error(`Model load failed: ${loadResult.error}`);
        }
        console.log(`Model loaded: ${loadResult.status} - ${loadResult.model}${loadResult.adapter ? ' with adapter ' + loadResult.adapter : ''}`);

        // Step 2: Run inference — retry once if the first response is empty
        const inferBody = JSON.stringify({
            prompt,
            temperature: parameters.temperature || 0.7,
            max_tokens: parameters.max_tokens || 256,
            top_p: parameters.top_p || 1.0
        });

        const runInfer = async () => {
            const r = await fetchWithTimeout(`${userModelSpaceEndpoint}/infer`, {
                method: 'POST',
                headers,
                body: inferBody
            }, 60000);
            if (!r.ok) {
                const errText = await r.text();
                throw new Error(`HF User Model Space infer error: ${r.statusText} - ${errText}`);
            }
            return r.json();
        };

        let inferResult = await runInfer();
        if (inferResult.error) {
            throw new Error(`Inference failed: ${inferResult.error}`);
        }

        // Retry once on empty response (can happen on cold paths)
        if (!inferResult.text || inferResult.text.trim() === '') {
            console.warn(`⚠️  Empty response from HF Space for model ${modelName}, retrying in 3s...`);
            await new Promise(r => setTimeout(r, 3000));
            inferResult = await runInfer();
            if (inferResult.error) {
                throw new Error(`Inference failed on retry: ${inferResult.error}`);
            }
        }

        return {
            text: inferResult.text,
            usage: {
                prompt_tokens: inferResult.usage?.prompt_tokens || 0,
                completion_tokens: inferResult.usage?.completion_tokens || 0,
                total_tokens: (inferResult.usage?.prompt_tokens || 0) + (inferResult.usage?.completion_tokens || 0)
            }
        };
    } catch (error) {
        throw new Error(`HF User Model Space inference error: ${error.message}`);
    }
}

/**
 * Universal adapter function to call any model via any client API
 * @param {Object} client - The API client (optional if apiConfig provided)
 * @param {String} model - The model name
 * @param {Object} parameters - Parameters including messages, temperature, apiConfig, provider
 * @returns {Object} - Standardized response with text and usage
 */
async function adapter(client, model, parameters) {
    try {
        // Validate parameters
        if (!parameters || !parameters.messages) {
            throw new Error("Parameters must include messages array");
        }

        // Handle different input types for messages
        let messages;
        if (Array.isArray(parameters.messages)) {
            messages = parameters.messages;
        } else if (typeof parameters.messages === 'string') {
            messages = [{ role: "user", content: parameters.messages }];
        } else if (typeof parameters.messages === 'object' && parameters.messages.role && parameters.messages.content) {
            messages = [parameters.messages];
        } else {
            throw new Error("Invalid messages format. Expected array, string, or message object");
        }

        // Extract provider and apiConfig
        const provider = parameters.provider;
        const apiConfig = parameters.apiConfig;

        // Handle HuggingFace Space with adapters (for judge models)
        if (provider === 'hf-space' || provider === 'huggingface-space') {
            return await inferJudgeSpace(model, messages, parameters);
        }

        // Handle small open-source models via user model Space (no apiConfig provided)
        // User just provides model name, we load it on HF Space
        if (provider === 'hf-user-model' || (provider === 'huggingface' && !apiConfig)) {
            return await inferUserModelSpace(model, messages, parameters);
        }

        // Create client from apiConfig if provided (for frontier models with user's API key)
        if (apiConfig && !client) {
            client = createClientFromConfig(apiConfig);
        }

        // Fallback to default client (dev only)
        if (!client) {
            if (defaultOllamaClient) {
                client = defaultOllamaClient;
                model = model || "llama3.2";
            } else {
                throw new Error("No API client available. Provide apiConfig or configure HF_SPACE_ENDPOINT");
            }
        }

        if (!model) {
            throw new Error("Model name is required");
        }

        // Extract additional parameters
        const temperature = parameters.temperature || 0.7;
        const max_tokens = parameters.max_tokens;
        const top_p = parameters.top_p;
        const frequency_penalty = parameters.frequency_penalty;
        const presence_penalty = parameters.presence_penalty;

        // Build request options
        const requestOptions = {
            model: model,
            messages: messages,
            temperature: temperature
        };

        // Add optional parameters if provided
        if (max_tokens !== undefined) requestOptions.max_tokens = max_tokens;
        if (top_p !== undefined) requestOptions.top_p = top_p;
        if (frequency_penalty !== undefined) requestOptions.frequency_penalty = frequency_penalty;
        if (presence_penalty !== undefined) requestOptions.presence_penalty = presence_penalty;

        // Make the API call
        const response = await client.chat.completions.create(requestOptions);
        
        // Return standardized response for evaluation
        return {
            text: response.choices[0].message.content,
            usage: response.usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
            }
        };
    } catch (error) {
        throw new Error(`Adapter error: ${error.message}`);
    }
}

/**
 * LLM call function - uses adapter with flexible client/API configuration
 * @param {Object} params - Parameters including messages, model, temperature, apiConfig, provider
 * @returns {Object} - Response with text and usage
 */
async function llm_call({ messages, model, temperature = 0.7, client, apiConfig, provider, ...additionalParams }) {
    try {
        return await adapter(
            client,
            model,
            { 
                messages, 
                temperature,
                apiConfig,
                provider,
                ...additionalParams 
            }
        );
    } catch (error) {
        throw new Error(`Error in llm_call: ${error.message}`);
    }
}

/**
 * Get appropriate adapter name based on benchmark type or task
 * @param {String} benchmarkType - Type of benchmark (aime, mmlu, msur) or task
 * @returns {String} - Adapter name to use
 */
function getAdapterForBenchmark(benchmarkType) {
    if (!benchmarkType) return 'base';
    
    const type = benchmarkType.toLowerCase();
    
    // Adapter mapping
    const adapterMap = {
        'aime': 'math',
        'math': 'math',
        'msur': 'msur',
        'mmlu': 'base',  // Use base model for MMLU
        'general': 'base',
        'custom': 'base'
    };
    
    return adapterMap[type] || 'base';
}

/**
 * Generate test cases using Judge Space generation endpoint
 * Generates all 3 patterns (ambiguity, contradiction, negation) in one call
 * @param {String} parentPrompt - Original prompt to generate test cases from
 * @param {Object} parameters - Generation parameters
 * @returns {Object} - Generated prompts { ambiguity, contradiction, negation }
 */
async function generateTestCasesFromJudgeSpace(parentPrompt, parameters = {}) {
    try {
        const judgeSpaceEndpoint = process.env.HF_JUDGE_SPACE_ENDPOINT;
        const hfSpaceToken = process.env.HF_SPACE_TOKEN;
        
        if (!judgeSpaceEndpoint) {
            throw new Error("HF_JUDGE_SPACE_ENDPOINT not configured. Cannot use Judge Space for generation.");
        }

        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (hfSpaceToken) {
            headers['Authorization'] = `Bearer ${hfSpaceToken}`;
        }

        // Call the FastAPI /generate endpoint
        const response = await fetchWithTimeout(`${judgeSpaceEndpoint}/generate`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                parent_prompt: parentPrompt,
                temperature: parameters.temperature || 0.8,
                max_tokens: parameters.max_tokens || 200
            })
        }, 60000);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Judge Space generation error: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        
        // FastAPI returns the response directly
        return {
            parent_prompt: result.parent_prompt,
            generated_prompts: result.generated_prompts
        };
    } catch (error) {
        throw new Error(`Judge Space generation error: ${error.message}`);
    }
}

export { llm_call, adapter, createClientFromConfig, getAdapterForBenchmark, generateTestCasesFromJudgeSpace };