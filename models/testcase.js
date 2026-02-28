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
        enum: ['user', 'llm', 'judge-space'],
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
        tags: [String],
        // Benchmark-specific fields
        benchmarkType: {
            type: String,
            enum: ['aime', 'mmlu', 'msur', null],
            default: null
        },
        answer: mongoose.Schema.Types.Mixed,
        expected_answer: mongoose.Schema.Types.Mixed,
        domain: String,
        subcategory: String,
        topic: String,
        evaluation_type: String,
        task_type: String,
        solution_outline: String
    }
}, { timestamps: true });

const TestCase = mongoose.model('TestCase', testCaseSchema);

export default TestCase;
