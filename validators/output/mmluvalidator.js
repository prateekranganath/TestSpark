
import { llm_call, getAdapterForBenchmark } from '../../services/llmservice.js';

export const mmluValidator = async (modelresponse, testcase) => {
  const response = modelresponse.Response;
  const question = testcase.Question;
  const expected = testcase.ExpectedResponse;

  const judge_prompt = `
You are an expert evaluator for a graduate-level, multi-domain benchmark.

Question:
${question}

Expected Answer:
${expected}

Model Response:
${response}

Instructions:
- Determine whether the response is conceptually correct.
- Ignore minor wording or formatting differences.
- The core concept MUST match the expected answer.
- Do NOT give partial credit.

Output JSON ONLY:
{
  "correct": true | false,
  "confidence": 0.0-1.0,
  "reason": "brief justification"
}
`;

  const messages = [
    { role: "system", content: "You are a strict academic evaluator." },
    { role: "user", content: judge_prompt }
  ];

  const adapter = getAdapterForBenchmark('mmlu');

  const llm_response = await llm_call({
    messages,
    model: process.env.JUDGE_MODEL,
    temperature: 0,
    provider: 'hf-space',
    adapter: adapter
  });

  let parsed;
  try {
    parsed = JSON.parse(llm_response.text);
  } catch {
    parsed = { correct: false, confidence: 0.0, reason: "Unparseable judge response" };
  }

  return {
    validator: "mmluValidator",
    category: "multidomain_knowledge",
    source: "judge_model",
    pass: parsed.correct === true,
    score: parsed.correct ? 1 : 0,
    confidence: parsed.confidence,
    severity: "hard",
    explanation: parsed
  };
};
