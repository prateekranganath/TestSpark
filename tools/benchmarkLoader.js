import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TestCase from '../models/testcase.js';
import connectDB from '../db/connectdb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BENCHMARK_DIR = path.join(__dirname, '../benchmarks');

/**
 * Load AIME benchmark problems into the database
 */
async function loadAIMEBenchmark() {
    const problemsPath = path.join(BENCHMARK_DIR, 'AIME', 'problems.json');
    const problems = JSON.parse(fs.readFileSync(problemsPath, 'utf-8'));

    const testCases = problems.map(problem => ({
        _id: problem.id,
        prompt: problem.problem,
        generatedBy: 'user',
        expectedOutput: String(problem.answer),
        metadata: {
            benchmarkType: 'aime',
            difficulty: problem.difficulty,
            category: 'mathematical_reasoning',
            topic: problem.topic,
            answer: problem.answer,
            solution_outline: problem.solution_outline,
            tags: ['benchmark', 'aime', 'mathematics']
        }
    }));

    let loaded = 0;
    for (const testCase of testCases) {
        try {
            await TestCase.findByIdAndUpdate(
                testCase._id,
                testCase,
                { upsert: true, new: true }
            );
            loaded++;
            console.log(`✓ Loaded AIME problem: ${testCase._id}`);
        } catch (error) {
            console.error(`✗ Failed to load ${testCase._id}:`, error.message);
        }
    }

    return { total: testCases.length, loaded };
}

/**
 * Load MMLU benchmark questions into the database
 */
async function loadMMLUBenchmark() {
    const questionsPath = path.join(BENCHMARK_DIR, 'MMLU', 'questions.json');
    const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));

    const testCases = questions.map(question => ({
        _id: question.id,
        prompt: question.question,
        generatedBy: 'user',
        expectedOutput: String(question.answer),
        metadata: {
            benchmarkType: 'mmlu',
            difficulty: question.difficulty,
            category: 'multidomain_knowledge',
            domain: question.domain,
            subcategory: question.subcategory,
            answer: question.answer,
            evaluation_type: question.evaluation_type,
            solution_outline: question.solution_outline,
            tags: ['benchmark', 'mmlu', question.domain, question.subcategory]
        }
    }));

    let loaded = 0;
    for (const testCase of testCases) {
        try {
            await TestCase.findByIdAndUpdate(
                testCase._id,
                testCase,
                { upsert: true, new: true }
            );
            loaded++;
            console.log(`✓ Loaded MMLU question: ${testCase._id}`);
        } catch (error) {
            console.error(`✗ Failed to load ${testCase._id}:`, error.message);
        }
    }

    return { total: testCases.length, loaded };
}

/**
 * Load MSUR benchmark tasks into the database
 */
async function loadMSURBenchmark() {
    const tasksPath = path.join(BENCHMARK_DIR, 'MSUR', 'task.json');
    const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));

    const testCases = tasks.map(task => ({
        _id: task.id,
        prompt: task.question,
        generatedBy: 'user',
        expectedOutput: task.expected_answer,
        metadata: {
            benchmarkType: 'msur',
            difficulty: task.difficulty,
            category: 'mathematical_reasoning',
            domain: task.domain,
            subcategory: task.subcategory,
            task_type: task.task_type,
            expected_answer: task.expected_answer,
            evaluation_type: task.evaluation_type,
            solution_outline: task.solution_outline,
            tags: ['benchmark', 'msur', task.domain, task.task_type]
        }
    }));

    let loaded = 0;
    for (const testCase of testCases) {
        try {
            await TestCase.findByIdAndUpdate(
                testCase._id,
                testCase,
                { upsert: true, new: true }
            );
            loaded++;
            console.log(`✓ Loaded MSUR task: ${testCase._id}`);
        } catch (error) {
            console.error(`✗ Failed to load ${testCase._id}:`, error.message);
        }
    }

    return { total: testCases.length, loaded };
}

/**
 * Load all benchmarks
 */
async function loadAllBenchmarks() {
    console.log('🚀 Starting benchmark loading...\n');

    try {
        await connectDB();

        console.log('📊 Loading AIME benchmark...');
        const aimeResults = await loadAIMEBenchmark();
        console.log(`✅ AIME: ${aimeResults.loaded}/${aimeResults.total} loaded\n`);

        console.log('📊 Loading MMLU benchmark...');
        const mmluResults = await loadMMLUBenchmark();
        console.log(`✅ MMLU: ${mmluResults.loaded}/${mmluResults.total} loaded\n`);

        console.log('📊 Loading MSUR benchmark...');
        const msurResults = await loadMSURBenchmark();
        console.log(`✅ MSUR: ${msurResults.loaded}/${msurResults.total} loaded\n`);

        const totalLoaded = aimeResults.loaded + mmluResults.loaded + msurResults.loaded;
        const totalTests = aimeResults.total + mmluResults.total + msurResults.total;

        console.log(`🎉 Successfully loaded ${totalLoaded}/${totalTests} benchmark test cases!`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error loading benchmarks:', error);
        process.exit(1);
    }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    loadAllBenchmarks();
}

export { loadAIMEBenchmark, loadMMLUBenchmark, loadMSURBenchmark, loadAllBenchmarks };
