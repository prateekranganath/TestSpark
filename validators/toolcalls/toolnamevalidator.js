const toolNameValidator = async (toolCall, availableTools = []) => {
    if (!toolCall || typeof toolCall !== 'object') {
        return {
            validator: "toolNameValidator",
            category: "tool_call",
            pass: false,
            severity: "hard",
            reason: "No tool call was made or tool call is invalid"
        }
    }

    if (!toolCall.name || typeof toolCall.name !== 'string') {
        return {
            validator: "toolNameValidator",
            category: "tool_call",
            pass: false,
            severity: "hard",
            reason: "Tool name is missing or invalid"
        }
    }

    // If available tools are specified, check if the tool name is in the list
    if (availableTools.length > 0) {
        const toolNames = availableTools.map(tool => tool.name);
        
        if (!toolNames.includes(toolCall.name)) {
            return {
                validator: "toolNameValidator",
                category: "tool_call",
                pass: false,
                severity: "hard",
                reason: `Tool '${toolCall.name}' is not in available tools: ${toolNames.join(', ')}`
            }
        }
    }

    return {
        validator: "toolNameValidator",
        category: "tool_call",
        pass: true,
        severity: "none",
        reason: `Tool name '${toolCall.name}' is valid`
    }
}

export default toolNameValidator;