import { llm_call, getAdapterForBenchmark } from "./llmservice.js";
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

async function judge_response({ evalRunId, testCaseId, modelResponseId, benchmarkValidation }) {
    try {
        const testCaseData = await TestCase.findById(testCaseId);
        const modelResponseData = await ModelResponse.findById(modelResponseId);
        const evalRun = await EvalRun.findById(evalRunId);

        if (!testCaseData || !modelResponseData || !evalRun) {
            throw new Error("Required data not found");
        }

        const prompt = testCaseData.prompt;
        const response = modelResponseData.response;
        const benchmarkType = testCaseData.metadata?.benchmarkType || null;

        let parsed;

        // Use HF Space LLM judge
        console.log('Using HF Space LLM judge');
        
        const judgePrompt = `${JUDGE_PROMPT}\n\nORIGINAL PROMPT:\n${prompt}\n\nMODEL RESPONSE:\n${response}`;

        // Determine adapter based on benchmark type
        const adapter = getAdapterForBenchmark(benchmarkType || 'general');
        
        // Use HF Space for judge if configured, otherwise use standard API
        const judgeCallParams = {
            model: evalRun.judgeModel.name || process.env.JUDGE_MODEL || "gpt-4",
            messages: [{ "role": "user", "content": judgePrompt }],
            temperature: 0.3
        };

        // Add HF Space provider if endpoint is configured
        if (process.env.HF_JUDGE_SPACE_ENDPOINT) {
            judgeCallParams.provider = 'hf-space';
            judgeCallParams.adapter = adapter;
        }

        const judgementResult = await llm_call(judgeCallParams);

        // Extract JSON from response (handles cases where LLM adds extra text)
        try {
            // Try direct parse first
            parsed = JSON.parse(judgementResult.text);
        } catch (e) {
            // Try to extract JSON from markdown code blocks or text
            const jsonMatch = judgementResult.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                // Fallback: create default judgement if no valid JSON found
                console.error("Failed to parse judgement, using fallback:", judgementResult.text);
                parsed = {
                    score: 5.0,
                    criteria: { accuracy: 5, relevance: 5, coherence: 5, completeness: 5 },
                    reasoning: "Unable to parse judge response. Original response: " + judgementResult.text.substring(0, 200),
                    passed: false,
                    feedback: "Judge model did not return valid JSON format"
                };
            }
        }

        // Prepare judgement data
        const judgementData = {
            evalRunId: evalRunId,
            modelResponseId: modelResponseId,
            testCaseId: testCaseId,
            judgeModel: evalRun.judgeModel.name,
            score: parsed.score,
            reasoning: parsed.reasoning,
            criteria: parsed.criteria,
            passed: parsed.passed,
            feedback: parsed.feedback
        };

        // Add benchmark evaluation if present
        if (benchmarkValidation) {
            judgementData.benchmarkEvaluation = {
                benchmarkType: testCaseData.metadata?.benchmarkType || null,
                validator: benchmarkValidation.validator,
                category: benchmarkValidation.category,
                pass: benchmarkValidation.pass,
                score: benchmarkValidation.score,
                confidence: benchmarkValidation.confidence,
                severity: benchmarkValidation.severity,
                explanation: benchmarkValidation.explanation,
                source: benchmarkValidation.source
            };
            
            // Override general judgement if benchmark validation failed
            if (benchmarkValidation.pass === false) {
                judgementData.passed = false;
                judgementData.feedback = `Benchmark validation failed: ${JSON.stringify(benchmarkValidation.explanation)}`;
            }
        }

        const judgement = await Judgement.create(judgementData);

        return judgement;
    } catch (error) {
        throw new Error(`Judgement failed: ${error.message}`);
    }
}

export { judge_response };
