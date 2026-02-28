import express from 'express';
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
    customDatasetEval
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

// Test model with complete benchmark validation
router.post('/test-benchmark', testModelWithBenchmark);

// Comprehensive test: Generated cases + All benchmarks
router.post('/comprehensive-test', comprehensiveModelTest);

// Custom dataset evaluation
router.post('/custom-dataset', customDatasetEval);

// Delete evaluation run
router.delete('/runs/:evalRunId', deleteEvalRun);

export default router;
