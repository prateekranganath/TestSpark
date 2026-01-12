
const aimevalidator =(modelresponse,testcase)=>{
    const response = (modelresponse.response || modelresponse.rawResponse || '')
    .trim()
    .replace(/[^\d\-]/g, ""); // remove text

  const expected = String(testcase.expected_answer);

  const pass = response === expected;

  return {
    validator: "aimeAnswerValidator",
    category: "mathematical_reasoning",
    source: "validator",
    pass,
    severity: "hard",
    explanation: pass
      ? "Correct AIME answer"
      : `Expected ${expected}, got ${response || "invalid"}`
  }

}

export default aimevalidator;