// tools/searchTool.js
export const searchTool = {
  name: "search",
  description: "Search for information on the web",
  parameters: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string" },
      maxResults: { type: "number", default: 10 },
      category: { type: "string", enum: ["web", "news", "images", "videos"] }
    }
  }
};
