import { llm_call } from "./llmservice.js";
import Judgement from "../models/judgement.js";
import TestCase from "../models/testcase.js";
import ModelResponse from "../models/modelresponse.js";
import EvalRun from "../models/evalrun.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JUDGE_PROMPT = fs.readFileSync(
    path.join(__dirname, "../prompts/judge.txt"),
    "utf-8"
);

async function judge_response({ evalRunId, testCaseId, modelResponseId }) {
    try {
        const testCaseData = await TestCase.findById(testCaseId);
        const modelResponseData = await ModelResponse.findById(modelResponseId);
        const evalRun = await EvalRun.findById(evalRunId);

        if (!testCaseData || !modelResponseData || !evalRun) {
            throw new Error("Required data not found");
        }

        const prompt = testCaseData.prompt;
        const response = modelResponseData.response;

        const judgePrompt = `${JUDGE_PROMPT}\n\nORIGINAL PROMPT:\n${prompt}\n\nMODEL RESPONSE:\n${response}`;

        const judgementResult = await llm_call({
            model: evalRun.judgeModel.name || process.env.JUDGE_MODEL || "gpt-4",
            messages: [{ "role": "user", "content": judgePrompt }],
            temperature: 0.3
        });

        const parsed = JSON.parse(judgementResult.text);

        const judgement = await Judgement.create({
            evalRunId: evalRunId,
            modelResponseId: modelResponseId,
            testCaseId: testCaseId,
            judgeModel: evalRun.judgeModel.name,
            score: parsed.score,
            reasoning: parsed.reasoning,
            criteria: parsed.criteria,
            passed: parsed.passed,
            feedback: parsed.feedback
        });

        // Update eval run metrics
        await EvalRun.findByIdAndUpdate(evalRunId, {
            $inc: {
                'metrics.completed': 1,
                'metrics.passed': parsed.passed ? 1 : 0,
                'metrics.failed': parsed.passed ? 0 : 1
            }
        });

        return judgement;
    } catch (error) {
        throw new Error(`Judgement failed: ${error.message}`);
    }
}

export { judge_response };
