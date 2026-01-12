const lengthValidator = async (response, minLength = 0, maxLength = 10000) => {
    if (!response) {
        return {
            validator: "lengthValidator",
            category: "output",
            pass: false,
            severity: "hard",
            reason: "Response is empty or null"
        }
    }

    const responseLength = response.length;

    if (responseLength < minLength) {
        return {
            validator: "lengthValidator",
            category: "output",
            pass: false,
            severity: "soft",
            reason: `Response length (${responseLength}) is below minimum (${minLength})`
        }
    }

    if (responseLength > maxLength) {
        return {
            validator: "lengthValidator",
            category: "output",
            pass: false,
            severity: "soft",
            reason: `Response length (${responseLength}) exceeds maximum (${maxLength})`
        }
    }

    return {
        validator: "lengthValidator",
        category: "output",
        pass: true,
        severity: "none",
        reason: `Response length (${responseLength}) is within acceptable range`
    }
}

export default lengthValidator;
