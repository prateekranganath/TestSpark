/**
 * HuggingFace Space Service - Handle model warmup and status checking
 */

const HF_USER_MODEL_SPACE_ENDPOINT = process.env.HF_USER_MODEL_SPACE_ENDPOINT;
const HF_SPACE_TOKEN = process.env.HF_SPACE_TOKEN;

/**
 * Warm up HuggingFace model by triggering initial load
 * @param {String} modelName - HuggingFace model ID
 * @param {String} adapter - Optional LoRA adapter
 * @returns {Promise<Object>} Warmup result
 */
export async function warmupHFModel(modelName, adapter = null) {
    try {
        console.log(`🔥 Warming up model: ${modelName}${adapter ? ` with adapter: ${adapter}` : ''}`);
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (HF_SPACE_TOKEN) {
            headers['Authorization'] = `Bearer ${HF_SPACE_TOKEN}`;
        }

        // Step 1: Load the model
        const loadResponse = await fetch(`${HF_USER_MODEL_SPACE_ENDPOINT}/load`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: modelName,
                adapter: adapter
            }),
            signal: AbortSignal.timeout(300000) // 5 minutes
        });

        if (!loadResponse.ok) {
            const errorText = await loadResponse.text();
            console.error(`❌ Model load error: ${loadResponse.status} - ${errorText}`);
            
            // 503 = service unavailable (model loading)
            if (loadResponse.status === 503) {
                return { success: true, loading: true, message: 'Model is loading...' };
            }
            
            return { success: false, error: errorText };
        }

        const loadResult = await loadResponse.json();
        console.log(`📦 Load response:`, loadResult);

        // Step 2: Try a quick inference to fully warm up
        try {
            const inferResponse = await fetch(`${HF_USER_MODEL_SPACE_ENDPOINT}/infer`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    prompt: "Hello, this is a warmup test.",
                    temperature: 0.7,
                    max_tokens: 10,
                    top_p: 1.0
                }),
                signal: AbortSignal.timeout(120000) // 2 minutes
            });

            if (inferResponse.ok) {
                console.log(`✅ Model ${modelName} warmup completed successfully`);
                return { success: true, ready: true };
            } else {
                // Inference failed but load succeeded - model is still loading
                console.log(`⏳ Model ${modelName} loaded but not ready for inference yet`);
                return { success: true, loading: true };
            }
        } catch (inferError) {
            // Inference timeout - model is still loading
            console.log(`⏳ Model ${modelName} warmup inference timed out - still loading`);
            return { success: true, loading: true };
        }
        
    } catch (err) {
        // Network timeout or connection errors
        if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
            console.log(`⏳ Model ${modelName} warmup timed out - this is expected for first load`);
            return { success: true, loading: true };
        }
        
        console.error(`❌ Model ${modelName} warmup error:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Check if HuggingFace model is ready for inference
 * @param {String} modelName - HuggingFace model ID
 * @param {String} adapter - Optional LoRA adapter
 * @returns {Promise<Object>} Status result
 */
export async function checkHFModelStatus(modelName, adapter = null) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (HF_SPACE_TOKEN) {
            headers['Authorization'] = `Bearer ${HF_SPACE_TOKEN}`;
        }

        // Quick test inference to check if model is ready
        const response = await fetch(`${HF_USER_MODEL_SPACE_ENDPOINT}/infer`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                prompt: "Test",
                temperature: 0.1,
                max_tokens: 3,
                top_p: 1.0
            }),
            signal: AbortSignal.timeout(5000) // 5 seconds
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Model ${modelName} is ready`);
            
            return {
                ready: true,
                status: "ready",
                message: "Model is loaded and ready for inference"
            };
        }
        
        // 503 = still loading
        if (response.status === 503) {
            console.log(`⏳ Model ${modelName} is still loading (503)`);
            return {
                ready: false,
                status: "loading",
                message: "Model is being loaded in HuggingFace Space...",
                progress: 50 // Approximate
            };
        }
        
        // Other errors
        const errorText = await response.text();
        console.error(`❌ Model status check error: ${response.status} - ${errorText}`);
        return {
            ready: false,
            status: "error",
            message: `Error checking model status: ${errorText}`
        };
        
    } catch (err) {
        // Timeout or connection error = still loading
        if (err.name === 'AbortError' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            console.log(`⏳ Model ${modelName} status check timed out - still loading`);
            return {
                ready: false,
                status: "loading",
                message: "Model is still loading in HuggingFace Space...",
                progress: 65
            };
        }
        
        console.error(`❌ Model status check error:`, err.message);
        return {
            ready: false,
            status: "error",
            message: `Error checking model status: ${err.message}`
        };
    }
}

/**
 * Get HuggingFace Space status endpoint
 * @returns {Promise<Object>} Space status
 */
export async function getSpaceStatus() {
    try {
        const response = await fetch(`${HF_USER_MODEL_SPACE_ENDPOINT}/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            return await response.json();
        }
        
        return { status: 'unknown', error: `HTTP ${response.status}` };
    } catch (err) {
        return { status: 'error', error: err.message };
    }
}
