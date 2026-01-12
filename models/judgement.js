import mongoose from "mongoose";

const judgementSchema = new mongoose.Schema({
    evalRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvalRun',
        required: true
    },
    modelResponseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModelResponse',
        required: true
    },
    testCaseId: {
        type: String,
        ref: 'TestCase',
        required: true
    },
    judgeModel: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        min: 0,
        max: 10,
        required: true
    },
    reasoning: {
        type: String,
        required: true
    },
    criteria: {
        accuracy: Number,
        relevance: Number,
        coherence: Number,
        completeness: Number
    },
    passed: {
        type: Boolean,
        required: true
    },
    feedback: {
        type: String,
        default: ''
    },
    // Benchmark-specific evaluation results
    benchmarkEvaluation: {
        benchmarkType: {
            type: String,
            enum: ['aime', 'mmlu', 'msur', null],
            default: null
        },
        validator: {
            type: String,
            default: null
        },
        category: {
            type: String,
            default: null
        },
        pass: {
            type: Boolean,
            default: null
        },
        score: {
            type: Number,
            min: 0,
            max: 1,
            default: null
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: null
        },
        severity: {
            type: String,
            enum: ['easy', 'medium', 'hard', null],
            default: null
        },
        explanation: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        source: {
            type: String,
            enum: ['validator', 'judge_model', null],
            default: null
        }
    }
}, { timestamps: true });

const Judgement = mongoose.model('Judgement', judgementSchema);

export default Judgement;
