// chatController.js – Express route for chat endpoint
import express from 'express';
import { processMessage, getVectorCache } from './ragService.js';

const router = express.Router();

// In‑memory conversation history per user (session scoped only)
const userHistories = new Map();

/**
 * POST /api/chat/message
 * Body: { content: string, userId?: string }
 */
router.post('/message', async (req, res) => {
  try {
    const { content, userId } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }
    const history = userId ? userHistories.get(userId) ?? [] : [];
    const reply = await processMessage(content, history);

    // update history (store only role/content)
    if (userId) {
      const newHistory = [...history, { role: 'user', content }, { role: 'assistant', content: reply }];
      // keep a reasonable length (e.g., last 20 messages)
      userHistories.set(userId, newHistory.slice(-20));
    }
    return res.json({ reply });
  } catch (e) {
    console.error('Chat error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
