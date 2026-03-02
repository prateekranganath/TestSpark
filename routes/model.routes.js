/**
 * Model Routes - Endpoints for model initialization and status
 */

import express from 'express';
import { initializeModel, checkStatus, clearModel } from '../controllers/model.controller.js';

const router = express.Router();

/**
 * POST /api/model/initialize
 * Initialize a model for the user session
 * 
 * Request Body:
 * {
 *   "modelProvider": "huggingface",
 *   "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
 *   "baseUrl": "https://neollm007-user-model-space.hf.space",
 *   "apiKey": "optional",
 *   "adapter": "optional-lora-adapter"
 * }
 */
router.post('/initialize', initializeModel);

/**
 * GET /api/model/status
 * Check model status for the user session
 * 
 * Returns:
 * {
 *   "success": true,
 *   "status": "ready" | "loading" | "error" | "not_initialized",
 *   "message": "Model is ready for inference",
 *   "modelProvider": "huggingface",
 *   "modelName": "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
 * }
 */
router.get('/status', checkStatus);

/**
 * DELETE /api/model/clear
 * Clear model configuration from session
 * 
 * Returns:
 * {
 *   "success": true,
 *   "message": "Model configuration cleared from session"
 * }
 */
router.delete('/clear', clearModel);

export default router;
