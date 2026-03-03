import mongoose from "mongoose";

const evalRunSchema = new mongoose.Schema({
    runName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    modelUnderTest: {
        name: {
            type: String,
            required: true
        },
        version: {
            type: String,
            default: 'latest'
        },
        provider: {
            type: String,
            default: 'openai'
        }
    },
    judgeModel: {
        name: {
            type: String,
            required: true,
            default: 'gpt-4'  // Server-controlled, not user-configurable
        },
        version: {
            type: String,
            default: 'latest'
        }
    },
    testCaseIds: [{
        type: String,
        ref: 'TestCase'
    }],
    modelResponses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModelResponse'
    }],
    judgements: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Judgement'
    }],
    metrics: {
        totalTestCases: {
            type: Number,
            default: 0
        },
        completed: {
            type: Number,
            default: 0
        },
        passed: {
            type: Number,
            default: 0
        },
        failed: {
            type: Number,
            default: 0
        },
        averageScore: {
            type: Number,
            default: 0
        },
        averageResponseTime: {
            type: Number,
            default: 0
        },
        totalTokensUsed: {
            type: Number,
            default: 0
        }
    },
    configuration: {
        temperature: {
            type: Number,
            default: 0.7
        },
        maxTokens: {
            type: Number,
            default: 1000
        },
        topP: {
            type: Number,
            default: 1
        },
        timeout: {
            type: Number,
            default: 30000
        }
    },
    startTime: {
        type: Date,
        default: null
    },
    endTime: {
        type: Date,
        default: null
    },
    duration: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: String,
        default: 'system'
    },
    tags: [String],
    notes: {
        type: String,
        default: ''
    }
}, { timestamps: true });

const EvalRun = mongoose.model('EvalRun', evalRunSchema);

export default EvalRun;
