// Deterministic MMLU validator — no LLM call required for simple expected answers.
// Normalises both strings and checks for containment / numeric equivalence.

function normalise(str) {
    return String(str)
        .toLowerCase()
        .replace(/[^a-z0-9\/\.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export const mmluValidator = (modelresponse, testcase) => {
    const rawResponse = modelresponse.response || modelresponse.Response || '';
    const expected    = String(testcase.ExpectedResponse ?? testcase.expected_answer ?? '');

    const normResp = normalise(rawResponse);
    const normExp  = normalise(expected);

    // Pass if the expected token appears anywhere in the response (or vice-versa for short answers)
    const pass = normExp.length > 0 && (normResp.includes(normExp) || normExp.includes(normResp));

    return {
        validator:   'mmluValidator',
        category:    'multidomain_knowledge',
        source:      'validator',
        pass,
        score:       pass ? 1 : 0,
        confidence:  pass ? 1.0 : 0.0,
        severity:    'hard',
        explanation: pass
            ? `Response contains expected answer: "${expected}"`
            : `Expected "${expected}" not found in response`
    };
};
