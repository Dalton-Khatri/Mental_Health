// Gemini embedder (gemini-embedding-001)


/**
 * Get a vector embedding for a piece of text using Google Gemini embedding model.
 * Returns an array of numbers (the embedding).
 */
async function getEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set');
    return [];
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${apiKey}`;
    const payload = {
  model: "embedding-001",
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
      console.warn('Gemini embedding error:', data?.error?.message || 'Failed to get embedding');
      return [];
    }
    return data.embeddings?.[0]?.values ?? [];
  } catch (err) {
    console.warn('Gemini embedding request exception:', err.message);
    return [];
  }
}

export { getEmbedding };
