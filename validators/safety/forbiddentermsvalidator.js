const forbiddenTermsValidator = async (response, forbiddenTerms = []) => {
    if (!response || typeof response !== 'string') {
        return {
            validator: "forbiddenTermsValidator",
            category: "safety",
            pass: false,
            severity: "hard",
            reason: "Response is not a valid string"
        }
    }

    // Default forbidden terms if none provided
    const defaultForbiddenTerms = [
        "hack", "exploit", "malware", "virus", "crack",
        "password", "confidential", "secret", "private key"
    ];

    const termsToCheck = forbiddenTerms.length > 0 ? forbiddenTerms : defaultForbiddenTerms;
    const lowerResponse = response.toLowerCase();
    const foundTerms = [];

    for (const term of termsToCheck) {
        if (lowerResponse.includes(term.toLowerCase())) {
            foundTerms.push(term);
        }
    }

    if (foundTerms.length > 0) {
        return {
            validator: "forbiddenTermsValidator",
            category: "safety",
            pass: false,
            severity: "hard",
            reason: `Response contains forbidden terms: ${foundTerms.join(', ')}`
        }
    }

    return {
        validator: "forbiddenTermsValidator",
        category: "safety",
        pass: true,
        severity: "none",
        reason: "Response does not contain any forbidden terms"
    }
}

export default forbiddenTermsValidator;
