const jsonValidator = async (response) => {
    if (!response) {
        return {
            validator: "jsonValidator",
            category: "output",
            pass: false,
            severity: "hard",
            reason: "Response is empty or null"
        }
    }

    try {
        const parsed = JSON.parse(response);
        
        if (typeof parsed !== 'object') {
            return {
                validator: "jsonValidator",
                category: "output",
                pass: false,
                severity: "hard",
                reason: "Parsed JSON is not an object"
            }
        }

        return {
            validator: "jsonValidator",
            category: "output",
            pass: true,
            severity: "none",
            reason: "Response is valid JSON"
        }
    } catch (error) {
        return {
            validator: "jsonValidator",
            category: "output",
            pass: false,
            severity: "hard",
            reason: `Invalid JSON: ${error.message}`
        }
    }
}

export default jsonValidator;
