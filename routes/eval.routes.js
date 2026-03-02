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
// TEMPORARY: Ultra-simplified to isolate 500 error
router.post('/test-benchmark', async (req, res) => {
    console.log("📌 test-benchmark route hit");
    console.log("Query:", req.query);
    console.log("Body:", req.body);
    console.log("Headers x-session-id:", req.headers["x-session-id"]);

    try {
        // Extract sessionId - MANDATORY
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
                message: "Initialize a model first using POST /api/model/initialize"
            });
        }

        const { benchmarkType } = req.body;

        console.log("🔎 benchmarkType:", benchmarkType);

        if (!benchmarkType) {
            console.log("❌ No benchmarkType provided");
            return res.status(400).json({
                success: false,
                error: "benchmarkType is required",
                validOptions: ["AIME", "MMLU", "MSUR"]
            });
        }

        console.log("✅ Route validation passed - returning simple response");
        
        // TEMPORARY: Super simple response to isolate crash
        // If this works, crash is in evaluation logic
        // If this crashes, it's route wiring
        return res.status(200).json({
            success: true,
            message: "Benchmark route reached successfully",
            sessionId: sessionId,
            benchmarkType: benchmarkType,
            status: "route_working",
            note: "Evaluation logic temporarily disabled for debugging"
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
