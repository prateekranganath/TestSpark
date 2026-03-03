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
    compareModels
} from '../controllers/eval.controller.js';
import { getModelConfig } from '../services/sessionservice.js';

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
router.post('/test-benchmark', testModelWithBenchmark);

// Comprehensive test: Generated cases + All benchmarks
router.post('/comprehensive-test', comprehensiveModelTest);

// Custom dataset evaluation
router.post('/custom-dataset', async (req, res) => {
    try {
        console.log("📌 CUSTOM DATASET ROUTE HIT");
        console.log("Query:", req.query);
        console.log("Body:", req.body);

        const sessionId =
            req.query.sessionId ||
            req.headers['x-session-id'] ||
            req.body.sessionId;

        console.log("🔎 Extracted sessionId:", sessionId);

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: "sessionId required"
            });
        }

        const session = await getModelConfig(sessionId);

        console.log("🔎 Session from DB:", session);

        if (!session || !session.modelName) {
            return res.status(400).json({
                success: false,
                error: "No model configured for this session"
            });
        }

        const { evaluationType, dataset } = req.body;

        console.log("🔎 EvalType:", evaluationType);
        console.log("🔎 Dataset length:", dataset?.length);

        if (!Array.isArray(dataset)) {
            return res.status(400).json({
                success: false,
                error: "dataset must be array"
            });
        }

        // 👇 Temporarily return simple success for debugging
        return res.json({
            success: true,
            debug: true,
            message: "Route working with valid session + dataset",
            sessionId,
            datasetSize: dataset.length
        });

    } catch (error) {
        console.error("🔥 CUSTOM DATASET ROUTE ERROR:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete evaluation run
router.delete('/runs/:evalRunId', deleteEvalRun);

// Frontend compatibility aliases
router.post('/custom', customDatasetEval);  // Alias for /custom-dataset
router.post('/benchmark', testModelWithBenchmark);  // Alias for /test-benchmark
router.get('/history', getAllEvalRuns);  // Alias for /runs

// Dashboard and comparison endpoints
router.get('/dashboard', getDashboardStats);
router.get('/compare', compareModels);

export default router;
