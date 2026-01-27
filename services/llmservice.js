import OpenAI from "openai";

const openai = new OpenAI({ 
    baseURL: 'http://localhost:11434/v1', 
    apiKey: 'ollama' 
});

/**
 * Universal adapter function to call any model via any client API
 * @param {Object} client - The API client (default: openai)
 * @param {String} model - The model name (default: "llama3.2")
 * @param {Object} parameters - Parameters including messages, temperature, etc.
 * @returns {Object} - Standardized response with text and usage
 */
async function adapter(client, model, parameters) {
    try {
        // Set defaults
        client = client || openai;
        model = model || "llama3.2";
        
        // Validate parameters
        if (!parameters || !parameters.messages) {
            throw new Error("Parameters must include messages array");
        }

        // Handle different input types for messages
        let messages;
        if (Array.isArray(parameters.messages)) {
            messages = parameters.messages;
        } else if (typeof parameters.messages === 'string') {
            // Convert string to message format
            messages = [{ role: "user", content: parameters.messages }];
        } else if (typeof parameters.messages === 'object' && parameters.messages.role && parameters.messages.content) {
            // Single message object
            messages = [parameters.messages];
        } else {
            throw new Error("Invalid messages format. Expected array, string, or message object");
        }

        // Extract additional parameters
        const temperature = parameters.temperature || 0.7;
        const max_tokens = parameters.max_tokens;
        const top_p = parameters.top_p;
        const frequency_penalty = parameters.frequency_penalty;
        const presence_penalty = parameters.presence_penalty;

        // Build request options
        const requestOptions = {
            model: model,
            messages: messages,
            temperature: temperature
        };

        // Add optional parameters if provided
        if (max_tokens !== undefined) requestOptions.max_tokens = max_tokens;
        if (top_p !== undefined) requestOptions.top_p = top_p;
        if (frequency_penalty !== undefined) requestOptions.frequency_penalty = frequency_penalty;
        if (presence_penalty !== undefined) requestOptions.presence_penalty = presence_penalty;

        // Make the API call
        const response = await client.chat.completions.create(requestOptions);
        
        // Return standardized response for evaluation
        return {
            text: response.choices[0].message.content,
            usage: response.usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
            }
        };
    } catch (error) {
        throw new Error(`Adapter error: ${error.message}`);
    }
}

/**
 * Legacy llm_call function - now uses adapter internally
 * @param {Object} params - Parameters including messages, model, temperature
 * @returns {Object} - Response with text and usage
 */
async function llm_call({ messages, model, temperature = 0.7, client }) {
    try {
        return await adapter(
            client,
            model,
            { messages, temperature }
        );
    } catch (error) {
        throw new Error(`Error in llm_call: ${error.message}`);
    }
}

export { llm_call, adapter };