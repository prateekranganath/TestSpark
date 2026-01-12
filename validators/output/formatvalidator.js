const formatValidator = async (response, expectedFormat) => {
    if (!response || typeof response !== 'string') {
        return {
            validator: "formatValidator",
            category: "output",
            pass: false,
            severity: "hard",
            reason: "Response is not a valid string"
        }
    }

    // Check for expected format (json, text, markdown, etc.)
    if (expectedFormat === 'json') {
        try {
            JSON.parse(response);
            return {
                validator: "formatValidator",
                category: "output",
                pass: true,
                severity: "none",
                reason: "Response is valid JSON format"
            }
        } catch (error) {
            return {
                validator: "formatValidator",
                category: "output",
                pass: false,
                severity: "hard",
                reason: `Response is not valid JSON: ${error.message}`
            }
        }
    }

    if (expectedFormat === 'markdown') {
        const hasMarkdownSyntax = /[#*`\[\]]/g.test(response);
        return {
            validator: "formatValidator",
            category: "output",
            pass: hasMarkdownSyntax,
            severity: hasMarkdownSyntax ? "none" : "soft",
            reason: hasMarkdownSyntax ? "Response contains markdown syntax" : "Response does not contain markdown syntax"
        }
    }

    // Default text format
    return {
        validator: "formatValidator",
        category: "output",
        pass: true,
        severity: "none",
        reason: "Response format is valid"
    }
}

export default formatValidator;
