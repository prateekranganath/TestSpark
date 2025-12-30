import { generateTestCases } from "../services/generatorservice.js";
import TestCase from "../models/testcase.js";

// Generate test cases from a parent prompt
export const generateTestCasesFromParent = async (req, res) => {
    try {
        const { parentPromptId, types, perType } = req.body;

        // Validate required fields
        if (!parentPromptId || !types || !Array.isArray(types) || types.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: parentPromptId, types (must be an array)"
            });
        }

        // Validate types
        const validTypes = ['ambiguity', 'contradiction', 'negation'];
        const invalidTypes = types.filter(t => !validTypes.includes(t));
        if (invalidTypes.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid generation types: ${invalidTypes.join(', ')}. Valid types are: ${validTypes.join(', ')}`
            });
        }

        const generatedCases = await generateTestCases({
            parentPromptId,
            types,
            perType: perType || 1
        });

        res.status(201).json({
            success: true,
            count: generatedCases.length,
            data: generatedCases
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create a single test case manually
export const createTestCase = async (req, res) => {
    try {
        const { prompt, expectedOutput, metadata } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: "Missing required field: prompt"
            });
        }

        const testCaseId = `tc_manual_${Date.now()}`;

        const testCase = await TestCase.create({
            _id: testCaseId,
            prompt,
            generatedBy: 'user',
            generationType: null,
            parentPromptId: null,
            expectedOutput: expectedOutput || null,
            metadata: metadata || {}
        });

        res.status(201).json({
            success: true,
            data: testCase
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all test cases
export const getAllTestCases = async (req, res) => {
    try {
        const { generatedBy, generationType, limit = 100, skip = 0 } = req.query;

        const query = {};
        if (generatedBy) query.generatedBy = generatedBy;
        if (generationType) query.generationType = generationType;

        const testCases = await TestCase.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        res.status(200).json({
            success: true,
            count: testCases.length,
            data: testCases
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get single test case by ID
export const getTestCaseById = async (req, res) => {
    try {
        const { testCaseId } = req.params;

        const testCase = await TestCase.findById(testCaseId);
        if (!testCase) {
            return res.status(404).json({
                success: false,
                message: "Test case not found"
            });
        }

        // Get child test cases if any
        const children = await TestCase.find({ parentPromptId: testCaseId });

        res.status(200).json({
            success: true,
            data: {
                testCase,
                children
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update test case
export const updateTestCase = async (req, res) => {
    try {
        const { testCaseId } = req.params;
        const updates = req.body;

        // Don't allow changing certain fields
        delete updates._id;
        delete updates.generatedBy;
        delete updates.parentPromptId;

        const testCase = await TestCase.findByIdAndUpdate(
            testCaseId,
            updates,
            { new: true, runValidators: true }
        );

        if (!testCase) {
            return res.status(404).json({
                success: false,
                message: "Test case not found"
            });
        }

        res.status(200).json({
            success: true,
            data: testCase
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete test case
export const deleteTestCase = async (req, res) => {
    try {
        const { testCaseId } = req.params;

        const testCase = await TestCase.findByIdAndDelete(testCaseId);
        if (!testCase) {
            return res.status(404).json({
                success: false,
                message: "Test case not found"
            });
        }

        // Optionally delete child test cases
        await TestCase.deleteMany({ parentPromptId: testCaseId });

        res.status(200).json({
            success: true,
            message: "Test case deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Bulk create test cases
export const bulkCreateTestCases = async (req, res) => {
    try {
        const { testCases } = req.body;

        if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Missing or invalid testCases array"
            });
        }

        const createdCases = [];
        const errors = [];

        for (let i = 0; i < testCases.length; i++) {
            try {
                const tc = testCases[i];
                const testCaseId = tc._id || `tc_bulk_${Date.now()}_${i}`;

                const testCase = await TestCase.create({
                    _id: testCaseId,
                    prompt: tc.prompt,
                    generatedBy: tc.generatedBy || 'user',
                    generationType: tc.generationType || null,
                    parentPromptId: tc.parentPromptId || null,
                    expectedOutput: tc.expectedOutput || null,
                    metadata: tc.metadata || {}
                });

                createdCases.push(testCase);
            } catch (error) {
                errors.push({ index: i, error: error.message });
            }
        }

        res.status(201).json({
            success: true,
            created: createdCases.length,
            failed: errors.length,
            data: createdCases,
            errors: errors
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
