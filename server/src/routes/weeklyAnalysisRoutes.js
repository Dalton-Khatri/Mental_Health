const express = require('express');
const prisma = require('../prismaClient');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Every route below requires a valid login token
router.use(authMiddleware);

/**
 * GET /api/weekly-analysis
 *
 * Generates a weekly wellness analysis for the logged-in user by:
 * 1. Collecting all assessments + screenings from the past 7 days
 * 2. Sending their transcripts to the Python ML backend for batch analysis
 * 3. Aggregating and returning a structured weekly report
 */
router.get('/', async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent assessments with condition/cause data
    const assessments = await prisma.assessment.findMany({
      where: {
        userId: req.userId,
        createdAt: { gte: sevenDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        transcript: true,
        conditionLabel: true,
        conditionConfidence: true,
        causeLabel: true,
        causeConfidence: true,
        depressionPrediction: true,
        depressionConfidence: true,
        totalDuration: true,
        createdAt: true,
      }
    });

    // Fetch recent screenings
    const screenings = await prisma.screening.findMany({
      where: {
        userId: req.userId,
        createdAt: { gte: sevenDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        conditionLabel: true,
        conditionConfidence: true,
        causeLabel: true,
        causeConfidence: true,
        createdAt: true,
      }
    });

    // Combine all entries for aggregation
    const allEntries = [
      ...assessments.map(a => ({
        type: 'assessment',
        conditionLabel: a.conditionLabel,
        causeLabel: a.causeLabel,
        conditionConfidence: a.conditionConfidence,
        causeConfidence: a.causeConfidence,
        transcript: a.transcript,
        createdAt: a.createdAt,
      })),
      ...screenings.map(s => ({
        type: 'screening',
        conditionLabel: s.conditionLabel,
        causeLabel: s.causeLabel,
        conditionConfidence: s.conditionConfidence,
        causeConfidence: s.causeConfidence,
        transcript: null,
        createdAt: s.createdAt,
      }))
    ];

    // If there are transcripts without ML results, send them for analysis
    const transcriptsNeedingAnalysis = assessments
      .filter(a => a.transcript && !a.conditionLabel)
      .map(a => a.transcript);

    let batchResults = null;
    if (transcriptsNeedingAnalysis.length > 0) {
      try {
        const pyRes = await fetch('http://localhost:8000/api/analyze-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: transcriptsNeedingAnalysis })
        });
        if (pyRes.ok) {
          batchResults = await pyRes.json();
        }
      } catch (err) {
        console.error('Failed to reach Python service for batch analysis:', err.message);
      }
    }

    // Aggregate condition distribution
    const conditionCounts = {};
    const causeCounts = {};
    let totalSessions = 0;
    let totalDuration = 0;

    for (const entry of allEntries) {
      if (entry.conditionLabel) {
        conditionCounts[entry.conditionLabel] = (conditionCounts[entry.conditionLabel] || 0) + 1;
        totalSessions++;
      }
      if (entry.causeLabel) {
        causeCounts[entry.causeLabel] = (causeCounts[entry.causeLabel] || 0) + 1;
      }
    }

    // Add duration from assessments
    for (const a of assessments) {
      totalDuration += a.totalDuration || 0;
    }

    // Determine dominant condition and risk level
    const dominantCondition = Object.entries(conditionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Normal';

    const dominantCause = Object.entries(causeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'No reason';

    const riskLevels = {
      'Normal': 'low',
      'Stress': 'moderate',
      'Anxiety': 'moderate',
      'Depression': 'high',
      'Suicidal': 'critical'
    };

    // Build daily breakdown
    const dailyBreakdown = {};
    for (const entry of allEntries) {
      const day = new Date(entry.createdAt).toISOString().split('T')[0];
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { sessions: 0, conditions: [] };
      }
      dailyBreakdown[day].sessions++;
      if (entry.conditionLabel) {
        dailyBreakdown[day].conditions.push(entry.conditionLabel);
      }
    }

    // Generate text insights
    const insights = [];
    if (totalSessions === 0) {
      insights.push('No sessions recorded this week. Try doing a voice check-in to track your wellness.');
    } else {
      insights.push(`You completed ${totalSessions} session${totalSessions > 1 ? 's' : ''} this week.`);

      if (dominantCondition === 'Normal') {
        insights.push('Your overall mental state appears stable. Keep up the great self-care routine!');
      } else if (dominantCondition === 'Stress' || dominantCondition === 'Anxiety') {
        insights.push(`Signs of ${dominantCondition.toLowerCase()} were detected in your sessions. Consider trying some breathing exercises or mindfulness activities.`);
      } else if (dominantCondition === 'Depression') {
        insights.push('Some signs of depression were detected. Please consider reaching out to a mental health professional or a trusted person.');
      } else if (dominantCondition === 'Suicidal') {
        insights.push('Critical indicators were detected. Please reach out to a crisis helpline or mental health professional immediately.');
      }

      if (dominantCause && dominantCause !== 'No reason') {
        insights.push(`The primary contributing factor appears to be related to: ${dominantCause.toLowerCase()}.`);
      }

      if (totalDuration > 0) {
        const minutes = Math.round(totalDuration / 60);
        insights.push(`Total reflection time: ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
      }
    }

    res.json({
      period: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
      totalSessions,
      totalDuration: Math.round(totalDuration),
      dominantCondition,
      dominantCause,
      riskLevel: riskLevels[dominantCondition] || 'unknown',
      conditionDistribution: conditionCounts,
      causeDistribution: causeCounts,
      dailyBreakdown,
      insights,
      assessments: assessments.map(a => ({
        id: a.id,
        conditionLabel: a.conditionLabel,
        causeLabel: a.causeLabel,
        createdAt: a.createdAt,
      })),
      screenings: screenings.map(s => ({
        id: s.id,
        conditionLabel: s.conditionLabel,
        causeLabel: s.causeLabel,
        createdAt: s.createdAt,
      })),
      batchAnalysis: batchResults?.summary || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate weekly analysis' });
  }
});

module.exports = router;
