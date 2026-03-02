/**
 * Session Service - Manage model configurations per session
 * In-memory storage (use Redis or MongoDB for production)
 */

const sessions = new Map();

/**
 * Store model configuration for a session
 * @param {String} sessionId - Session identifier
 * @param {Object} config - Model configuration
 */
export function storeModelConfig(sessionId, config) {
    sessions.set(sessionId, {
        ...config,
        initializedAt: new Date(),
        ready: false
    });
    console.log(`✅ Stored model config for session ${sessionId}:`, config.modelName);
}

/**
 * Get model configuration for a session
 * @param {String} sessionId - Session identifier
 * @returns {Object|undefined} Model configuration
 */
export function getModelConfig(sessionId) {
    return sessions.get(sessionId);
}

/**
 * Mark model as ready for a session
 * @param {String} sessionId - Session identifier
 */
export function markModelReady(sessionId) {
    const config = sessions.get(sessionId);
    if (config) {
        config.ready = true;
        config.readyAt = new Date();
        console.log(`✅ Model ready for session ${sessionId}: ${config.modelName}`);
    }
}

/**
 * Clear model configuration for a session
 * @param {String} sessionId - Session identifier
 */
export function clearModelConfig(sessionId) {
    sessions.delete(sessionId);
    console.log(`🗑️  Cleared model config for session ${sessionId}`);
}

/**
 * Get all active sessions (for debugging)
 * @returns {Number} Number of active sessions
 */
export function getSessionCount() {
    return sessions.size;
}

/**
 * Cleanup expired sessions (older than 24 hours)
 */
export function cleanupExpiredSessions() {
    const now = new Date();
    const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, config] of sessions.entries()) {
        if (now - config.initializedAt > expiryTime) {
            sessions.delete(sessionId);
            console.log(`🧹 Cleaned up expired session: ${sessionId}`);
        }
    }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
