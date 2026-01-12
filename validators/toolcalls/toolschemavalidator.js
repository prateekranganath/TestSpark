
const toolSchemaValidator = async (toolSchema, toolspec) => {
    if(!toolSchema || typeof toolSchema !== 'object') {
        return {
            validator: "toolSchemaValidator",
      category: "tool_call",
      pass: false,
      severity: "hard",
      reason: "No tool call was made"
        }

    }

    for (const arg in toolspec.required){
        if(!(arg in toolSchema.properties)){
            return {
                validator: "toolSchemaValidator",
                category: "tool_call",
                pass: false,
                severity: "hard",
                reason: `Required argument '${arg}' is missing in the tool schema`
            }
        }
    }

    return{
        validator: "toolSchemaValidator",
        category: "tool_call",
        pass: true,
        severity: "none",
        reason: "Tool schema is valid"
    }
}

export default toolSchemaValidator;