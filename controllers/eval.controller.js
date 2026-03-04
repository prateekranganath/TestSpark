import { runEvaluation } from "../services/evalservice.js";
import { generateTestCases } from "../services/generatorservice.js";
import { llm_call } from "../services/llmservice.js";
import EvalRun from "../models/evalrun.js";
import TestCase from "../models/testcase.js";
import ModelResponse from "../models/modelresponse.js";
import Judgement from "../models/judgement.js";
import CustomEval from "../models/customeval.js";
import { getModelConfig } from "../services/sessionservice.js";
import { extractSessionId, requireReadyModel } from "../middleware/session.middleware.js";

// Create a new evaluation run
export const createEvalRun = async (req, res) => {
    try {
        const {
            runName,
            description,
            modelUnderTest,
            testCaseIds,
            configuration,
            tags
        } = req.body;

        // Validate required fields
        if (!runName || !modelUnderTest?.name || !testCaseIds?.length) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: runName, modelUnderTest.name, testCaseIds"
            });
        }

        // Create eval run with server-controlled judge model
        const evalRun = await EvalRun.create({
            runName,
            description,
            modelUnderTest,
            judgeModel: {
                name: process.env.JUDGE_MODEL || 'hf-judge-space',
                version: 'latest'
            },
            testCaseIds,
            configuration: configuration || {},
            tags: tags || [],
            metrics: {
                totalTestCases: testCaseIds.length
            }
        });

        res.status(201).json({
            success: true,
            data: evalRun
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Start an evaluation run
export const startEvalRun = async (req, res) => {
    try {
        const { evalRunId } = req.params;
        const { client, parameters, apiConfig, provider } = req.body; // Accept custom client, parameters, apiConfig, and provider

        const evalRun = await EvalRun.findById(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        if (evalRun.status === 'running') {
            return res.status(400).json({
                success: false,
                message: "Eval run is already running"
            });
        }

        // Update status to running
        evalRun.status = 'running';
        evalRun.startTime = new Date();
        await evalRun.save();

        // Run evaluations asynchronously with custom client/parameters/apiConfig
        runEvaluationBatch(
            evalRunId, 
            evalRun.testCaseIds, 
            evalRun.modelUnderTest.name,
            client,
            parameters,
            apiConfig,
            provider
        );

        res.status(200).json({
            success: true,
            message: "Evaluation run started",
            data: evalRun
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Helper function to run batch evaluations
async function runEvaluationBatch(evalRunId, testCaseIds, model, client, parameters, apiConfig, provider) {
    try {
        for (const testCaseId of testCaseIds) {
            try {
                await runEvaluation({ evalRunId, testCaseId, model, client, parameters, apiConfig, provider });
                console.log(`✓ Successfully evaluated test case ${testCaseId}`);
            } catch (error) {
                console.error(`✗ Failed to evaluate test case ${testCaseId}:`, error.message);
                console.error('Full error:', error);
            }
        }

        // Update eval run status
        const evalRun = await EvalRun.findById(evalRunId);
        if (evalRun) {
            evalRun.status = 'completed';
            evalRun.endTime = new Date();
            evalRun.duration = evalRun.endTime - evalRun.startTime;

            // Calculate average score
            const judgements = await Judgement.find({ evalRunId });
            if (judgements.length > 0) {
                const avgScore = judgements.reduce((sum, j) => sum + j.score, 0) / judgements.length;
                evalRun.metrics.averageScore = avgScore;
            }

            await evalRun.save();
        }
    } catch (error) {
        // Mark as failed
        await EvalRun.findByIdAndUpdate(evalRunId, { status: 'failed' });
        console.error(`Eval run ${evalRunId} failed:`, error.message);
    }
}

// Run single evaluation
export const runSingleEvaluation = async (req, res) => {
    try {
        const { evalRunId, testCaseId, model, client, parameters, apiConfig, provider } = req.body;

        if (!evalRunId || !testCaseId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: evalRunId, testCaseId"
            });
        }

        const result = await runEvaluation({ 
            evalRunId, 
            testCaseId, 
            model,
            client,
            parameters,
            apiConfig,
            provider
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get evaluation run status
export const getEvalRunStatus = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findById(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        res.status(200).json({
            success: true,
            data: evalRun
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get evaluation run results
export const getEvalRunResults = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findById(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        const modelResponses = await ModelResponse.find({ evalRunId });
        const judgements = await Judgement.find({ evalRunId }).populate('testCaseId');

        // Calculate benchmark-specific metrics
        const benchmarkMetrics = {};
        judgements.forEach(judgement => {
            if (judgement.benchmarkEvaluation && judgement.benchmarkEvaluation.benchmarkType) {
                const benchmarkType = judgement.benchmarkEvaluation.benchmarkType;
                
                if (!benchmarkMetrics[benchmarkType]) {
                    benchmarkMetrics[benchmarkType] = {
                        total: 0,
                        passed: 0,
                        failed: 0,
                        totalScore: 0,
                        categories: {}
                    };
                }
                
                benchmarkMetrics[benchmarkType].total++;
                if (judgement.benchmarkEvaluation.pass) {
                    benchmarkMetrics[benchmarkType].passed++;
                } else {
                    benchmarkMetrics[benchmarkType].failed++;
                }
                
                if (judgement.benchmarkEvaluation.score !== null) {
                    benchmarkMetrics[benchmarkType].totalScore += judgement.benchmarkEvaluation.score;
                }

                // Category breakdown
                const category = judgement.benchmarkEvaluation.category;
                if (category) {
                    if (!benchmarkMetrics[benchmarkType].categories[category]) {
                        benchmarkMetrics[benchmarkType].categories[category] = {
                            total: 0,
                            passed: 0
                        };
                    }
                    benchmarkMetrics[benchmarkType].categories[category].total++;
                    if (judgement.benchmarkEvaluation.pass) {
                        benchmarkMetrics[benchmarkType].categories[category].passed++;
                    }
                }
            }
        });

        // Calculate accuracy for each benchmark
        Object.keys(benchmarkMetrics).forEach(benchmark => {
            const metrics = benchmarkMetrics[benchmark];
            metrics.accuracy = metrics.total > 0 ? (metrics.passed / metrics.total) : 0;
            metrics.averageScore = metrics.total > 0 ? (metrics.totalScore / metrics.total) : 0;
            
            // Category accuracy
            Object.keys(metrics.categories).forEach(category => {
                const catMetrics = metrics.categories[category];
                catMetrics.accuracy = catMetrics.total > 0 ? (catMetrics.passed / catMetrics.total) : 0;
            });
        });

        res.status(200).json({
            success: true,
            data: {
                evalRun,
                modelResponses,
                judgements,
                benchmarkMetrics
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all evaluation runs
export const getAllEvalRuns = async (req, res) => {
    try {
        const { status, limit = 50, skip = 0 } = req.query;

        const query = status ? { status } : {};
        const evalRuns = await EvalRun.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        res.status(200).json({
            success: true,
            count: evalRuns.length,
            data: evalRuns
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete evaluation run
export const deleteEvalRun = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findByIdAndDelete(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        // Clean up associated data
        await ModelResponse.deleteMany({ evalRunId });
        await Judgement.deleteMany({ evalRunId });

        res.status(200).json({
            success: true,
            message: "Eval run deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get benchmark statistics for an evaluation run
export const getBenchmarkStatistics = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findById(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        const judgements = await Judgement.find({ evalRunId }).populate('testCaseId');

        // Build comprehensive benchmark statistics
        const statistics = {
            overall: {
                total: judgements.length,
                passed: 0,
                failed: 0,
                accuracy: 0
            },
            benchmarks: {}
        };

        judgements.forEach(judgement => {
            // Overall stats
            if (judgement.passed) statistics.overall.passed++;
            else statistics.overall.failed++;

            // Benchmark-specific stats
            if (judgement.benchmarkEvaluation && judgement.benchmarkEvaluation.benchmarkType) {
                const benchmarkType = judgement.benchmarkEvaluation.benchmarkType;
                
                if (!statistics.benchmarks[benchmarkType]) {
                    statistics.benchmarks[benchmarkType] = {
                        total: 0,
                        passed: 0,
                        failed: 0,
                        accuracy: 0,
                        averageScore: 0,
                        totalScore: 0,
                        averageConfidence: 0,
                        totalConfidence: 0,
                        confidenceCount: 0,
                        bySeverity: {},
                        byCategory: {},
                        failures: []
                    };
                }

                const bench = statistics.benchmarks[benchmarkType];
                bench.total++;

                if (judgement.benchmarkEvaluation.pass) {
                    bench.passed++;
                } else {
                    bench.failed++;
                    // Track failures for analysis
                    bench.failures.push({
                        testCaseId: judgement.testCaseId,
                        explanation: judgement.benchmarkEvaluation.explanation,
                        response: judgement.modelResponseId
                    });
                }

                // Score tracking
                if (judgement.benchmarkEvaluation.score !== null && judgement.benchmarkEvaluation.score !== undefined) {
                    bench.totalScore += judgement.benchmarkEvaluation.score;
                }

                // Confidence tracking
                if (judgement.benchmarkEvaluation.confidence !== null && judgement.benchmarkEvaluation.confidence !== undefined) {
                    bench.totalConfidence += judgement.benchmarkEvaluation.confidence;
                    bench.confidenceCount++;
                }

                // Severity breakdown
                const severity = judgement.benchmarkEvaluation.severity;
                if (severity) {
                    if (!bench.bySeverity[severity]) {
                        bench.bySeverity[severity] = { total: 0, passed: 0, accuracy: 0 };
                    }
                    bench.bySeverity[severity].total++;
                    if (judgement.benchmarkEvaluation.pass) {
                        bench.bySeverity[severity].passed++;
                    }
                }

                // Category breakdown
                const category = judgement.benchmarkEvaluation.category;
                if (category) {
                    if (!bench.byCategory[category]) {
                        bench.byCategory[category] = { total: 0, passed: 0, accuracy: 0 };
                    }
                    bench.byCategory[category].total++;
                    if (judgement.benchmarkEvaluation.pass) {
                        bench.byCategory[category].passed++;
                    }
                }
            }
        });

        // Calculate percentages and averages
        statistics.overall.accuracy = statistics.overall.total > 0 
            ? (statistics.overall.passed / statistics.overall.total * 100).toFixed(2) 
            : 0;

        Object.keys(statistics.benchmarks).forEach(benchmarkType => {
            const bench = statistics.benchmarks[benchmarkType];
            
            bench.accuracy = bench.total > 0 
                ? (bench.passed / bench.total * 100).toFixed(2) 
                : 0;
            
            bench.averageScore = bench.total > 0 
                ? (bench.totalScore / bench.total).toFixed(3) 
                : 0;
            
            bench.averageConfidence = bench.confidenceCount > 0 
                ? (bench.totalConfidence / bench.confidenceCount).toFixed(3) 
                : null;

            // Calculate severity accuracies
            Object.keys(bench.bySeverity).forEach(severity => {
                const sevStats = bench.bySeverity[severity];
                sevStats.accuracy = sevStats.total > 0 
                    ? (sevStats.passed / sevStats.total * 100).toFixed(2) 
                    : 0;
            });

            // Calculate category accuracies
            Object.keys(bench.byCategory).forEach(category => {
                const catStats = bench.byCategory[category];
                catStats.accuracy = catStats.total > 0 
                    ? (catStats.passed / catStats.total * 100).toFixed(2) 
                    : 0;
            });

            // Cleanup
            delete bench.totalScore;
            delete bench.totalConfidence;
            delete bench.confidenceCount;
        });

        res.status(200).json({
            success: true,
            data: {
                evalRunId: evalRunId,
                runName: evalRun.runName,
                status: evalRun.status,
                statistics
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Test model with complete benchmark validation and detailed judgement
export const testModelWithBenchmark = async (req, res) => {
    try {
        let { 
            testCaseId, 
            temperature = 0.1,
            client,
            parameters
        } = req.body;

        // =========================================
        // STRICT SESSION REQUIREMENT
        // =========================================
        
        // Extract sessionId from multiple sources
        const sessionId = extractSessionId(req);
        
        // HARD REQUIREMENT: sessionId must be present
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId is required',
                message: 'Benchmark testing requires an initialized model session',
                hint: 'Initialize a model first using POST /api/model/initialize, then pass sessionId',
                example: {
                    url: 'POST /api/eval/test-benchmark?sessionId=sess_xxx',
                    body: {
                        testCaseId: 'tc_aime_problem_123'
                    }
                }
            });
        }
        
        // Validate session exists AND model is ready (async MongoDB query)
        const sessionModel = await requireReadyModel(sessionId, res);
        if (!sessionModel) return; // Response already sent by requireReadyModel
        
        console.log(`📦 Using session model for benchmark: ${sessionModel.modelName}`);
        
        // Use session model configuration
        const modelName = sessionModel.modelName;
        const provider = 'hf-user-model';
        const apiConfig = {
            baseURL: sessionModel.baseUrl
        };
        
        console.log(`✅ Session model ready: ${provider}/${modelName}`);

        // Validate required fields
        if (!testCaseId) {
            return res.status(400).json({
                success: false,
                error: "testCaseId is required",
                message: "Provide a valid test case ID to run benchmark test"
            });
        }

        // Fetch test case
        const testCase = await TestCase.findById(testCaseId);
        if (!testCase) {
            return res.status(404).json({
                success: false,
                message: "Test case not found"
            });
        }

        console.log(`🧪 Testing model ${modelName} on test case ${testCaseId}`);
        console.log(`   Benchmark: ${testCase.metadata?.benchmarkType || 'general'}`);

        // Create a temporary eval run for this test
        const tempEvalRun = await EvalRun.create({
            runName: `Quick Test - ${modelName} - ${testCaseId}`,
            description: 'Single model benchmark test',
            modelUnderTest: {
                name: modelName,
                version: 'latest',
                provider: 'huggingface'
            },
            judgeModel: {
                name: process.env.JUDGE_MODEL || 'hf-judge-space',
                version: 'latest'
            },
            testCaseIds: [testCaseId],
            configuration: { temperature },
            tags: ['quick-test', 'benchmark-test'],
            metrics: { totalTestCases: 1 },
            status: 'running'
        });

        // Run the evaluation
        const startTime = Date.now();
        const result = await runEvaluation({
            evalRunId: tempEvalRun._id,
            testCaseId: testCaseId,
            model: modelName,
            client,
            parameters: parameters || { temperature },
            apiConfig,
            provider
        });
        const totalTime = Date.now() - startTime;

        // Mark eval run as completed
        await EvalRun.findByIdAndUpdate(tempEvalRun._id, {
            status: 'completed',
            endTime: new Date(),
            duration: totalTime
        });

        // Build detailed response
        const detailedJudgement = {
            testInfo: {
                testCaseId: testCaseId,
                prompt: testCase.prompt,
                expectedOutput: testCase.expectedOutput,
                benchmarkType: testCase.metadata?.benchmarkType || null,
                difficulty: testCase.metadata?.difficulty || null,
                category: testCase.metadata?.category || null,
                topic: testCase.metadata?.topic || null,
                domain: testCase.metadata?.domain || null
            },
            modelInfo: {
                name: modelName,
                temperature: temperature,
                responseTime: result.modelResponse.responseTime,
                tokensUsed: result.modelResponse.tokensUsed
            },
            modelResponse: {
                id: result.modelResponse._id,
                text: result.modelResponse.response,
                status: result.modelResponse.status
            },
            benchmarkValidation: null,
            generalJudgement: {
                id: result.judgement._id,
                score: result.judgement.score,
                maxScore: 10,
                passed: result.judgement.passed,
                reasoning: result.judgement.reasoning,
                criteria: result.judgement.criteria,
                feedback: result.judgement.feedback
            },
            finalVerdict: {
                overallPass: result.judgement.passed,
                overallScore: result.judgement.score,
                benchmarkPass: null,
                benchmarkScore: null,
                recommendation: null,
                summary: null
            },
            metadata: {
                evalRunId: tempEvalRun._id,
                executionTime: totalTime,
                timestamp: new Date()
            }
        };

        // Add benchmark validation details if present
        if (result.judgement.benchmarkEvaluation && result.judgement.benchmarkEvaluation.benchmarkType) {
            const benchEval = result.judgement.benchmarkEvaluation;
            
            detailedJudgement.benchmarkValidation = {
                benchmarkType: benchEval.benchmarkType,
                validator: benchEval.validator,
                source: benchEval.source,
                pass: benchEval.pass,
                score: benchEval.score,
                confidence: benchEval.confidence,
                category: benchEval.category,
                severity: benchEval.severity,
                explanation: benchEval.explanation
            };

            // Update final verdict with benchmark info
            detailedJudgement.finalVerdict.benchmarkPass = benchEval.pass;
            detailedJudgement.finalVerdict.benchmarkScore = benchEval.score;
            
            // Generate recommendation based on both judgements
            const benchmarkPassed = benchEval.pass;
            const generalPassed = result.judgement.passed;
            
            if (benchmarkPassed && generalPassed) {
                detailedJudgement.finalVerdict.recommendation = 'EXCELLENT';
                detailedJudgement.finalVerdict.summary = 'Model passed both benchmark validation and general quality assessment. Response is accurate and well-formed.';
            } else if (benchmarkPassed && !generalPassed) {
                detailedJudgement.finalVerdict.recommendation = 'GOOD';
                detailedJudgement.finalVerdict.summary = 'Model provided correct answer but response quality could be improved (coherence, completeness, or relevance issues).';
            } else if (!benchmarkPassed && generalPassed) {
                detailedJudgement.finalVerdict.recommendation = 'POOR';
                detailedJudgement.finalVerdict.summary = 'Response was well-formed but answer is incorrect. Model understood the question but arrived at wrong conclusion.';
            } else {
                detailedJudgement.finalVerdict.recommendation = 'FAILED';
                detailedJudgement.finalVerdict.summary = 'Model failed both benchmark validation and quality assessment. Answer is incorrect and response quality is inadequate.';
            }

            // Add severity-based insights
            if (benchEval.severity) {
                detailedJudgement.finalVerdict.difficultyNote = 
                    `This was a ${benchEval.severity} difficulty ${benchEval.benchmarkType.toUpperCase()} problem. ` +
                    (benchmarkPassed 
                        ? `The model successfully handled this ${benchEval.severity} level challenge.`
                        : `The model struggled with this ${benchEval.severity} level problem.`);
            }

            // Add confidence insights for LLM-judged benchmarks
            if (benchEval.confidence !== null && benchEval.confidence !== undefined) {
                const confidencePercent = (benchEval.confidence * 100).toFixed(1);
                detailedJudgement.finalVerdict.confidenceNote = 
                    `Judge confidence: ${confidencePercent}% - ` +
                    (benchEval.confidence >= 0.8 ? 'High confidence in evaluation.' :
                     benchEval.confidence >= 0.5 ? 'Moderate confidence in evaluation.' :
                     'Low confidence - answer may be ambiguous or require human review.');
            }
        } else {
            // No benchmark validation - use general judgement only
            detailedJudgement.finalVerdict.recommendation = result.judgement.passed ? 'PASSED' : 'FAILED';
            detailedJudgement.finalVerdict.summary = result.judgement.passed 
                ? 'Model passed general quality assessment. This is not a benchmark test case.'
                : 'Model failed general quality assessment. This is not a benchmark test case.';
        }

        // Calculate score percentage
        const scorePercentage = ((result.judgement.score / 10) * 100).toFixed(1);
        detailedJudgement.finalVerdict.scorePercentage = `${scorePercentage}%`;

        res.status(200).json({
            success: true,
            testInfo: detailedJudgement.testInfo,
            modelResponse: detailedJudgement.modelResponse,
            generalJudgement: detailedJudgement.generalJudgement
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            error: error.stack
        });
    }
};

// Comprehensive test: Generate test cases + Test all benchmarks
export const comprehensiveModelTest = async (req, res) => {
    try {
        const {
            userPrompt,
            temperature = 0.1,
            samplesPerBenchmark = 3
        } = req.body;

        const sessionId = extractSessionId(req);
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });

        const sessionModel = await requireReadyModel(sessionId, res);
        if (!sessionModel) return;

        const modelName = sessionModel.modelName;
        const provider = 'hf-user-model';
        const apiConfig = { baseURL: sessionModel.baseUrl };

        // Validate required fields
        if (!userPrompt) {
            return res.status(400).json({
                success: false,
                message: "Missing required field: userPrompt"
            });
        }

        console.log(`🚀 Starting comprehensive test for ${modelName}`);
        console.log(`📝 User prompt: ${userPrompt.substring(0, 100)}...`);

        const startTime = Date.now();
        const results = {
            modelName,
            userPrompt,
            timestamp: new Date(),
            generatedTests: {
                total: 0,
                passed: 0,
                failed: 0,
                byType: {},
                details: []
            },
            benchmarkTests: {
                total: 0,
                passed: 0,
                failed: 0,
                byBenchmark: {
                    aime: { total: 0, passed: 0, failed: 0, accuracy: 0, details: [] },
                    mmlu: { total: 0, passed: 0, failed: 0, accuracy: 0, details: [] },
                    msur: { total: 0, passed: 0, failed: 0, accuracy: 0, details: [] }
                }
            },
            overallPerformance: {
                totalTests: 0,
                totalPassed: 0,
                totalFailed: 0,
                overallAccuracy: 0,
                averageScore: 0,
                totalScore: 0
            },
            executionTime: 0,
            evalRunId: null
        };

        // Create eval run for tracking
        const evalRun = await EvalRun.create({
            runName: `Comprehensive Test - ${modelName} - ${new Date().toISOString()}`,
            description: `Generated tests + All benchmarks test for: ${userPrompt.substring(0, 100)}`,
            modelUnderTest: { name: modelName, version: 'latest', provider: 'huggingface' },
            judgeModel: { name: process.env.JUDGE_MODEL || 'hf-judge-space', version: 'latest' },
            testCaseIds: [],
            configuration: { temperature },
            tags: ['comprehensive-test', 'generated', 'benchmarks'],
            metrics: { totalTestCases: 0 },
            status: 'running'
        });

        results.evalRunId = evalRun._id;

        // ============= PHASE 1: GENERATE TEST CASES =============
        console.log('\n📋 Phase 1: Generating test cases from user prompt...');
        
        // First, create a parent test case from user prompt
        const parentTestCase = await TestCase.create({
            _id: `parent_${Date.now()}`,
            prompt: userPrompt,
            generatedBy: 'user',
            metadata: { category: 'user_generated', tags: ['parent', 'comprehensive-test'] }
        });

        // Generate variants: ambiguity, contradiction, negation
        const generationTypes = ['ambiguity', 'contradiction', 'negation'];
        let generatedTestCases = [];

        try {
            generatedTestCases = await generateTestCases({
                parentPromptId: parentTestCase._id,
                types: generationTypes,
                perType: 1
            });
            console.log(`✓ Generated ${generatedTestCases.length} test case variants`);
        } catch (error) {
            console.error('Failed to generate test cases:', error.message);
        }

        // Test model on generated cases (including parent)
        const allGeneratedCases = [parentTestCase, ...generatedTestCases];
        
        for (const testCase of allGeneratedCases) {
            try {
                const result = await runEvaluation({
                    evalRunId: evalRun._id,
                    testCaseId: testCase._id,
                    model: modelName,
                    parameters: { temperature },
                    apiConfig,
                    provider
                });

                const testType = testCase._id === parentTestCase._id ? 'original' : testCase.generationType;
                const passed = result.judgement.passed;

                if (!results.generatedTests.byType[testType]) {
                    results.generatedTests.byType[testType] = {
                        total: 0,
                        passed: 0,
                        failed: 0,
                        accuracy: 0
                    };
                }

                results.generatedTests.byType[testType].total++;
                results.generatedTests.total++;
                
                if (passed) {
                    results.generatedTests.passed++;
                    results.generatedTests.byType[testType].passed++;
                } else {
                    results.generatedTests.failed++;
                    results.generatedTests.byType[testType].failed++;
                }

                results.generatedTests.details.push({
                    testCaseId: testCase._id,
                    type: testType,
                    prompt: testCase.prompt.substring(0, 150) + '...',
                    passed: passed,
                    score: result.judgement.score,
                    reasoning: result.judgement.reasoning,
                    responseTime: result.modelResponse.responseTime
                });

                console.log(`  ✓ ${testType}: ${passed ? 'PASSED' : 'FAILED'} (${result.judgement.score}/10)`);

            } catch (error) {
                console.error(`  ✗ Failed to evaluate ${testCase._id}:`, error.message);
                results.generatedTests.failed++;
                results.generatedTests.total++;
            }
        }

        // Calculate accuracies for generated tests
        Object.keys(results.generatedTests.byType).forEach(type => {
            const typeStats = results.generatedTests.byType[type];
            typeStats.accuracy = typeStats.total > 0 
                ? ((typeStats.passed / typeStats.total) * 100).toFixed(2) 
                : 0;
        });

        // ============= PHASE 2: BENCHMARK TESTING =============
        console.log('\n🎯 Phase 2: Testing on all benchmarks...');

        // Get sample test cases from each benchmark
        const aimeSamples = await TestCase.find({ 'metadata.benchmarkType': 'aime' })
            .limit(samplesPerBenchmark);
        const mmluSamples = await TestCase.find({ 'metadata.benchmarkType': 'mmlu' })
            .limit(samplesPerBenchmark);
        const msurSamples = await TestCase.find({ 'metadata.benchmarkType': 'msur' })
            .limit(samplesPerBenchmark);

        console.log(`  Found: ${aimeSamples.length} AIME, ${mmluSamples.length} MMLU, ${msurSamples.length} MSUR samples`);

        // Test AIME
        for (const testCase of aimeSamples) {
            await testBenchmarkCase(testCase, 'aime', modelName, evalRun._id, results, { temperature }, apiConfig, provider);
        }

        // Test MMLU
        for (const testCase of mmluSamples) {
            await testBenchmarkCase(testCase, 'mmlu', modelName, evalRun._id, results, { temperature }, apiConfig, provider);
        }

        // Test MSUR
        for (const testCase of msurSamples) {
            await testBenchmarkCase(testCase, 'msur', modelName, evalRun._id, results, { temperature }, apiConfig, provider);
        }

        // Calculate benchmark accuracies
        ['aime', 'mmlu', 'msur'].forEach(benchmark => {
            const benchStats = results.benchmarkTests.byBenchmark[benchmark];
            benchStats.accuracy = benchStats.total > 0 
                ? ((benchStats.passed / benchStats.total) * 100).toFixed(2) 
                : 0;
        });

        // ============= PHASE 3: CALCULATE OVERALL PERFORMANCE =============
        results.overallPerformance.totalTests = results.generatedTests.total + results.benchmarkTests.total;
        results.overallPerformance.totalPassed = results.generatedTests.passed + results.benchmarkTests.passed;
        results.overallPerformance.totalFailed = results.generatedTests.failed + results.benchmarkTests.failed;
        
        if (results.overallPerformance.totalTests > 0) {
            results.overallPerformance.overallAccuracy = 
                ((results.overallPerformance.totalPassed / results.overallPerformance.totalTests) * 100).toFixed(2);
        }

        // Calculate average score from all judgements
        const allJudgements = await Judgement.find({ evalRunId: evalRun._id });
        if (allJudgements.length > 0) {
            results.overallPerformance.totalScore = allJudgements.reduce((sum, j) => sum + j.score, 0);
            results.overallPerformance.averageScore = 
                (results.overallPerformance.totalScore / allJudgements.length).toFixed(2);
        }

        results.executionTime = Date.now() - startTime;

        // Update eval run
        await EvalRun.findByIdAndUpdate(evalRun._id, {
            status: 'completed',
            endTime: new Date(),
            duration: results.executionTime,
            'metrics.totalTestCases': results.overallPerformance.totalTests,
            'metrics.passed': results.overallPerformance.totalPassed,
            'metrics.failed': results.overallPerformance.totalFailed,
            'metrics.averageScore': results.overallPerformance.averageScore
        });

        // ============= GENERATE DETAILED JUDGEMENT =============
        const detailedJudgement = {
            summary: {
                modelName,
                overallVerdict: generateOverallVerdict(results),
                totalTests: results.overallPerformance.totalTests,
                accuracy: `${results.overallPerformance.overallAccuracy}%`,
                averageScore: `${results.overallPerformance.averageScore}/10`,
                executionTime: `${(results.executionTime / 1000).toFixed(2)}s`,
                timestamp: results.timestamp
            },
            generatedTestsPerformance: {
                summary: `Passed ${results.generatedTests.passed}/${results.generatedTests.total} generated test cases`,
                accuracy: results.generatedTests.total > 0 
                    ? `${((results.generatedTests.passed / results.generatedTests.total) * 100).toFixed(2)}%` 
                    : 'N/A',
                byType: results.generatedTests.byType,
                details: results.generatedTests.details,
                insights: generateGeneratedTestsInsights(results.generatedTests)
            },
            benchmarkPerformance: {
                summary: `Passed ${results.benchmarkTests.passed}/${results.benchmarkTests.total} benchmark tests`,
                accuracy: results.benchmarkTests.total > 0 
                    ? `${((results.benchmarkTests.passed / results.benchmarkTests.total) * 100).toFixed(2)}%` 
                    : 'N/A',
                aime: {
                    ...results.benchmarkTests.byBenchmark.aime,
                    accuracy: `${results.benchmarkTests.byBenchmark.aime.accuracy}%`
                },
                mmlu: {
                    ...results.benchmarkTests.byBenchmark.mmlu,
                    accuracy: `${results.benchmarkTests.byBenchmark.mmlu.accuracy}%`
                },
                msur: {
                    ...results.benchmarkTests.byBenchmark.msur,
                    accuracy: `${results.benchmarkTests.byBenchmark.msur.accuracy}%`
                },
                insights: generateBenchmarkInsights(results.benchmarkTests)
            },
            recommendations: generateRecommendations(results),
            strengths: identifyStrengths(results),
            weaknesses: identifyWeaknesses(results),
            metadata: {
                evalRunId: evalRun._id,
                userPrompt: userPrompt,
                modelConfig: { name: modelName, temperature },
                testingScope: {
                    generatedTests: generationTypes,
                    benchmarks: ['AIME', 'MMLU', 'MSUR'],
                    samplesPerBenchmark
                }
            }
        };

        console.log(`\n✅ Comprehensive test completed in ${(results.executionTime / 1000).toFixed(2)}s`);
        console.log(`   Overall: ${results.overallPerformance.totalPassed}/${results.overallPerformance.totalTests} passed (${results.overallPerformance.overallAccuracy}%)`);

        res.status(200).json({
            success: true,
            data: detailedJudgement
        });

    } catch (error) {
        console.error('❌ Comprehensive test failed:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: error.stack
        });
    }
};

// Helper function to test a benchmark case
async function testBenchmarkCase(testCase, benchmarkType, modelName, evalRunId, results, parameters, apiConfig, provider) {
    try {
        const result = await Promise.race([
            runEvaluation({
                evalRunId,
                testCaseId: testCase._id,
                model: modelName,
                parameters,
                apiConfig,
                provider
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Evaluation timeout")), 90000)
            )
        ]);

        const benchEval = result.judgement.benchmarkEvaluation;
        const passed = benchEval ? benchEval.pass : result.judgement.passed;

        results.benchmarkTests.byBenchmark[benchmarkType].total++;
        results.benchmarkTests.total++;

        if (passed) {
            results.benchmarkTests.byBenchmark[benchmarkType].passed++;
            results.benchmarkTests.passed++;
        } else {
            results.benchmarkTests.byBenchmark[benchmarkType].failed++;
            results.benchmarkTests.failed++;
        }

        results.benchmarkTests.byBenchmark[benchmarkType].details.push({
            testCaseId: testCase._id,
            prompt: testCase.prompt.substring(0, 100) + '...',
            difficulty: testCase.metadata?.difficulty || 'N/A',
            passed: passed,
            benchmarkScore: benchEval?.score || null,
            generalScore: result.judgement.score,
            explanation: benchEval?.explanation || result.judgement.reasoning
        });

        console.log(`  ✓ ${benchmarkType.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
        console.error(`  ✗ Failed ${benchmarkType} test:`, error.message);
        results.benchmarkTests.byBenchmark[benchmarkType].failed++;
        results.benchmarkTests.failed++;
        results.benchmarkTests.total++;
    }
}

// Helper: Generate overall verdict
function generateOverallVerdict(results) {
    const accuracy = parseFloat(results.overallPerformance.overallAccuracy);
    const avgScore = parseFloat(results.overallPerformance.averageScore);

    if (accuracy >= 90 && avgScore >= 8.5) return 'EXCEPTIONAL';
    if (accuracy >= 80 && avgScore >= 8.0) return 'EXCELLENT';
    if (accuracy >= 70 && avgScore >= 7.0) return 'GOOD';
    if (accuracy >= 60 && avgScore >= 6.0) return 'SATISFACTORY';
    if (accuracy >= 50) return 'NEEDS IMPROVEMENT';
    return 'POOR';
}

// Helper: Generate insights for generated tests
function generateGeneratedTestsInsights(genTests) {
    const insights = [];
    
    if (genTests.total === 0) {
        return ['No generated test cases were evaluated'];
    }

    Object.keys(genTests.byType).forEach(type => {
        const stats = genTests.byType[type];
        const acc = parseFloat(stats.accuracy);
        
        if (acc >= 80) {
            insights.push(`Strong performance on ${type} variants (${stats.accuracy}%)`);
        } else if (acc < 50) {
            insights.push(`Struggles with ${type} variants (${stats.accuracy}%) - needs improvement`);
        }
    });

    return insights.length > 0 ? insights : ['Mixed performance across test variants'];
}

// Helper: Generate insights for benchmarks
function generateBenchmarkInsights(benchTests) {
    const insights = [];
    
    ['aime', 'mmlu', 'msur'].forEach(benchmark => {
        const stats = benchTests.byBenchmark[benchmark];
        if (stats.total === 0) return;
        
        const acc = parseFloat(stats.accuracy);
        const name = benchmark.toUpperCase();
        
        if (acc >= 80) {
            insights.push(`Excellent ${name} performance (${stats.accuracy}%)`);
        } else if (acc < 50) {
            insights.push(`Weak ${name} performance (${stats.accuracy}%) - major concern`);
        }
    });

    return insights.length > 0 ? insights : ['Average performance across benchmarks'];
}

// Helper: Generate recommendations
function generateRecommendations(results) {
    const recommendations = [];
    const overallAcc = parseFloat(results.overallPerformance.overallAccuracy);

    if (overallAcc < 70) {
        recommendations.push('Consider using a more powerful model or adjusting temperature');
    }

    Object.keys(results.generatedTests.byType).forEach(type => {
        const acc = parseFloat(results.generatedTests.byType[type].accuracy);
        if (acc < 60) {
            recommendations.push(`Improve handling of ${type} test cases through targeted training`);
        }
    });

    ['aime', 'mmlu', 'msur'].forEach(benchmark => {
        const stats = results.benchmarkTests.byBenchmark[benchmark];
        if (stats.total > 0 && parseFloat(stats.accuracy) < 60) {
            recommendations.push(`Focus on ${benchmark.toUpperCase()} benchmark improvement`);
        }
    });

    if (recommendations.length === 0) {
        recommendations.push('Model performs well overall - continue current approach');
    }

    return recommendations;
}

// Helper: Identify strengths
function identifyStrengths(results) {
    const strengths = [];

    Object.keys(results.generatedTests.byType).forEach(type => {
        const acc = parseFloat(results.generatedTests.byType[type].accuracy);
        if (acc >= 80) {
            strengths.push(`${type.charAt(0).toUpperCase() + type.slice(1)} handling (${acc}%)`);
        }
    });

    ['aime', 'mmlu', 'msur'].forEach(benchmark => {
        const stats = results.benchmarkTests.byBenchmark[benchmark];
        if (stats.total > 0 && parseFloat(stats.accuracy) >= 80) {
            strengths.push(`${benchmark.toUpperCase()} benchmarks (${stats.accuracy}%)`);
        }
    });

    return strengths.length > 0 ? strengths : ['Consistent baseline performance'];
}

// Helper: Identify weaknesses
function identifyWeaknesses(results) {
    const weaknesses = [];

    Object.keys(results.generatedTests.byType).forEach(type => {
        const acc = parseFloat(results.generatedTests.byType[type].accuracy);
        if (acc < 60) {
            weaknesses.push(`${type.charAt(0).toUpperCase() + type.slice(1)} variants (${acc}%)`);
        }
    });

    ['aime', 'mmlu', 'msur'].forEach(benchmark => {
        const stats = results.benchmarkTests.byBenchmark[benchmark];
        if (stats.total > 0 && parseFloat(stats.accuracy) < 60) {
            weaknesses.push(`${benchmark.toUpperCase()} performance (${stats.accuracy}%)`);
        }
    });

    return weaknesses.length > 0 ? weaknesses : ['No significant weaknesses detected'];
}

// Test custom model endpoint - supports any model with custom client
export const testCustomModel = async (req, res) => {
    try {
        const { 
            modelName,
            testCaseId,
            client,
            parameters
        } = req.body;

        // Validate required fields
        if (!modelName || !testCaseId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: modelName, testCaseId"
            });
        }

        // Fetch test case
        const testCase = await TestCase.findById(testCaseId);
        if (!testCase) {
            return res.status(404).json({
                success: false,
                message: "Test case not found"
            });
        }

        console.log(`🚀 Testing custom model: ${modelName}`);
        console.log(`   Test Case: ${testCaseId}`);
        console.log(`   Custom Client: ${client ? 'Yes' : 'Default'}`);
        console.log(`   Benchmark: ${testCase.metadata?.benchmarkType || 'general'}`);

        // Create a temporary eval run
        const tempEvalRun = await EvalRun.create({
            runName: `Custom Model Test - ${modelName} - ${Date.now()}`,
            description: `Testing custom model ${modelName} with ${client ? 'custom' : 'default'} client`,
            modelUnderTest: {
                name: modelName,
                version: parameters?.version || 'latest'
            },
            judgeModel: {
                name: process.env.JUDGE_MODEL || 'hf-judge-space',
                version: 'latest'
            },
            testCaseIds: [testCaseId],
            configuration: { 
                temperature: parameters?.temperature || 0.7,
                customClient: !!client
            },
            tags: ['custom-model', 'api-test'],
            metrics: { totalTestCases: 1 },
            status: 'running'
        });

        // Run evaluation with custom adapter
        const startTime = Date.now();
        const result = await runEvaluation({
            evalRunId: tempEvalRun._id,
            testCaseId: testCaseId,
            model: modelName,
            client: client,
            parameters: parameters || {}
        });
        const totalTime = Date.now() - startTime;

        // Mark eval run as completed
        await EvalRun.findByIdAndUpdate(tempEvalRun._id, {
            status: 'completed',
            endTime: new Date(),
            duration: totalTime
        });

        // Build response
        res.status(200).json({
            success: true,
            data: {
                evalRunId: tempEvalRun._id,
                testInfo: {
                    testCaseId: testCaseId,
                    prompt: testCase.prompt.substring(0, 200) + (testCase.prompt.length > 200 ? '...' : ''),
                    benchmarkType: testCase.metadata?.benchmarkType || null
                },
                modelInfo: {
                    name: modelName,
                    customClient: !!client,
                    parameters: parameters || {},
                    responseTime: result.modelResponse.responseTime,
                    tokensUsed: result.modelResponse.tokensUsed
                },
                modelResponse: {
                    id: result.modelResponse._id,
                    text: result.modelResponse.response,
                    status: result.modelResponse.status
                },
                judgement: {
                    id: result.judgement._id,
                    score: result.judgement.score,
                    passed: result.judgement.passed,
                    reasoning: result.judgement.reasoning,
                    benchmarkValidation: result.judgement.benchmarkEvaluation || null
                },
                totalTime: totalTime
            },
            message: `Successfully tested ${modelName} on test case`
        });

    } catch (error) {
        console.error('Custom model test error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: error.stack
        });
    }
};

/**
 * Custom Dataset Evaluation
 * User provides their own dataset and we test the model on it
 * POST /api/eval/custom-dataset
 * 
 * REQUIRES: sessionId (query param, header, or body)
 * The session model must be initialized and ready
 */
export const customDatasetEval = async (req, res) => {
    try {
        console.log('Custom dataset evaluation started');
        
        // Extract request body
        let {
            dataset,
            evaluationType = 'exact_match',
            temperature = 0.7,
            max_tokens = 512
        } = req.body;

        // =========================================
        // STRICT SESSION REQUIREMENT
        // =========================================
        
        // Extract sessionId from multiple sources
        const sessionId = extractSessionId(req);
        
        // HARD REQUIREMENT: sessionId must be present
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId is required',
                message: 'Evaluation requires an initialized model session',
                hint: 'Initialize a model first using POST /api/model/initialize, then pass sessionId',
                example: {
                    url: 'POST /api/eval/custom-dataset?sessionId=sess_xxx',
                    body: {
                        dataset: [{ input: 'question', expected: 'answer' }]
                    }
                }
            });
        }
        
        // Validate session exists AND model is ready (async MongoDB query)
        const sessionModel = await requireReadyModel(sessionId, res);
        if (!sessionModel) return; // Response already sent by requireReadyModel
        
        console.log(`📦 Using session model: ${sessionModel.modelName}`);
        
        // Use session model configuration
        const modelName = sessionModel.modelName;
        const provider = 'hf-user-model';
        const apiConfig = {
            baseURL: sessionModel.baseUrl
        };
        
        console.log(`✅ Session model ready: ${provider}/${modelName}`);

        // =========================================
        // DATASET VALIDATION
        // =========================================

        // Validate dataset structure
        if (!dataset) {
            return res.status(400).json({
                success: false,
                error: "dataset is required",
                format: "Array of objects with 'input' and 'expected' fields",
                example: [
                    { input: "What is 2+2?", expected: "4" },
                    { input: "Capital of France?", expected: "Paris" }
                ]
            });
        }

        if (!Array.isArray(dataset)) {
            return res.status(400).json({
                success: false,
                error: "dataset must be an array",
                received: typeof dataset
            });
        }

        if (dataset.length === 0) {
            return res.status(400).json({
                success: false,
                error: "dataset cannot be empty. Provide at least one test case."
            });
        }

        // Render timeout protection: max 10 examples for stability
        if (dataset.length > 10) {
            return res.status(400).json({
                success: false,
                error: `Dataset too large. Maximum 10 examples allowed for demo. You provided ${dataset.length}.`,
                tip: "For larger datasets, consider batching requests or contact us for enterprise solutions.",
                limit: 10,
                provided: dataset.length
            });
        }

        // Validate each dataset item
        for (let i = 0; i < dataset.length; i++) {
            const item = dataset[i];
            
            if (!item || typeof item !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: `Invalid item at index ${i}. Each item must be an object.`,
                    receivedType: typeof item
                });
            }

            if (!item.input || typeof item.input !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: `Missing or invalid 'input' field at index ${i}`,
                    example: { input: "your question", expected: "expected answer" }
                });
            }

            if (!item.expected || typeof item.expected !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: `Missing or invalid 'expected' field at index ${i}`,
                    example: { input: "your question", expected: "expected answer" }
                });
            }
        }

        // Validate provider
        if (provider && !['hf-user-model', 'openai', 'anthropic', 'together', 'custom'].includes(provider)) {
            return res.status(400).json({
                success: false,
                error: "Invalid provider",
                validProviders: ['hf-user-model', 'openai', 'anthropic', 'together', 'custom']
            });
        }

        // Validate apiConfig if needed
        if (provider !== 'hf-user-model' && !apiConfig) {
            return res.status(400).json({
                success: false,
                error: "apiConfig is required when not using hf-user-model provider",
                example: {
                    apiConfig: {
                        baseURL: "https://api.openai.com/v1",
                        apiKey: "your-api-key"
                    }
                }
            });
        }

        // Validate evaluation type
        if (!['exact_match', 'contains', 'llm_judge'].includes(evaluationType)) {
            return res.status(400).json({
                success: false,
                error: "Invalid evaluationType",
                validTypes: ['exact_match', 'contains', 'llm_judge']
            });
        }

        console.log(`Validated: Model=${modelName}, Provider=${provider || 'hf-user-model'}, Dataset size=${dataset.length}, EvalType=${evaluationType}`);

        // =========================================
        // PROCESS DATASET
        // =========================================
        
        const results = [];
        let passed = 0;
        let failed = 0;
        const startTime = Date.now();

        for (let i = 0; i < dataset.length; i++) {
            const item = dataset[i];
            
            try {
                console.log(`Processing item ${i + 1}/${dataset.length}: ${item.input.substring(0, 50)}...`);
                
                // Call model with the input
                const modelResponse = await llm_call({
                    model: modelName,
                    messages: [{ role: "user", content: item.input }],
                    provider: provider,
                    apiConfig: apiConfig,
                    temperature: temperature,
                    max_tokens: max_tokens
                });

                const actualOutput = modelResponse.text.trim();
                const expectedOutput = item.expected.trim();
                
                // Evaluate based on type
                let evaluation;
                
                if (evaluationType === 'exact_match') {
                    // Case-insensitive exact match
                    const match = actualOutput.toLowerCase() === expectedOutput.toLowerCase();
                    evaluation = {
                        passed: match,
                        score: match ? 1.0 : 0.0,
                        method: 'exact_match'
                    };
                    
                } else if (evaluationType === 'contains') {
                    // Check if expected is contained in actual
                    const match = actualOutput.toLowerCase().includes(expectedOutput.toLowerCase());
                    evaluation = {
                        passed: match,
                        score: match ? 1.0 : 0.0,
                        method: 'contains'
                    };
                    
                } else if (evaluationType === 'llm_judge') {
                    // Use LLM judge for semantic evaluation
                    evaluation = await evaluateWithLLMJudge(item.input, expectedOutput, actualOutput);
                    evaluation.method = 'llm_judge';
                }

                // Update counters
                if (evaluation.passed) {
                    passed++;
                } else {
                    failed++;
                }

                // Store result
                results.push({
                    index: i + 1,
                    input: item.input,
                    expected: expectedOutput,
                    actual: actualOutput,
                    passed: evaluation.passed,
                    score: evaluation.score,
                    evaluationMethod: evaluation.method,
                    reasoning: evaluation.reasoning || null
                });

            } catch (itemError) {
                console.error(`Error processing item ${i}:`, itemError.message);
                failed++;
                
                results.push({
                    index: i + 1,
                    input: item.input,
                    expected: item.expected,
                    error: itemError.message,
                    passed: false,
                    score: 0
                });
            }
        }

        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        const accuracy = dataset.length > 0 ? ((passed / dataset.length) * 100).toFixed(1) : 0;

        // =========================================
        // SAVE TO DATABASE
        // =========================================
        
        const customEvalRecord = await CustomEval.create({
            modelName: modelName,
            provider: provider || 'hf-user-model',
            evaluationType: evaluationType,
            datasetSize: dataset.length,
            results: {
                total: dataset.length,
                passed: passed,
                failed: failed,
                accuracy: parseFloat(accuracy)
            },
            individualResults: results,
            completedAt: new Date(),
            status: 'completed'
        });

        console.log(`Custom evaluation completed: ${passed}/${dataset.length} passed (${accuracy}%)`);

        // =========================================
        // RETURN RESPONSE
        // =========================================
        
        return res.status(200).json({
            success: true,
            evaluationId: customEvalRecord._id,
            summary: {
                total: dataset.length,
                passed: passed,
                failed: failed,
                accuracy: `${accuracy}%`,
                totalTime: `${totalTime}s`
            },
            model: {
                name: modelName,
                provider: provider || 'hf-user-model'
            },
            evaluationType: evaluationType,
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Custom dataset evaluation error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Helper: Evaluate with LLM Judge
 */
async function evaluateWithLLMJudge(input, expected, actual) {
    try {
        const judgePrompt = `You are evaluating a model's response for correctness.

Original Question: ${input}

Expected Answer: ${expected}

Model's Answer: ${actual}

Instructions:
- Determine if the model's answer is semantically correct
- Consider the core meaning, not exact wording
- Give partial credit for partially correct answers
- Be fair and objective

Output JSON only:
{
  "correct": true/false,
  "score": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

        if (!process.env.HF_JUDGE_SPACE_ENDPOINT) {
            throw new Error("HF_JUDGE_SPACE_ENDPOINT is not configured");
        }

        console.log("HF_JUDGE_SPACE_ENDPOINT:", process.env.HF_JUDGE_SPACE_ENDPOINT);

        const judgeResponse = await llm_call({
            model: process.env.JUDGE_MODEL || "judge-model",
            messages: [
                { role: "system", content: "You are an impartial evaluator. Return only valid JSON." },
                { role: "user", content: judgePrompt }
            ],
            temperature: 0,
            provider: 'hf-space',
            apiConfig: {
                baseURL: process.env.HF_JUDGE_SPACE_ENDPOINT
            },
            adapter: 'base'
        });

        // Try to parse JSON response
        let parsed;
        try {
            const jsonMatch = judgeResponse.text.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : judgeResponse.text);
        } catch (parseError) {
            // Fallback if JSON parsing fails
            console.warn('LLM judge returned non-JSON, using fallback');
            return {
                passed: false,
                score: 0,
                reasoning: "Judge failed to return valid JSON"
            };
        }

        return {
            passed: parsed.correct === true,
            score: parsed.score || (parsed.correct ? 1.0 : 0.0),
            reasoning: parsed.reasoning || "LLM judge evaluation"
        };

    } catch (error) {
        console.error('LLM judge error:', error.message);
        // Fallback to exact match
        const match = actual.toLowerCase().includes(expected.toLowerCase());
        return {
            passed: match,
            score: match ? 0.8 : 0,
            reasoning: "Judge unavailable, used fallback matching"
        };
    }
}

/**
 * Get dashboard statistics
 * GET /api/dashboard or /api/eval/dashboard
 */
export const getDashboardStats = async (req, res) => {
    try {
        const runs = await EvalRun.find().sort({ createdAt: -1 }).limit(100);
        
        const totalRuns = runs.length;
        const completedRuns = runs.filter(r => r.summary).length;
        const activeRuns = totalRuns - completedRuns;
        
        // Calculate average accuracy
        const runsWithAccuracy = runs.filter(r => r.summary?.accuracy);
        const avgAccuracy = runsWithAccuracy.length > 0
            ? runsWithAccuracy.reduce((sum, r) => {
                const acc = parseFloat(r.summary.accuracy.replace('%', ''));
                return sum + acc;
            }, 0) / runsWithAccuracy.length
            : 0;

        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentRuns = runs.filter(r => new Date(r.createdAt) > sevenDaysAgo);

        res.json({
            success: true,
            data: {
                totalRuns,
                completedRuns,
                activeRuns,
                averageAccuracy: `${avgAccuracy.toFixed(1)}%`,
                recentActivity: recentRuns.length,
                lastRunTime: runs[0]?.createdAt || null
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Compare models across all evaluation runs
 * GET /api/compare or /api/eval/compare
 */
export const compareModels = async (req, res) => {
    try {
        const runs = await EvalRun.find().sort({ createdAt: -1 });
        
        // Group by model
        const modelStats = {};
        
        runs.forEach(run => {
            const modelKey = `${run.model.provider}:${run.model.name}`;
            
            if (!modelStats[modelKey]) {
                modelStats[modelKey] = {
                    modelName: run.model.name,
                    provider: run.model.provider,
                    totalRuns: 0,
                    totalTests: 0,
                    totalPassed: 0,
                    averageAccuracy: 0,
                    lastRun: null
                };
            }
            
            modelStats[modelKey].totalRuns++;
            if (run.summary) {
                modelStats[modelKey].totalTests += run.summary.total || 0;
                modelStats[modelKey].totalPassed += run.summary.passed || 0;
            }
            
            // Track most recent run
            if (!modelStats[modelKey].lastRun || new Date(run.createdAt) > new Date(modelStats[modelKey].lastRun)) {
                modelStats[modelKey].lastRun = run.createdAt;
            }
        });
        
        // Calculate average accuracy for each model
        Object.keys(modelStats).forEach(key => {
            const stats = modelStats[key];
            stats.averageAccuracy = stats.totalTests > 0
                ? ((stats.totalPassed / stats.totalTests) * 100).toFixed(1) + '%'
                : '0%';
        });
        
        res.json({
            success: true,
            data: {
                models: Object.values(modelStats).sort((a, b) => {
                    const accA = parseFloat(a.averageAccuracy.replace('%', ''));
                    const accB = parseFloat(b.averageAccuracy.replace('%', ''));
                    return accB - accA; // Sort by accuracy descending
                })
            }
        });
    } catch (error) {
        console.error('Model comparison error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Run Full Benchmark Suite
 * Evaluate session model on ALL problems from a specific benchmark
 * POST /api/eval/test-benchmark
 * 
 * REQUIRES: sessionId (query param, header, or body)
 * REQUIRES: benchmarkType (AIME, MMLU, or MSUR)
 */
export const runBenchmarkSuite = async (req, res) => {
    try {
        console.log('Benchmark suite evaluation started');
        
        // Extract sessionId from multiple sources
        const sessionId = extractSessionId(req);
        
        // HARD REQUIREMENT: sessionId must be present
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId is required',
                message: 'Benchmark evaluation requires an initialized model session',
                hint: 'Initialize a model first using POST /api/model/initialize, then pass sessionId'
            });
        }
        
        // Validate session exists AND model is ready (async MongoDB query)
        const sessionModel = await requireReadyModel(sessionId, res);
        if (!sessionModel) return; // Response already sent by requireReadyModel
        
        // Extract benchmarkType from request body
        const { benchmarkType } = req.body;
        
        if (!benchmarkType) {
            return res.status(400).json({
                success: false,
                error: 'benchmarkType is required',
                message: 'Specify which benchmark to run',
                options: ['AIME', 'MMLU', 'MSUR']
            });
        }
        
        // Validate benchmarkType
        const validBenchmarks = ['AIME', 'MMLU', 'MSUR'];
        if (!validBenchmarks.includes(benchmarkType.toUpperCase())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid benchmarkType',
                received: benchmarkType,
                validOptions: validBenchmarks
            });
        }

        const normalizedBenchmarkType = benchmarkType.toLowerCase();
        
        console.log(`🎯 Running ${benchmarkType} benchmark with session model: ${sessionModel.modelName}`);
        
        // Fetch all test cases for this benchmark
        const testCases = await TestCase.find({ 
            'metadata.benchmarkType': normalizedBenchmarkType
        });

        console.log("Fetched test cases:", testCases.length);
        
        if (!testCases.length) {
            return res.status(404).json({
                success: false,
                error: 'No test cases found for this benchmark',
                benchmarkType: benchmarkType,
                message: 'This benchmark may not be loaded in the database yet'
            });
        }
        
        console.log(`📚 Found ${testCases.length} test cases for ${benchmarkType}`);
        
        // Render stability: limit to first 10 problems for demo
        const maxProblems = 3;
        const testCasesToRun = testCases.slice(0, maxProblems);
        
        if (testCases.length > maxProblems) {
            console.log(`⚠️  Limiting to first ${maxProblems} problems for demo (total: ${testCases.length})`);
        }

        console.log("About to create EvalRun");
        
        // Run full evaluation loop (bounded by maxProblems for render stability)
        const benchmarkEvalRun = await EvalRun.create({
            runName: `Benchmark Suite - ${benchmarkType.toUpperCase()} - ${sessionModel.modelName}`,
            description: `Benchmark suite evaluation for ${benchmarkType.toUpperCase()} using session model`,
            modelUnderTest: {
                name: sessionModel.modelName,
                version: 'latest',
                provider: 'huggingface'
            },
            judgeModel: {
                name: process.env.JUDGE_MODEL || 'hf-judge-space',
                version: 'latest'
            },
            testCaseIds: testCasesToRun.map(tc => tc._id),
            configuration: {
                benchmarkType: benchmarkType.toUpperCase(),
                maxProblems
            },
            tags: ['benchmark-suite', benchmarkType.toLowerCase()],
            metrics: { totalTestCases: testCasesToRun.length },
            status: 'running',
            startTime: new Date()
        });

        console.log("EvalRun created:", benchmarkEvalRun._id);
        const evalRunId = benchmarkEvalRun._id;

        // Immediately respond so request doesn't hang
        res.json({
            success: true,
            status: "started",
            message: "Benchmark evaluation started",
            evalRunId: benchmarkEvalRun._id,
            benchmarkType: benchmarkType.toUpperCase(),
            modelName: sessionModel.modelName
        });

        (async () => {
            try {
                const provider = 'hf-user-model';
                const apiConfig = {
                    baseURL: sessionModel.baseUrl
                };

                const startedAt = Date.now();

                console.log("Starting benchmark loop");
                try {
                    for (const testCase of testCasesToRun) {
                        console.log("Running test case:", testCase._id);
                        try {
                            const result = await Promise.race([
                                runEvaluation({
                                    evalRunId,
                                    testCaseId: testCase._id,
                                    model: sessionModel.modelName,
                                    parameters: {
                                        temperature: 0.1,
                                        max_tokens: 128
                                    },
                                    apiConfig,
                                    provider
                                }),
                                // 150s: ~25s inference + ~90s judge + buffer
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error("Test case timeout after 150s")), 150000)
                                )
                            ]);
                        } catch (testError) {
                            // Do NOT increment metrics here — runEvaluation is still running
                            // in the background and will update metrics itself when it finishes.
                            // Adding increments here causes double-counting.
                            console.error(`  ✗ Timeout/error for ${testCase._id}:`, testError.message);
                        }
                    }
                } finally {
                    const duration = Date.now() - startedAt;

                    // Read final totals and compute averages before writing status
                    const finalRun = await EvalRun.findById(evalRunId).lean();
                    const completed = finalRun?.metrics?.completed || 0;
                    const avgScore = completed > 0
                        ? (finalRun.metrics.totalScore || 0) / completed
                        : 0;
                    const avgTime = completed > 0
                        ? (finalRun.metrics.totalResponseTime || 0) / completed
                        : 0;

                    await EvalRun.findByIdAndUpdate(evalRunId, {
                        $set: {
                            status: 'completed',
                            endTime: new Date(),
                            duration,
                            'metrics.averageScore': Math.round(avgScore * 100) / 100,
                            'metrics.averageResponseTime': Math.round(avgTime)
                        }
                    });
                    console.log(`✅ Benchmark suite done. completed=${completed} avg_score=${avgScore.toFixed(2)} avg_time=${Math.round(avgTime)}ms`);
                }
            } catch (bgError) {
                console.error("❌ Background benchmark error:", bgError);
                await EvalRun.findByIdAndUpdate(evalRunId, {
                    status: 'failed'
                });
            }
        })();

        return;
        
    } catch (error) {
        console.error('❌ Benchmark suite error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            details: error.message
        });
    }
};
