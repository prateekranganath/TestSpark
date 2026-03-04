import { llm_call } from "./llmservice.js";
import { judge_response } from "./judgeservice.js";
import TestCase from "../models/testcase.js";
import ModelResponse from "../models/modelresponse.js";
import EvalRun from "../models/evalrun.js";
import aimevalidator from "../validators/output/aimevalidator.js";
import { mmluValidator } from "../validators/output/mmluvalidator.js";
import { msurValidator } from "../validators/output/mmsurvalidator.js";

async function runEvaluation({ evalRunId, testCaseId, model, client, parameters, apiConfig, provider }) {
    let testCaseData;
    let evalRun;
    let modelResponse;
    let responseTime = 0;
    try {
        testCaseData = await TestCase.findById(testCaseId);
        if (!testCaseData) {
            throw new Error("Test case not found");
        }

        evalRun = await EvalRun.findById(evalRunId).lean();
        if (!evalRun) {
            throw new Error("Eval run not found");
        }

        const prompt = testCaseData.prompt;
        const startTime = Date.now();

        // Use llm_call which internally uses adapter
        const modelName = model || evalRun.modelUnderTest.name;
        const temperature = parameters?.temperature || evalRun.configuration?.temperature || 0.7;
        
        const response = await llm_call({
            messages: [{ role: "user", content: prompt }],
            model: modelName,
            temperature: temperature,
            client: client,
            apiConfig: apiConfig,
            provider: provider,
            ...parameters // Spread any additional parameters
        });

        if (!response || response.error) {
            throw new Error(`Model inference failed: ${response?.error || "Unknown error"}`);
        }

        if (!response.text) {
            throw new Error("Model returned empty response");
        }

        responseTime = Date.now() - startTime;

        modelResponse = new ModelResponse({
            evalRunId: evalRunId,
            testCaseId: testCaseId,
            modelName: model || evalRun.modelUnderTest.name,
            modelVersion: evalRun.modelUnderTest.version,
            prompt: prompt,
            response: response.text,
            responseTime: responseTime,
            tokensUsed: {
                input: response.usage?.prompt_tokens || 0,
                output: response.usage?.completion_tokens || 0
            },
            status: 'success'
        });
        await modelResponse.save();

        // Determine if this is a benchmark evaluation
        const benchmarkType = testCaseData.metadata?.benchmarkType;
        let benchmarkValidation = null;

        if (benchmarkType) {
            // Run benchmark-specific validation
            benchmarkValidation = await runBenchmarkValidation(
                benchmarkType, 
                modelResponse, 
                testCaseData
            );
        }

        const judgement = await judge_response({ 
            evalRunId, 
            testCaseId, 
            modelResponseId: modelResponse._id,
            benchmarkValidation 
        });

        console.log("Judge output:", judgement);

        const passedInc = judgement?.passed ? 1 : 0;
        const failedInc = judgement?.passed ? 0 : 1;
        const scoreInc = Number(judgement?.score) || 0;
        const pushModelResponses = [modelResponse._id];
        const pushJudgements = judgement?._id ? [judgement._id] : [];

        await EvalRun.findByIdAndUpdate(evalRunId, [
            {
                $set: {
                    modelResponses: {
                        $concatArrays: [
                            { $ifNull: ["$modelResponses", []] },
                            pushModelResponses
                        ]
                    },
                    judgements: {
                        $concatArrays: [
                            { $ifNull: ["$judgements", []] },
                            pushJudgements
                        ]
                    },
                    'metrics.completed': {
                        $add: [{ $ifNull: ['$metrics.completed', 0] }, 1]
                    },
                    'metrics.passed': {
                        $add: [{ $ifNull: ['$metrics.passed', 0] }, passedInc]
                    },
                    'metrics.failed': {
                        $add: [{ $ifNull: ['$metrics.failed', 0] }, failedInc]
                    },
                    'metrics.totalScore': {
                        $add: [{ $ifNull: ['$metrics.totalScore', 0] }, scoreInc]
                    },
                    'metrics.totalResponseTime': {
                        $add: [{ $ifNull: ['$metrics.totalResponseTime', 0] }, responseTime]
                    }
                }
            },
            {
                $set: {
                    'metrics.averageScore': {
                        $cond: [
                            { $gt: ['$metrics.completed', 0] },
                            { $divide: ['$metrics.totalScore', '$metrics.completed'] },
                            0
                        ]
                    },
                    'metrics.averageResponseTime': {
                        $cond: [
                            { $gt: ['$metrics.completed', 0] },
                            { $divide: ['$metrics.totalResponseTime', '$metrics.completed'] },
                            0
                        ]
                    }
                }
            }
        ]);

        return { modelResponse, judgement };
    } catch (error) {

        console.error("❌ runEvaluation error:", error.message);

        const failedResponse = modelResponse || await new ModelResponse({
            evalRunId,
            testCaseId,
            modelName: model || evalRun?.modelUnderTest?.name,
            modelVersion: evalRun?.modelUnderTest?.version || "latest",
            prompt: testCaseData?.prompt || "",
            response: "[EVALUATION_ERROR]",
            responseTime: 0,
            tokensUsed: { input: 0, output: 0 },
            status: "error",
            error: error.message
        }).save();

        if (modelResponse) {
            await ModelResponse.findByIdAndUpdate(modelResponse._id, {
                status: 'error',
                error: error.message
            });
        }

        const failedResponseTime = modelResponse?.responseTime || 0;

        await EvalRun.findByIdAndUpdate(evalRunId, [
            {
                $set: {
                    modelResponses: {
                        $concatArrays: [
                            { $ifNull: ['$modelResponses', []] },
                            [failedResponse._id]
                        ]
                    },
                    'metrics.completed': {
                        $add: [{ $ifNull: ['$metrics.completed', 0] }, 1]
                    },
                    'metrics.failed': {
                        $add: [{ $ifNull: ['$metrics.failed', 0] }, 1]
                    },
                    'metrics.totalResponseTime': {
                        $add: [{ $ifNull: ['$metrics.totalResponseTime', 0] }, failedResponseTime]
                    }
                }
            },
            {
                $set: {
                    'metrics.averageScore': {
                        $cond: [
                            { $gt: ['$metrics.completed', 0] },
                            { $divide: [{ $ifNull: ['$metrics.totalScore', 0] }, '$metrics.completed'] },
                            0
                        ]
                    },
                    'metrics.averageResponseTime': {
                        $cond: [
                            { $gt: ['$metrics.completed', 0] },
                            { $divide: ['$metrics.totalResponseTime', '$metrics.completed'] },
                            0
                        ]
                    }
                }
            }
        ]);

        return {
            modelResponse: failedResponse,
            judgement: null,
            failed: true
        };
    }
}

async function runBenchmarkValidation(benchmarkType, modelResponse, testCase) {
    try {
        switch (benchmarkType.toLowerCase()) {
            case 'aime':
                return aimevalidator(modelResponse, {
                    expected_answer: testCase.expectedOutput || testCase.metadata?.answer
                });
            
            case 'mmlu':
                return await mmluValidator(modelResponse, {
                    Question: testCase.prompt,
                    ExpectedResponse: testCase.expectedOutput || testCase.metadata?.answer
                });
            
            case 'msur':
                return await msurValidator(modelResponse, {
                    Question: testCase.prompt,
                    ExpectedResponse: testCase.expectedOutput || testCase.metadata?.expected_answer
                });
            
            default:
                console.warn(`Unknown benchmark type: ${benchmarkType}`);
                return null;
        }
    } catch (error) {
        console.error(`Benchmark validation failed for ${benchmarkType}:`, error.message);
        return {
            validator: `${benchmarkType}Validator`,
            pass: false,
            error: error.message,
            explanation: `Validation error: ${error.message}`
        };
    }
}

export { runEvaluation };
