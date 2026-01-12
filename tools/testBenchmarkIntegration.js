// Quick test script for benchmark integration
// Usage: node tools/testBenchmarkIntegration.js

import connectDB from '../db/connectdb.js';
import TestCase from '../models/testcase.js';
import EvalRun from '../models/evalrun.js';
import { runEvaluation } from '../services/evalservice.js';

async function testBenchmarkIntegration() {
    console.log('🧪 Testing Benchmark Integration\n');

    try {
        await connectDB();
        console.log('✓ Connected to database\n');

        // Check for benchmark test cases
        const aimeTests = await TestCase.find({ 'metadata.benchmarkType': 'aime' }).limit(3);
        const mmluTests = await TestCase.find({ 'metadata.benchmarkType': 'mmlu' }).limit(3);
        const msurTests = await TestCase.find({ 'metadata.benchmarkType': 'msur' }).limit(3);

        console.log('📊 Found Test Cases:');
        console.log(`   AIME: ${aimeTests.length}`);
        console.log(`   MMLU: ${mmluTests.length}`);
        console.log(`   MSUR: ${msurTests.length}\n`);

        if (aimeTests.length === 0 && mmluTests.length === 0 && msurTests.length === 0) {
            console.log('⚠️  No benchmark test cases found!');
            console.log('   Run: node tools/benchmarkLoader.js\n');
            process.exit(0);
        }

        // Create a test eval run
        const testCaseIds = [
            ...aimeTests.map(t => t._id),
            ...mmluTests.map(t => t._id),
            ...msurTests.map(t => t._id)
        ].slice(0, 5); // Limit to 5 tests

        if (testCaseIds.length === 0) {
            console.log('⚠️  No test cases selected');
            process.exit(0);
        }

        console.log(`🚀 Creating test evaluation run with ${testCaseIds.length} test cases...\n`);

        const evalRun = await EvalRun.create({
            runName: 'Benchmark Integration Test',
            description: 'Testing benchmark validator integration',
            modelUnderTest: {
                name: process.env.MODEL_NAME || 'gpt-3.5-turbo',
                version: 'latest'
            },
            judgeModel: {
                name: process.env.JUDGE_MODEL || 'gpt-4',
                version: 'latest'
            },
            testCaseIds: testCaseIds,
            configuration: {
                temperature: 0.1
            },
            tags: ['test', 'benchmark', 'integration'],
            metrics: {
                totalTestCases: testCaseIds.length
            }
        });

        console.log(`✓ Created eval run: ${evalRun._id}\n`);

        // Run a single test evaluation
        console.log('🔄 Running sample evaluation...');
        const testCaseId = testCaseIds[0];
        const testCase = await TestCase.findById(testCaseId);
        console.log(`   Test Case: ${testCaseId}`);
        console.log(`   Benchmark: ${testCase.metadata?.benchmarkType || 'none'}`);
        console.log(`   Prompt: ${testCase.prompt.substring(0, 80)}...\n`);

        try {
            const result = await runEvaluation({
                evalRunId: evalRun._id,
                testCaseId: testCaseId,
                model: evalRun.modelUnderTest.name
            });

            console.log('✓ Evaluation completed successfully!\n');
            console.log('📊 Results:');
            console.log(`   Model Response ID: ${result.modelResponse._id}`);
            console.log(`   Judgement ID: ${result.judgement._id}`);
            console.log(`   Overall Pass: ${result.judgement.passed}`);
            console.log(`   Score: ${result.judgement.score}/10\n`);

            if (result.judgement.benchmarkEvaluation && result.judgement.benchmarkEvaluation.benchmarkType) {
                console.log('🎯 Benchmark Evaluation:');
                const benchEval = result.judgement.benchmarkEvaluation;
                console.log(`   Type: ${benchEval.benchmarkType}`);
                console.log(`   Validator: ${benchEval.validator}`);
                console.log(`   Pass: ${benchEval.pass}`);
                console.log(`   Score: ${benchEval.score}`);
                console.log(`   Category: ${benchEval.category}`);
                console.log(`   Severity: ${benchEval.severity}`);
                console.log(`   Source: ${benchEval.source}\n`);
            }

            console.log('✅ Integration test PASSED!');
            console.log('\n📝 Next steps:');
            console.log('   1. Start eval run: POST /api/eval/runs/' + evalRun._id + '/start');
            console.log('   2. Get results: GET /api/eval/runs/' + evalRun._id + '/results');
            console.log('   3. Get stats: GET /api/eval/runs/' + evalRun._id + '/benchmark-stats\n');

        } catch (error) {
            console.error('❌ Evaluation failed:', error.message);
            console.error('\nFull error:', error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }

    process.exit(0);
}

testBenchmarkIntegration();
