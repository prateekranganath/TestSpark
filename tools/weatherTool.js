// tools/weatherTool.js
export const weatherTool = {
  name: "getWeather",
  description: "Get current weather for a city",
  parameters: {
    type: "object",
    required: ["city"],
    properties: {
      city: { type: "string" },
      unit: { type: "string", enum: ["celsius", "fahrenheit"] }
    }
  }
};
