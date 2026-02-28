import { llm_call } from "./llmservice.js";
import { judge_response } from "./judgeservice.js";
import TestCase from "../models/testcase.js";
import ModelResponse from "../models/modelresponse.js";
import EvalRun from "../models/evalrun.js";
import aimevalidator from "../validators/output/aimevalidator.js";
import { mmluValidator } from "../validators/output/mmluvalidator.js";
import { msurValidator } from "../validators/output/mmsurvalidator.js";

async function runEvaluation({ evalRunId, testCaseId, model, client, parameters, apiConfig, provider }) {
    try {
        const testCaseData = await TestCase.findById(testCaseId);
        if (!testCaseData) {
            throw new Error("Test case not found");
        }

        const evalRun = await EvalRun.findById(evalRunId);
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

        const responseTime = Date.now() - startTime;

        const modelResponse = new ModelResponse({
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

        return { modelResponse, judgement };
    } catch (error) {
        throw new Error(`Evaluation failed: ${error.message}`);
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
