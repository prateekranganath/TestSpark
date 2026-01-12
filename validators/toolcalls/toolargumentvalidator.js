const toolArgumentValidator = async (toolCall, toolSpec) => {
    if (!toolCall || typeof toolCall !== 'object') {
        return {
            validator: "toolArgumentValidator",
            category: "tool_call",
            pass: false,
            severity: "hard",
            reason: "No tool call was made or tool call is invalid"
        }
    }

    if (!toolCall.arguments || typeof toolCall.arguments !== 'object') {
        return {
            validator: "toolArgumentValidator",
            category: "tool_call",
            pass: false,
            severity: "hard",
            reason: "Tool call arguments are missing or invalid"
        }
    }

    // Check if all required arguments are present
    if (toolSpec && toolSpec.parameters && toolSpec.parameters.required) {
        for (const requiredArg of toolSpec.parameters.required) {
            if (!(requiredArg in toolCall.arguments)) {
                return {
                    validator: "toolArgumentValidator",
                    category: "tool_call",
                    pass: false,
                    severity: "hard",
                    reason: `Required argument '${requiredArg}' is missing`
                }
            }
        }
    }

    // Check if argument types match the schema
    if (toolSpec && toolSpec.parameters && toolSpec.parameters.properties) {
        for (const arg in toolCall.arguments) {
            const argValue = toolCall.arguments[arg];
            const argSpec = toolSpec.parameters.properties[arg];

            if (argSpec) {
                const expectedType = argSpec.type;
                const actualType = Array.isArray(argValue) ? 'array' : typeof argValue;

                if (expectedType !== actualType) {
                    return {
                        validator: "toolArgumentValidator",
                        category: "tool_call",
                        pass: false,
                        severity: "hard",
                        reason: `Argument '${arg}' has incorrect type. Expected '${expectedType}', got '${actualType}'`
                    }
                }

                // Check enum constraints
                if (argSpec.enum && !argSpec.enum.includes(argValue)) {
                    return {
                        validator: "toolArgumentValidator",
                        category: "tool_call",
                        pass: false,
                        severity: "hard",
                        reason: `Argument '${arg}' value '${argValue}' is not in allowed values: ${argSpec.enum.join(', ')}`
                    }
                }
            }
        }
    }

    return {
        validator: "toolArgumentValidator",
        category: "tool_call",
        pass: true,
        severity: "none",
        reason: "All tool arguments are valid"
    }
}

export default toolArgumentValidator;