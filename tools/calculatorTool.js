// tools/calculatorTool.js
export const calculatorTool = {
  name: "calculate",
  description: "Perform mathematical calculations",
  parameters: {
    type: "object",
    required: ["operation", "numbers"],
    properties: {
      operation: { type: "string", enum: ["add", "subtract", "multiply", "divide"] },
      numbers: { 
        type: "array",
        items: { type: "number" },
        minItems: 2
      }
    }
  }
};
