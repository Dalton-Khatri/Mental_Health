// ragService.js – core RAG logic
const { getEmbedding } = require('./embedder.js');
const { search, getAll } = require('./vectorStore.js');

// OpenAI ChatCompletion – fallback LLM
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('OpenAI chat error', data);
    throw new Error('LLM request failed');
  }
  return data.choices[0].message.content;
}

// Simple moderation using OpenAI moderation endpoint
async function moderate(content) {
  if (!OPENAI_API_KEY) return false;
  const resp = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: content }),
  });
  const data = await resp.json();
  return data.results?.[0]?.flagged ?? false;
}

/**
 * Process a user message and return the assistant reply.
 * @param {string} userMessage – raw user text
 * @param {Array<{role:string, content:string}>} [history] – optional prior chat history
 */
export async function processMessage(userMessage, history = []) {
  // moderation
  if (await moderate(userMessage)) {
    return 'I’m sorry, I can’t help with that request.';
  }

  // embed user query
  const queryEmbedding = await getEmbedding(userMessage);

  // retrieve top‑k relevant chunks
  const topChunks = search(queryEmbedding, 5);
  const retrievedTexts = topChunks.map((c) => c.text).join('\n---\n');

  // build system prompt
  const systemPrompt = `You are a helpful mental‑health assistant. Use only the provided context to answer the user. If the context does not contain enough information, answer politely that you don\'t have enough data. Do not give medical advice beyond the data.\n\nContext:\n${retrievedTexts}`;

  // compose message list for LLM
  const messages = [{ role: 'system', content: systemPrompt }];
  // include last 5 messages from history (if any)
  const recent = history.slice(-5);
  messages.push(...recent);
  messages.push({ role: 'user', content: userMessage });

  // call LLM
  const reply = await callOpenAI(messages);
  return reply;
}

export { getAll as getVectorCache };
