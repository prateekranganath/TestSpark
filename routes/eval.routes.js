import express from 'express';
import TestCase from '../models/testcase.js';
import {
    createEvalRun,
    startEvalRun,
    runSingleEvaluation,
    getEvalRunStatus,
    getEvalRunResults,
    getAllEvalRuns,
    deleteEvalRun,
    getBenchmarkStatistics,
    testModelWithBenchmark,
    comprehensiveModelTest,
    customDatasetEval,
    getDashboardStats,
    compareModels,
    runBenchmarkSuite
} from '../controllers/eval.controller.js';

const router = express.Router();

// Create a new evaluation run
router.post('/runs', createEvalRun);

// Get all evaluation runs
router.get('/runs', getAllEvalRuns);

// Get evaluation run status
router.get('/runs/:evalRunId', getEvalRunStatus);

// Get evaluation run results
router.get('/runs/:evalRunId/results', getEvalRunResults);

// Get benchmark statistics
router.get('/runs/:evalRunId/benchmark-stats', getBenchmarkStatistics);

// Start an evaluation run
router.post('/runs/:evalRunId/start', startEvalRun);

// Run single evaluation
router.post('/evaluate', runSingleEvaluation);

// Test model with full benchmark suite (AIME, MMLU, MSUR)
// NEW: Accepts benchmarkType instead of testCaseId
// Inline handler with detailed logging for debugging
router.post('/test-benchmark', async (req, res) => {
    console.log("📌 test-benchmark route hit");
    console.log("Query:", req.query);
    console.log("Body:", req.body);
    console.log("Headers x-session-id:", req.headers["x-session-id"]);

    try {
        const sessionId =
            req.query.sessionId ||
            req.headers["x-session-id"] ||
            req.body.sessionId;

        console.log("🔎 Extracted sessionId:", sessionId);

        if (!sessionId) {
            console.log("❌ No sessionId provided");
            return res.status(400).json({
                success: false,
                error: "sessionId is required",
            });
        }

        const { benchmarkType } = req.body;

        console.log("🔎 benchmarkType:", benchmarkType);

        if (!benchmarkType) {
            console.log("❌ No benchmarkType provided");
            return res.status(400).json({
                success: false,
                error: "benchmarkType is required",
            });
        }

        // Fetch test cases from database
        console.log("📚 Querying database for benchmarkType:", benchmarkType);
        const testCases = await TestCase.find({ 
            'metadata.benchmarkType': benchmarkType.toUpperCase() 
        });

        console.log("📦 Found testCases:", testCases ? testCases.length : 0);

        if (!testCases || testCases.length === 0) {
            console.log("❌ No test cases found for:", benchmarkType);
            return res.status(400).json({
                success: false,
                error: "No test cases found for this benchmarkType",
                benchmarkType: benchmarkType
            });
        }

        console.log("✅ Benchmark loaded successfully");
        
        // Placeholder response for now (to isolate crash)
        return res.status(200).json({
            success: true,
            message: `Benchmark ${benchmarkType} loaded successfully`,
            benchmarkType: benchmarkType,
            totalProblems: testCases.length,
            status: "loaded"
        });

    } catch (error) {
        console.error("❌ BENCHMARK ROUTE ERROR:");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);

        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

// Comprehensive test: Generated cases + All benchmarks
router.post('/comprehensive-test', comprehensiveModelTest);

// Custom dataset evaluation
router.post('/custom-dataset', customDatasetEval);

// Delete evaluation run
router.delete('/runs/:evalRunId', deleteEvalRun);

// Frontend compatibility aliases
router.post('/custom', customDatasetEval);  // Alias for /custom-dataset
router.post('/benchmark', runBenchmarkSuite);  // Alias for /test-benchmark (updated)
router.get('/history', getAllEvalRuns);  // Alias for /runs

// Dashboard and comparison endpoints
router.get('/dashboard', getDashboardStats);
router.get('/compare', compareModels);

export default router;
