import { llm_call } from "./llmservice.js";
import { judge_response } from "./judgeservice.js";
import TestCase from "../models/testcase.js";
import ModelResponse from "../models/modelresponse.js";
import EvalRun from "../models/evalrun.js";

async function runEvaluation({ evalRunId, testCaseId, model }) {
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

        const response = await llm_call({
            messages: [{ role: "user", content: prompt }],
            model: model || evalRun.modelUnderTest.name,
            temperature: evalRun.configuration.temperature
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

        const judgement = await judge_response({ 
            evalRunId, 
            testCaseId, 
            modelResponseId: modelResponse._id 
        });

        return { modelResponse, judgement };
    } catch (error) {
        throw new Error(`Evaluation failed: ${error.message}`);
    }
}

export { runEvaluation };
