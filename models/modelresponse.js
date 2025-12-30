import mongoose from "mongoose";

const modelResponseSchema = new mongoose.Schema({
    evalRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvalRun',
        required: true
    },
    testCaseId: {
        type: String,
        ref: 'TestCase',
        required: true
    },
    modelName: {
        type: String,
        required: true
    },
    modelVersion: {
        type: String,
        default: 'latest'
    },
    prompt: {
        type: String,
        required: true
    },
    response: {
        type: String,
        required: true
    },
    responseTime: {
        type: Number,
        default: 0
    },
    tokensUsed: {
        input: {
            type: Number,
            default: 0
        },
        output: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['success', 'error', 'timeout'],
        default: 'success'
    },
    error: {
        type: String,
        default: null
    }
}, { timestamps: true });

const ModelResponse = mongoose.model('ModelResponse', modelResponseSchema);

export default ModelResponse;
