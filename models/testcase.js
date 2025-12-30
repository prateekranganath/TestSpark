import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    prompt: {
        type: String,
        required: true
    },
    generatedBy: {
        type: String,
        enum: ['user', 'llm'],
        required: true
    },
    generationType: {
        type: String,
        enum: ['ambiguity', 'contradiction', 'negation', null],
        default: null
    },
    parentPromptId: {
        type: String,
        default: null
    },
    expectedOutput: {
        type: String,
        default: null
    },
    metadata: {
        difficulty: String,
        category: String,
        tags: [String]
    }
}, { timestamps: true });

const TestCase = mongoose.model('TestCase', testCaseSchema);

export default TestCase;
