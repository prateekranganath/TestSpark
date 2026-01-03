import { runEvaluation } from "../services/evalservice.js";
import EvalRun from "../models/evalrun.js";

import ModelResponse from "../models/modelresponse.js";
import Judgement from "../models/judgement.js";

// Create a new evaluation run
export const createEvalRun = async (req, res) => {
    try {
        const {
            runName,
            description,
            modelUnderTest,
            judgeModel,
            testCaseIds,
            configuration,
            tags
        } = req.body;

        // Validate required fields
        if (!runName || !modelUnderTest?.name || !judgeModel?.name || !testCaseIds?.length) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: runName, modelUnderTest.name, judgeModel.name, testCaseIds"
            });
        }

        // Create eval run
        const evalRun = await EvalRun.create({
            runName,
            description,
            modelUnderTest,
            judgeModel,
            testCaseIds,
            configuration: configuration || {},
            tags: tags || [],
            metrics: {
                totalTestCases: testCaseIds.length
            }
        });

        res.status(201).json({
            success: true,
            data: evalRun
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Start an evaluation run
export const startEvalRun = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findById(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        if (evalRun.status === 'running') {
            return res.status(400).json({
                success: false,
                message: "Eval run is already running"
            });
        }

        // Update status to running
        evalRun.status = 'running';
        evalRun.startTime = new Date();
        await evalRun.save();

        // Run evaluations asynchronously
        runEvaluationBatch(evalRunId, evalRun.testCaseIds, evalRun.modelUnderTest.name);

        res.status(200).json({
            success: true,
            message: "Evaluation run started",
            data: evalRun
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Helper function to run batch evaluations
async function runEvaluationBatch(evalRunId, testCaseIds, model) {
    try {
        for (const testCaseId of testCaseIds) {
            try {
                await runEvaluation({ evalRunId, testCaseId, model });
                console.log(`✓ Successfully evaluated test case ${testCaseId}`);
            } catch (error) {
                console.error(`✗ Failed to evaluate test case ${testCaseId}:`, error.message);
                console.error('Full error:', error);
            }
        }

        // Update eval run status
        const evalRun = await EvalRun.findById(evalRunId);
        if (evalRun) {
            evalRun.status = 'completed';
            evalRun.endTime = new Date();
            evalRun.duration = evalRun.endTime - evalRun.startTime;

            // Calculate average score
            const judgements = await Judgement.find({ evalRunId });
            if (judgements.length > 0) {
                const avgScore = judgements.reduce((sum, j) => sum + j.score, 0) / judgements.length;
                evalRun.metrics.averageScore = avgScore;
            }

            await evalRun.save();
        }
    } catch (error) {
        // Mark as failed
        await EvalRun.findByIdAndUpdate(evalRunId, { status: 'failed' });
        console.error(`Eval run ${evalRunId} failed:`, error.message);
    }
}

// Run single evaluation
export const runSingleEvaluation = async (req, res) => {
    try {
        const { evalRunId, testCaseId, model } = req.body;

        if (!evalRunId || !testCaseId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: evalRunId, testCaseId"
            });
        }

        const result = await runEvaluation({ evalRunId, testCaseId, model });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get evaluation run status
export const getEvalRunStatus = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findById(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        res.status(200).json({
            success: true,
            data: evalRun
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get evaluation run results
export const getEvalRunResults = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findById(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        const modelResponses = await ModelResponse.find({ evalRunId });
        const judgements = await Judgement.find({ evalRunId }).populate('testCaseId');

        res.status(200).json({
            success: true,
            data: {
                evalRun,
                modelResponses,
                judgements
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all evaluation runs
export const getAllEvalRuns = async (req, res) => {
    try {
        const { status, limit = 50, skip = 0 } = req.query;

        const query = status ? { status } : {};
        const evalRuns = await EvalRun.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        res.status(200).json({
            success: true,
            count: evalRuns.length,
            data: evalRuns
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete evaluation run
export const deleteEvalRun = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const evalRun = await EvalRun.findByIdAndDelete(evalRunId);
        if (!evalRun) {
            return res.status(404).json({
                success: false,
                message: "Eval run not found"
            });
        }

        // Clean up associated data
        await ModelResponse.deleteMany({ evalRunId });
        await Judgement.deleteMany({ evalRunId });

        res.status(200).json({
            success: true,
            message: "Eval run deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
