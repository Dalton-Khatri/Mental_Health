// Gemini embedder (gemini-embedding-001)
import fetch from 'node-fetch';

// Gemini API key must be set in env as GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Get a vector embedding for a piece of text using Google Gemini embedding model.
 * Returns an array of numbers (the embedding).
 */
async function getEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${GEMINI_API_KEY}`;
  const payload = {
    requests: [{
      content: { parts: [{ text }], role: 'user' },
      taskType: 'RETRIEVAL_QUERY'
    }]
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('Gemini embedding error', data);
    throw new Error('Failed to get embedding from Gemini');
  }
  // The API returns an array of embeddings inside "embeddings".
  return data.embeddings?.[0]?.values ?? [];
}

module.exports = { getEmbedding };
