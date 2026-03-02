/**
 * Session Middleware Utilities
 * Normalize sessionId extraction and validation across all endpoints
 */

import { getModelConfig } from "../services/sessionservice.js";

/**
 * Extract sessionId from multiple sources (query, header, body)
 * Provides consistent sessionId extraction across all endpoints
 * 
 * @param {Request} req - Express request object
 * @returns {string|null} - sessionId or null if not found
 */
export function extractSessionId(req) {
    return (
        req.query.sessionId ||
        req.headers['x-session-id'] ||
        req.body.sessionId ||
        null
    );
}

/**
 * Validate that sessionId exists in request
 * Returns error response if missing
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Object|null} - Error response or null if valid
 */
export function requireSessionId(req, res) {
    const sessionId = extractSessionId(req);
    
    if (!sessionId) {
        res.status(400).json({
            success: false,
            error: 'sessionId is required',
            message: 'Provide sessionId via query param (?sessionId=xxx), header (X-Session-Id), or request body',
            hint: 'Initialize a model first using POST /api/model/initialize'
        });
        return null;
    }
    
    return sessionId;
}

/**
 * Validate that session exists AND model is ready
 * Returns error response if session not found or model not ready
 * NOW ASYNC to support MongoDB queries
 * 
 * @param {string} sessionId - Session ID to validate
 * @param {Response} res - Express response object
 * @returns {Promise<Object|null>} - Model config or null if invalid
 */
export async function requireReadyModel(sessionId, res) {
    if (!sessionId) {
        res.status(400).json({
            success: false,
            error: 'sessionId is required',
            message: 'Provide sessionId via query param, header, or request body'
        });
        return null;
    }

    // Get model configuration from session (NOW ASYNC - MongoDB query)
    const modelConfig = await getModelConfig(sessionId);
    
    if (!modelConfig) {
        res.status(400).json({
            success: false,
            error: 'No model configured for this session',
            status: 'not_initialized',
            message: 'Initialize a model first using POST /api/model/initialize',
            sessionId: sessionId
        });
        return null;
    }

    // Check if model is ready
    if (!modelConfig.ready) {
        res.status(400).json({
            success: false,
            error: 'Model not ready',
            status: 'loading',
            message: 'Session model is still loading. Please wait for initialization to complete.',
            tip: `Poll GET /api/model/status?sessionId=${sessionId}`,
            sessionId: sessionId,
            modelName: modelConfig.modelName
        });
        return null;
    }

    return modelConfig;
}

/**
 * Express middleware to attach sessionId to req object
 * Use this in routes that need session management
 */
export function attachSessionId(req, res, next) {
    req.sessionId = extractSessionId(req);
    next();
}

/**
 * Express middleware to require and validate session
 * Blocks request if no valid session found
 */
export function requireSession(req, res, next) {
    const sessionId = requireSessionId(req, res);
    if (!sessionId) return; // Response already sent
    
    req.sessionId = sessionId;
    next();
}

/**
 * Express middleware to require session and ready model
 * Blocks request if session model is not ready for inference
 * NOW ASYNC to support MongoDB queries
 */
export async function requireReadySession(req, res, next) {
    const sessionId = extractSessionId(req);
    const modelConfig = await requireReadyModel(sessionId, res);
    
    if (!modelConfig) return; // Response already sent
    
    req.sessionId = sessionId;
    req.sessionModel = modelConfig;
    next();
}
