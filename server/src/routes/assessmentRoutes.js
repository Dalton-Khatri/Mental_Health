import express from 'express';
import multer from 'multer';
import prisma from '../prismaClient.js';
import fs from 'fs';
import FormData from 'form-data';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Every route below requires a valid login token
router.use(authMiddleware);

// TRANSCRIBE a single recording (proxy to Python Whisper service)
// Used during the adaptive interview to get per-question transcripts
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  try {
    const fileBuffer = fs.readFileSync(req.file.path);

    // Use Node's native FormData + File (Node 20+) for compatibility with Python FastAPI
    const pythonForm = new globalThis.FormData();
    const file = new globalThis.File([fileBuffer], req.file.originalname, {
      type: req.file.mimetype || 'audio/webm'
    });
    pythonForm.append('file', file);

    // Retry up to 2 times in case Python backend is briefly restarting
    let pyRes;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        pyRes = await fetch(`${process.env.ML_BACKEND_URL || 'http://localhost:8000'}/api/transcribe`, {
          method: 'POST',
          body: pythonForm
        });
        break; // success, exit retry loop
      } catch (fetchErr) {
        lastError = fetchErr;
        if (attempt < 1) {
          console.log(`Transcribe attempt ${attempt + 1} failed, retrying in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    if (!pyRes) {
      throw lastError || new Error('All transcribe attempts failed');
    }

    if (pyRes.ok) {
      const data = await pyRes.json();
      res.json(data);
    } else {
      const errText = await pyRes.text();
      console.error('Python transcribe service error:', errText);
      res.status(502).json({ error: 'Transcription service failed' });
    }
  } catch (err) {
    console.error('Failed to reach Python transcribe service:', err.message);
    res.status(502).json({ error: 'Transcription service unreachable' });
  } finally {
    // Clean up temp file (not needed after forwarding)
    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
  }
});

// SAVE a completed assessment
// Expects multipart/form-data with:
//   - "combinedAudio": one file (the full merged recording, sent to Python for transcription/prediction)
//   - "questionAudios": one file per question, in the same order as "metadata"
//   - "metadata": a JSON string — an array of objects, one per question, matching questionAudios by index:
//       [{ questionId, category, questionText, duration, timestamp, hadFollowUp, followUpText, followUpDuration }, ...]
//   - "followUpAudios" (optional): one file per follow-up, matched by the same index as metadata entries where hadFollowUp is true
router.post(
  '/',
  upload.fields([
    { name: 'combinedAudio', maxCount: 1 },
    { name: 'questionAudios', maxCount: 20 },
    { name: 'followUpAudios', maxCount: 20 }
  ]),
  async (req, res) => {
    try {
      const { metadata, totalDuration } = req.body;

      if (!metadata) {
        return res.status(400).json({ error: 'Missing metadata' });
      }

      let responsesMeta;
      try {
        responsesMeta = JSON.parse(metadata);
      } catch {
        return res.status(400).json({ error: 'Invalid metadata JSON' });
      }

      const questionAudioFiles = req.files?.questionAudios || [];
      const followUpAudioFiles = req.files?.followUpAudios || [];
      const combinedAudioFile = req.files?.combinedAudio?.[0];

      if (questionAudioFiles.length !== responsesMeta.length) {
        return res.status(400).json({ error: 'Number of question audio files does not match metadata entries' });
      }

      // Ask the Python transcription/prediction service to process the combined audio.
      // This runs on a different port (8000), so we call it over HTTP like the frontend does.
      let transcript = null;
      let prediction = null;
      let confidence = null;
      let conditionLabel = null;
      let conditionConfidence = null;
      let conditionScores = null;
      let causeLabel = null;
      let causeConfidence = null;
      let causeScores = null;
      let depressionPrediction = null;
      let depressionConfidence = null;

      if (combinedAudioFile) {
        try {
          const fileBuffer = fs.readFileSync(combinedAudioFile.path);

          // Use Node's native FormData + File (Node 20+) for compatibility with Python FastAPI
          const pythonForm = new globalThis.FormData();
          const file = new globalThis.File([fileBuffer], combinedAudioFile.originalname, {
            type: combinedAudioFile.mimetype || 'audio/wav'
          });
          pythonForm.append('file', file);

          // Forward pre-built transcript if available (avoids re-running Whisper)
          const preBuiltTranscript = req.body.preBuiltTranscript;
          if (preBuiltTranscript) {
            pythonForm.append('transcript', preBuiltTranscript);
          }

          const pyRes = await fetch(`${process.env.ML_BACKEND_URL || 'http://localhost:8000'}/api/assessment`, {
            method: 'POST',
            body: pythonForm
          });

          if (pyRes.ok) {
            const pyData = await pyRes.json();
            transcript = pyData.transcript || null;
            prediction = pyData.prediction || null;
            confidence = pyData.confidence != null ? parseFloat(pyData.confidence) : null;
            conditionLabel = pyData.conditionLabel || null;
            conditionConfidence = pyData.conditionConfidence != null ? parseFloat(pyData.conditionConfidence) : null;
            conditionScores = pyData.conditionScores || null;
            causeLabel = pyData.causeLabel || null;
            causeConfidence = pyData.causeConfidence != null ? parseFloat(pyData.causeConfidence) : null;
            causeScores = pyData.causeScores || null;
            depressionPrediction = pyData.depressionPrediction || null;
            depressionConfidence = pyData.depressionConfidence != null ? parseFloat(pyData.depressionConfidence) : null;
          } else {
            console.error('Python assessment service returned an error:', await pyRes.text());
          }
        } catch (err) {
          console.error('Failed to reach Python assessment service:', err.message);
        }
      }


      // Build the AssessmentResponse rows, pairing each question with its audio file and (optional) follow-up
      let followUpIndex = 0;
      const responseData = responsesMeta.map((r, i) => {
        const followUpAudioUrl = r.hadFollowUp && followUpAudioFiles[followUpIndex]
          ? `/uploads/${followUpAudioFiles[followUpIndex++].filename}`
          : null;

        return {
          questionId: r.questionId,
          category: r.category,
          questionText: r.questionText,
          audioUrl: `/uploads/${questionAudioFiles[i].filename}`,
          duration: parseFloat(r.duration) || 0,
          timestamp: new Date(r.timestamp),
          hadFollowUp: !!r.hadFollowUp,
          followUpText: r.followUpText || null,
          followUpAudioUrl,
          followUpDuration: r.followUpDuration != null ? parseFloat(r.followUpDuration) : null
        };
      });

      const assessment = await prisma.assessment.create({
        data: {
          userId: req.userId,
          combinedAudioUrl: combinedAudioFile ? `/uploads/${combinedAudioFile.filename}` : null,
          totalDuration: parseFloat(totalDuration) || 0,
          prediction,
          confidence,
          transcript,
          conditionLabel,
          conditionConfidence,
          conditionScores,
          causeLabel,
          causeConfidence,
          causeScores,
          depressionPrediction,
          depressionConfidence,
          responses: {
            create: responseData
          }
        },
        include: { responses: true }
      });

      res.status(201).json(assessment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to save assessment' });
    }
  }
);

// GET this user's assessment history (list view — no per-question detail)
router.get('/', async (req, res) => {
  try {
    const assessments = await prisma.assessment.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalDuration: true,
        prediction: true,
        confidence: true,
        transcript: true,
        conditionLabel: true,
        conditionConfidence: true,
        conditionScores: true,
        causeLabel: true,
        causeConfidence: true,
        causeScores: true,
        depressionPrediction: true,
        depressionConfidence: true,
        createdAt: true
      }
    });
    res.json(assessments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// GET one specific assessment, including every question's response
router.get('/:id', async (req, res) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { responses: true }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json(assessment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

export default router;