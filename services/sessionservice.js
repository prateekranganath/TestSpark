/**
 * Session Service - Manage model configurations per session
 * MongoDB-based persistence (replaces in-memory storage)
 */

import Session from '../models/session.js';

/**
 * Store model configuration for a session
 * @param {String} sessionId - Session identifier
 * @param {Object} config - Model configuration
 */
export async function storeModelConfig(sessionId, config) {
    try {
        await Session.findOneAndUpdate(
            { sessionId },
            {
                sessionId,
                modelName: config.modelName,
                modelProvider: config.modelProvider || 'huggingface',
                baseUrl: config.baseUrl,
                status: 'loading',
                initializedAt: new Date()
            },
            { upsert: true, returnDocument: 'after' }
        );
        console.log(`✅ Stored model config in MongoDB for session ${sessionId}:`, config.modelName);
    } catch (error) {
        console.error(`❌ Error storing session ${sessionId}:`, error);
        throw error;
    }
}

/**
 * Get model configuration for a session
 * @param {String} sessionId - Session identifier
 * @returns {Object|null} Model configuration with ready status
 */
export async function getModelConfig(sessionId) {
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return null;
        }
        
        // Return in format compatible with existing code
        return {
            modelName: session.modelName,
            modelProvider: session.modelProvider,
            baseUrl: session.baseUrl,
            sessionId: session.sessionId,
            initializedAt: session.initializedAt,
            ready: session.status === 'ready'
        };
    } catch (error) {
        console.error(`❌ Error getting session ${sessionId}:`, error);
        return null;
    }
}

/**
 * Mark model as ready for a session
 * @param {String} sessionId - Session identifier
 */
export async function markModelReady(sessionId) {
    try {
        const result = await Session.updateOne(
            { sessionId },
            { status: 'ready' }
        );
        
        if (result.modifiedCount > 0) {
            const session = await Session.findOne({ sessionId });
            console.log(`✅ Model ready for session ${sessionId}: ${session?.modelName}`);
        }
    } catch (error) {
        console.error(`❌ Error marking session ready ${sessionId}:`, error);
    }
}

/**
 * Clear model configuration for a session
 * @param {String} sessionId - Session identifier
 */
export async function clearModelConfig(sessionId) {
    try {
        await Session.deleteOne({ sessionId });
        console.log(`🗑️  Cleared model config from MongoDB for session ${sessionId}`);
    } catch (error) {
        console.error(`❌ Error clearing session ${sessionId}:`, error);
    }
}

/**
 * Get all active sessions (for debugging)
 * @returns {Number} Number of active sessions
 */
export async function getSessionCount() {
    try {
        return await Session.countDocuments();
    } catch (error) {
        console.error('❌ Error counting sessions:', error);
        return 0;
    }
}

/**
 * Manual cleanup of expired sessions (MongoDB TTL handles this automatically)
 * This function is kept for compatibility but is now optional
 */
export async function cleanupExpiredSessions() {
    try {
        const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        const result = await Session.deleteMany({ 
            createdAt: { $lt: expiryTime } 
        });
        
        if (result.deletedCount > 0) {
            console.log(`🧹 Cleaned up ${result.deletedCount} expired sessions from MongoDB`);
        }
    } catch (error) {
        console.error('❌ Error cleaning up sessions:', error);
    }
}

// Manual cleanup is now optional (MongoDB TTL handles it)
// But we keep this for extra safety
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

