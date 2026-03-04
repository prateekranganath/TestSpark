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

        const benchmarkType = testCaseData.metadata?.benchmarkType || null;

        // ── Fast path: benchmark questions have deterministic validators ──
        // Skip the LLM judge entirely and derive the judgement from the
        // validator result. This avoids HF Space timeouts for AIME/MMLU/MSUR.
        if (benchmarkValidation && benchmarkType) {
            const pass = !!benchmarkValidation.pass;
            const score = pass ? 9.0 : 2.0;
            const explanation =
                typeof benchmarkValidation.explanation === 'string'
                    ? benchmarkValidation.explanation
                    : JSON.stringify(benchmarkValidation.explanation || '');

            console.log(`⚡ Benchmark validator short-circuit: ${benchmarkType} → pass=${pass}`);

            const judgement = await Judgement.create({
                evalRunId,
                modelResponseId,
                testCaseId,
                judgeModel: 'benchmark-validator',
                score,
                reasoning: explanation || (pass ? 'Correct answer per benchmark validator.' : 'Incorrect answer per benchmark validator.'),
                criteria: {
                    accuracy:     pass ? 9 : 2,
                    relevance:    9,
                    coherence:    9,
                    completeness: pass ? 9 : 2
                },
                passed: pass,
                feedback: explanation || (pass ? 'Answer matches expected output.' : 'Answer does not match expected output.'),
                benchmarkEvaluation: {
                    benchmarkType,
                    validator:   benchmarkValidation.validator   || `${benchmarkType}Validator`,
                    category:    benchmarkValidation.category    || null,
                    pass,
                    score:       benchmarkValidation.score       ?? (pass ? 1.0 : 0.0),
                    confidence:  benchmarkValidation.confidence  ?? null,
                    severity:    benchmarkValidation.severity    ?? null,
                    explanation,
                    source:      benchmarkValidation.source      || null
                }
            });

            return judgement;
        }

        // ── Slow path: no validator → call the LLM judge ──
        const prompt = testCaseData.prompt;
        const response = (modelResponseData.response || '').substring(0, 400);

        console.log('No benchmark validator — using HF Space LLM judge');

        const judgePrompt = `${JUDGE_PROMPT}\n\nORIGINAL PROMPT:\n${prompt}\n\nMODEL RESPONSE:\n${response}`;

        const adapter = getAdapterForBenchmark('general');

        const judgeCallParams = {
            model: evalRun.judgeModel.name || process.env.JUDGE_MODEL || 'gpt-4',
            messages: [{ role: 'user', content: judgePrompt }],
            temperature: 0.3,
            max_tokens: 200
        };

        if (process.env.HF_JUDGE_SPACE_ENDPOINT) {
            judgeCallParams.provider = 'hf-space';
            judgeCallParams.adapter  = adapter;
        }

        const judgementResult = await llm_call(judgeCallParams);

        let parsed;
        try {
            parsed = JSON.parse(judgementResult.text);
        } catch (e) {
            const jsonMatch = judgementResult.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                console.error('Failed to parse judgement, using fallback:', judgementResult.text);
                parsed = {
                    score: 5.0,
                    criteria: { accuracy: 5, relevance: 5, coherence: 5, completeness: 5 },
                    reasoning: 'Unable to parse judge response: ' + judgementResult.text.substring(0, 200),
                    passed: false,
                    feedback: 'Judge model did not return valid JSON format'
                };
            }
        }

        const judgement = await Judgement.create({
            evalRunId,
            modelResponseId,
            testCaseId,
            judgeModel: evalRun.judgeModel.name,
            score:     parsed.score,
            reasoning: parsed.reasoning,
            criteria:  parsed.criteria,
            passed:    parsed.passed,
            feedback:  parsed.feedback
        });

        return judgement;
    } catch (error) {
        throw new Error(`Judgement failed: ${error.message}`);
    }
}

export { judge_response };
