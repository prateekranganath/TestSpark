import { judge_response } from "../services/judgeservice.js";
import Judgement from "../models/judgement.js";
import ModelResponse from "../models/modelresponse.js";

// Judge a model response
export const judgeModelResponse = async (req, res) => {
    try {
        const { evalRunId, testCaseId, modelResponseId } = req.body;

        if (!evalRunId || !testCaseId || !modelResponseId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: evalRunId, testCaseId, modelResponseId"
            });
        }

        const judgement = await judge_response({ evalRunId, testCaseId, modelResponseId });

        res.status(200).json({
            success: true,
            data: judgement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get judgement by ID
export const getJudgementById = async (req, res) => {
    try {
        const { judgementId } = req.params;

        const judgement = await Judgement.findById(judgementId)
            .populate('testCaseId')
            .populate('modelResponseId');

        if (!judgement) {
            return res.status(404).json({
                success: false,
                message: "Judgement not found"
            });
        }

        res.status(200).json({
            success: true,
            data: judgement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all judgements for an eval run
export const getJudgementsByEvalRun = async (req, res) => {
    try {
        const { evalRunId } = req.params;
        const { passed, minScore, maxScore } = req.query;

        const query = { evalRunId };
        
        if (passed !== undefined) {
            query.passed = passed === 'true';
        }
        
        if (minScore !== undefined) {
            query.score = { ...query.score, $gte: parseFloat(minScore) };
        }
        
        if (maxScore !== undefined) {
            query.score = { ...query.score, $lte: parseFloat(maxScore) };
        }

        const judgements = await Judgement.find(query)
            .populate('testCaseId')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: judgements.length,
            data: judgements
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get judgements for a specific test case
export const getJudgementsByTestCase = async (req, res) => {
    try {
        const { testCaseId } = req.params;

        const judgements = await Judgement.find({ testCaseId })
            .populate('modelResponseId')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: judgements.length,
            data: judgements
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get statistics for judgements
export const getJudgementStats = async (req, res) => {
    try {
        const { evalRunId } = req.params;

        const judgements = await Judgement.find({ evalRunId });

        if (judgements.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No judgements found for this eval run"
            });
        }

        const stats = {
            total: judgements.length,
            passed: judgements.filter(j => j.passed).length,
            failed: judgements.filter(j => !j.passed).length,
            averageScore: judgements.reduce((sum, j) => sum + j.score, 0) / judgements.length,
            averageCriteria: {
                accuracy: 0,
                relevance: 0,
                coherence: 0,
                completeness: 0
            },
            scoreDistribution: {
                '0-2': 0,
                '2-4': 0,
                '4-6': 0,
                '6-8': 0,
                '8-10': 0
            }
        };

        // Calculate average criteria scores
        let criteriaCount = 0;
        judgements.forEach(j => {
            if (j.criteria) {
                if (j.criteria.accuracy !== undefined) {
                    stats.averageCriteria.accuracy += j.criteria.accuracy;
                }
                if (j.criteria.relevance !== undefined) {
                    stats.averageCriteria.relevance += j.criteria.relevance;
                }
                if (j.criteria.coherence !== undefined) {
                    stats.averageCriteria.coherence += j.criteria.coherence;
                }
                if (j.criteria.completeness !== undefined) {
                    stats.averageCriteria.completeness += j.criteria.completeness;
                }
                criteriaCount++;
            }

            // Calculate score distribution
            const score = j.score;
            if (score < 2) stats.scoreDistribution['0-2']++;
            else if (score < 4) stats.scoreDistribution['2-4']++;
            else if (score < 6) stats.scoreDistribution['4-6']++;
            else if (score < 8) stats.scoreDistribution['6-8']++;
            else stats.scoreDistribution['8-10']++;
        });

        if (criteriaCount > 0) {
            stats.averageCriteria.accuracy /= criteriaCount;
            stats.averageCriteria.relevance /= criteriaCount;
            stats.averageCriteria.coherence /= criteriaCount;
            stats.averageCriteria.completeness /= criteriaCount;
        }

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};