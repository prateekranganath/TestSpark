import { llm_call } from "./llmservice.js";
import TestCase from "../models/testcase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateTestCases({
    parentPromptId,
    types,
    perType = 1
}) {
    const parent = await TestCase.findById(parentPromptId);
    
    if (!parent) {
        throw new Error("Parent test case not found");
    }

    const parentPrompt = parent.prompt;
    const generatedCases = [];

    for (const type of types) {
        const templatePath = path.join(__dirname, `../prompts/generators/${type}.txt`);
        
        if (!fs.existsSync(templatePath)) {
            console.warn(`Template not found for type: ${type}`);
            continue;
        }

        const template = fs.readFileSync(templatePath, "utf-8");

        for (let i = 0; i < perType; i++) {
            const generatorPrompt = `${template}\n\nBased on this original prompt, generate ONE new test case:\nORIGINAL PROMPT: ${parentPrompt}\n\nGenerate a single ${type} test case prompt (just the prompt text, nothing else):`;

            const result = await llm_call({
                model: process.env.GENERATOR_MODEL || "gpt-4",
                messages: [{ role: "user", content: generatorPrompt }],
                temperature: 0.8
            });

            const newPrompt = result.text.trim();
            const testCaseId = `tc_${type}_${Date.now()}_${i}`;

            const newCase = await TestCase.create({
                _id: testCaseId,
                prompt: newPrompt,
                parentPromptId: parent._id,
                generationType: type,
                generatedBy: "llm"
            });

            generatedCases.push(newCase);
        }
    }

    return generatedCases;
}