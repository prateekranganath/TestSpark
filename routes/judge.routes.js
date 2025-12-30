import express from 'express';
import {
    judgeModelResponse,
    getJudgementById,
    getJudgementsByEvalRun,
    getJudgementsByTestCase,
    getJudgementStats
} from '../controllers/judge.controller.js';

const router = express.Router();

// Judge a model response
router.post('/judge', judgeModelResponse);

// Get judgement by ID
router.get('/judgements/:judgementId', getJudgementById);

// Get judgements by eval run
router.get('/evalrun/:evalRunId/judgements', getJudgementsByEvalRun);

// Get judgement statistics for eval run
router.get('/evalrun/:evalRunId/stats', getJudgementStats);

// Get judgements by test case
router.get('/testcase/:testCaseId/judgements', getJudgementsByTestCase);

export default router;
