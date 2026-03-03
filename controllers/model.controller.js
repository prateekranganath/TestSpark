/**
 * Model Controller - Handle model initialization and status checks
 */

import { storeModelConfig, getModelConfig, markModelReady, clearModelConfig } from '../services/sessionservice.js';
import { warmupHFModel, checkHFModelStatus } from '../services/hfspaceservice.js';
import { extractSessionId } from '../middleware/session.middleware.js';

/**
 * Initialize a model for the user session
 * POST /api/model/initialize
 * Request: { modelName }
 */
export async function initializeModel(req, res) {
    try {
        const { modelName } = req.body;

        // Validate required field
        if (!modelName) {
            return res.status(400).json({
                success: false,
                error: 'modelName is required',
                example: { modelName: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' }
            });
        }

        // Generate session ID (not cookie-based, frontend will store and send back)
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`📝 Initializing HuggingFace model for session: ${sessionId}`);
        console.log(`   Model: ${modelName}`);

        // Store model configuration in session
        // Use backend-configured HF Space URL (not from frontend)
        const modelConfig = {
            modelProvider: 'huggingface',
            modelName,
            baseUrl: process.env.HF_USER_MODEL_SPACE_ENDPOINT,
            sessionId,
            adapter: null // Future: support LoRA adapters
        };

        // Store model configuration in MongoDB asynchronously
        storeModelConfig(sessionId, modelConfig)
            .catch(err => console.error("❌ Store session error:", err));

        // Start warmup asynchronously (don't wait)
        console.log(`🤗 Starting warmup for ${modelName}...`);
        warmupHFModel(modelName, null)
            .then(async result => {
                if (result.ready) {
                    console.log(`✅ Model ${modelName} warmed up and ready`);
                    await markModelReady(sessionId);
                } else if (result.loading) {
                    console.log(`⏳ Model ${modelName} is loading...`);
                } else {
                    console.error(`❌ Model ${modelName} warmup failed:`, result.error);
                }
            })
            .catch(err => console.error("Warmup error:", err));

        // Return immediately with loading status
        return res.status(200).json({
            success: true,
            message: 'Model initialization started',
            status: 'loading',
            sessionId,
            modelName,
            estimatedTime: '2-5 minutes for first load',
            note: 'Poll GET /api/model/status?sessionId=' + sessionId
        });

    } catch (error) {
        console.error('❌ Model initialization error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to initialize model',
            details: error.message
        });
    }
}

/**
 * Check model status for the user session
 * GET /api/model/status?sessionId=xxx
 */
export async function checkStatus(req, res) {
    try {
        // Get sessionId using normalized extraction
        const sessionId = extractSessionId(req);

        if (!sessionId) {
            // Return 200 with graceful error - don't break polling
            return res.status(200).json({
                success: false,
                error: 'sessionId is required',
                status: 'not_initialized',
                message: 'No sessionId provided. Initialize a model first via POST /api/model/initialize',
                hint: 'Pass sessionId as query param: /api/model/status?sessionId=xxx or header X-Session-Id'
            });
        }

        // Get stored model configuration from MongoDB (async)
        const modelConfig = await getModelConfig(sessionId);

        if (!modelConfig) {
            // Return 200 with graceful error - don't break polling
            return res.status(200).json({
                success: false,
                error: 'No model configured for this session',
                status: 'not_initialized',
                message: 'Please initialize a model first using POST /api/model/initialize',
                sessionId: sessionId
            });
        }

        // Check if already marked as ready
        if (modelConfig.ready) {
            return res.status(200).json({
                success: true,
                status: 'ready',
                message: 'Model is ready for inference',
                modelProvider: modelConfig.modelProvider,
                modelName: modelConfig.modelName,
                initializedAt: modelConfig.initializedAt
            });
        }

        // Check actual HF Space status
        console.log(`🔍 Checking HF model status: ${modelConfig.modelName}`);

        let statusResult;

        try {
            statusResult = await checkHFModelStatus(
                modelConfig.modelName,
                modelConfig.adapter
            );
        } catch (err) {
            console.log("⚠️ HF status check timeout — treating as loading");

            return res.status(200).json({
                success: true,
                status: "loading",
                message: "Model still warming up...",
                modelProvider: modelConfig.modelProvider,
                modelName: modelConfig.modelName,
                sessionId,
                initializedAt: modelConfig.initializedAt
            });
        }
        
        if (statusResult.ready) {
            // Update session to mark as ready (async)
            await markModelReady(sessionId);
            
            
            return res.status(200).json({
                success: true,
                status: 'ready',
                message: statusResult.message,
                modelProvider: modelConfig.modelProvider,
                modelName: modelConfig.modelName,
                sessionId,
                initializedAt: modelConfig.initializedAt
            });
        } else {
            return res.status(200).json({
                success: true,
                status: statusResult.status,
                message: statusResult.message,
                progress: statusResult.progress,
                modelProvider: modelConfig.modelProvider,
                modelName: modelConfig.modelName,
                sessionId,
                initializedAt: modelConfig.initializedAt
            });
        }

    } catch (error) {
        console.error('❌ Model status check error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to check model status',
            details: error.message
        });
    }
}

/**
 * Clear model configuration from session
 * DELETE /api/model/clear?sessionId=xxx
 */
export async function clearModel(req, res) {
    try {
        // Get sessionId using normalized extraction
        const sessionId = extractSessionId(req);

        if (!sessionId) {
            // Return 200 with graceful message
            return res.status(200).json({
                success: false,
                error: 'sessionId is required',
                message: 'Provide sessionId as query param or X-Session-Id header'
            });
        }

        // Clear model configuration from MongoDB (async)
        await clearModelConfig(sessionId);

        return res.status(200).json({
            success: true,
            message: 'Model configuration cleared from session'
        });

    } catch (error) {
        console.error('❌ Clear model error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clear model configuration',
            details: error.message
        });
    }
}
