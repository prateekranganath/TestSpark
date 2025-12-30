import express from 'express';
import {
    generateTestCasesFromParent,
    createTestCase,
    getAllTestCases,
    getTestCaseById,
    updateTestCase,
    deleteTestCase,
    bulkCreateTestCases
} from '../controllers/generator.controller.js';

const router = express.Router();

// Generate test cases from parent
router.post('/generate', generateTestCasesFromParent);

// Create single test case
router.post('/testcases', createTestCase);

// Bulk create test cases
router.post('/testcases/bulk', bulkCreateTestCases);

// Get all test cases
router.get('/testcases', getAllTestCases);

// Get test case by ID
router.get('/testcases/:testCaseId', getTestCaseById);

// Update test case
router.patch('/testcases/:testCaseId', updateTestCase);

// Delete test case
router.delete('/testcases/:testCaseId', deleteTestCase);

export default router;
