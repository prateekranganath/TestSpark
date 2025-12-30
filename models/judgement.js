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
    }
}, { timestamps: true });

const Judgement = mongoose.model('Judgement', judgementSchema);

export default Judgement;
