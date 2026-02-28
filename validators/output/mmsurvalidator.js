import { llm_call, getAdapterForBenchmark } from '../../services/llmservice.js';

export const msurValidator = async (modelresponse, testcase) => {
  const response = modelresponse.Response;
  const question = testcase.Question;
  const expected = testcase.ExpectedResponse;

  const judge_prompt = `
You are grading an undergraduate research-level mathematics response.

Problem:
${question}

Expected Solution Outline:
${expected}

Model Response:
${response}

Rubric:
- 1.0: Fully correct, logically sound, well-justified
- 0.5: Partially correct but missing steps or clarity
- 0.0: Incorrect or invalid reasoning

Instructions:
- Evaluate mathematical correctness, not style.
- Do not be lenient on false statements.
- Return a score and justification.

Output JSON ONLY:
{
  "score": 0.0 | 0.5 | 1.0,
  "verdict": "incorrect | partial | correct",
  "issues": ["list of issues if any"]
}
`;

  const messages = [
    { role: "system", content: "You are an expert mathematics grader." },
    { role: "user", content: judge_prompt }
  ];

  const adapter = getAdapterForBenchmark('msur');

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
    parsed = { score: 0.0, verdict: "invalid", issues: ["Unparseable judge response"] };
  }

  return {
    validator: "msurValidator",
    category: "mathematical_reasoning",
    source: "judge_model",
    pass: parsed.score === 1.0,
    score: parsed.score,
    severity: "hard",
    explanation: parsed
  };
};
