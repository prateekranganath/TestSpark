import OpenAI from "openai";

const openai = new OpenAI({ 
    baseURL: 'http://localhost:11434/v1', 
    apiKey: 'ollama' 
});

async function llm_call({ messages, model, temperature = 0.7 }) {
    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: messages,
            temperature: temperature,
        });
        
        return {
            text: response.choices[0].message.content,
            usage: response.usage
        };
    } catch (error) {
        throw new Error(`Error in llm_call: ${error.message}`);
    }
}

export { llm_call };