import express from 'express';
import {
    createEvalRun,
    startEvalRun,
    runSingleEvaluation,
    getEvalRunStatus,
    getEvalRunResults,
    getAllEvalRuns,
    deleteEvalRun
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

// Start an evaluation run
router.post('/runs/:evalRunId/start', startEvalRun);

// Run single evaluation
router.post('/evaluate', runSingleEvaluation);

// Delete evaluation run
router.delete('/runs/:evalRunId', deleteEvalRun);

export default router;
