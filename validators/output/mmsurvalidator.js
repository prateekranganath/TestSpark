// Deterministic MSUR validator — no LLM call for simplified short-answer questions.
// Uses normalised string matching; pass if expected answer appears in the response.

function normalise(str) {
    return String(str)
        .toLowerCase()
        .replace(/[^a-z0-9\/\.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export const msurValidator = (modelresponse, testcase) => {
    const rawResponse = modelresponse.response || modelresponse.Response || '';
    const expected    = String(testcase.ExpectedResponse ?? testcase.expected_answer ?? '');

    const normResp = normalise(rawResponse);
    const normExp  = normalise(expected);

    const pass = normExp.length > 0 && (normResp.includes(normExp) || normExp.includes(normResp));
    const score = pass ? 1.0 : 0.0;

    return {
        validator:   'msurValidator',
        category:    'mathematical_reasoning',
        source:      'validator',
        pass,
        score,
        severity:    'hard',
        explanation: pass
            ? `Response contains expected answer: "${expected}"`
            : `Expected "${expected}" not found in response`
    };
};
