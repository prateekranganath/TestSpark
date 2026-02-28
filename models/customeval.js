import mongoose from "mongoose";

const customEvalSchema = new mongoose.Schema({
    modelName: {
        type: String,
        required: true
    },
    provider: {
        type: String,
        enum: ['hf-user-model', 'openai', 'anthropic', 'together', 'custom'],
        default: 'hf-user-model'
    },
    evaluationType: {
        type: String,
        enum: ['exact_match', 'contains', 'llm_judge'],
        default: 'exact_match'
    },
    datasetSize: {
        type: Number,
        required: true
    },
    results: {
        total: {
            type: Number,
            required: true
        },
        passed: {
            type: Number,
            default: 0
        },
        failed: {
            type: Number,
            default: 0
        },
        accuracy: {
            type: Number,
            default: 0
        }
    },
    individualResults: [{
        index: Number,
        input: String,
        expected: String,
        actual: String,
        passed: Boolean,
        score: Number,
        error: String
    }],
    metadata: {
        userId: String,
        sessionId: String,
        tags: [String]
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'completed'
    }
}, {
    timestamps: true
});

// Index for faster queries
customEvalSchema.index({ createdAt: -1 });
customEvalSchema.index({ modelName: 1 });

const CustomEval = mongoose.model('CustomEval', customEvalSchema);

export default CustomEval;
