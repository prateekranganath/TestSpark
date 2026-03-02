/**
 * Model Controller - Handle model initialization and status checks
 */

import { storeModelConfig, getModelConfig, markModelReady, clearModelConfig } from '../services/sessionservice.js';
import { warmupHFModel, checkHFModelStatus } from '../services/hfspaceservice.js';

/**
 * Initialize a model for the user session
 * POST /api/model/initialize
 */
export async function initializeModel(req, res) {
    try {
        const { modelProvider, modelName, baseUrl, apiKey, adapter } = req.body;

        // Validate required fields
        if (!modelProvider || !modelName) {
            return res.status(400).json({
                success: false,
                error: 'modelProvider and modelName are required'
            });
        }

        // Generate or get session ID
        const sessionId = req.sessionID || req.session?.id || `session_${Date.now()}`;
        console.log(`📝 Initializing model for session: ${sessionId}`);

        // Store model configuration in session
        const modelConfig = {
            modelProvider,
            modelName,
            baseUrl,
            apiKey,
            adapter,
            sessionId
        };

        storeModelConfig(sessionId, modelConfig);

        // Handle different model providers
        if (modelProvider === 'huggingface') {
            console.log(`🤗 HuggingFace model detected: ${modelName}`);
            
            // Start warmup asynchronously (don't wait)
            warmupHFModel(modelName, adapter)
                .then(result => {
                    if (result.ready) {
                        console.log(`✅ Model ${modelName} warmed up and ready`);
                        markModelReady(sessionId);
                    } else if (result.loading) {
                        console.log(`⏳ Model ${modelName} is loading...`);
                    } else {
                        console.error(`❌ Model ${modelName} warmup failed:`, result.error);
                    }
                })
                .catch(err => {
                    console.error(`❌ Model ${modelName} warmup error:`, err);
                });

            // Return immediately with loading status
            return res.status(200).json({
                success: true,
                message: 'Model initialization started',
                status: 'loading',
                sessionId,
                estimatedTime: '2-5 minutes for first load',
                note: 'Poll /api/model/status to check when model is ready'
            });
        } 
        
        // Frontier models (OpenAI, Anthropic, etc.) are always ready
        else if (['openai', 'anthropic', 'google', 'cohere'].includes(modelProvider)) {
            console.log(`🚀 Frontier model detected: ${modelProvider}/${modelName} - marking as ready immediately`);
            markModelReady(sessionId);
            
            return res.status(200).json({
                success: true,
                message: 'Model initialized successfully',
                status: 'ready',
                sessionId,
                modelProvider,
                modelName
            });
        }
        
        // Other providers
        else {
            markModelReady(sessionId); // Assume ready
            
            return res.status(200).json({
                success: true,
                message: 'Model initialized successfully',
                status: 'ready',
                sessionId,
                modelProvider,
                modelName
            });
        }

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
 * GET /api/model/status
 */
export async function checkStatus(req, res) {
    try {
        const sessionId = req.sessionID || req.session?.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'No session ID found',
                status: 'not_initialized'
            });
        }

        // Get stored model configuration
        const modelConfig = getModelConfig(sessionId);

        if (!modelConfig) {
            return res.status(404).json({
                success: false,
                error: 'No model configured for this session',
                status: 'not_initialized',
                message: 'Please initialize a model first using POST /api/model/initialize'
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

        // For HuggingFace models, check actual status
        if (modelConfig.modelProvider === 'huggingface') {
            console.log(`🔍 Checking HF model status: ${modelConfig.modelName}`);
            
            const statusResult = await checkHFModelStatus(modelConfig.modelName, modelConfig.adapter);
            
            if (statusResult.ready) {
                // Update session to mark as ready
                markModelReady(sessionId);
                
                return res.status(200).json({
                    success: true,
                    status: 'ready',
                    message: statusResult.message,
                    modelProvider: modelConfig.modelProvider,
                    modelName: modelConfig.modelName,
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
                    initializedAt: modelConfig.initializedAt
                });
            }
        }

        // For other providers, should already be ready
        return res.status(200).json({
            success: true,
            status: 'ready',
            message: 'Model is ready',
            modelProvider: modelConfig.modelProvider,
            modelName: modelConfig.modelName,
            initializedAt: modelConfig.initializedAt
        });

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
 * DELETE /api/model/clear
 */
export async function clearModel(req, res) {
    try {
        const sessionId = req.sessionID || req.session?.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'No session ID found'
            });
        }

        clearModelConfig(sessionId);

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
