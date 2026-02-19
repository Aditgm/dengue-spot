const express = require('express');
const router = express.Router();
const axios = require('axios');
const { searchKnowledge, localSearch } = require('../config/pinecone');
const redisClient = require('../config/redis');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MAX_MEMORY_MESSAGES = 20;
const MEMORY_TTL = 3600;

const SYSTEM_PROMPT = `You are DengueSpot AI — a friendly, knowledgeable dengue prevention assistant built into the DengueSpot app. 

PERSONALITY:
- Warm, caring, and professional
- Use simple language anyone can understand
- Add relevant emojis sparingly for friendliness (🦟💧🏥)
- Be concise but thorough — aim for 2-3 paragraphs max
- When discussing symptoms, always advise consulting a doctor
- For emergencies, immediately provide helpline numbers

STRICT RULES:
1. ONLY answer questions related to dengue, mosquitoes, health, prevention, and the DengueSpot app
2. If asked something unrelated (politics, random topics, coding, etc.), politely redirect: "I'm specialized in dengue prevention and health. How can I help you with dengue-related questions? 🦟"
3. ALWAYS base your answers strictly on the provided KNOWLEDGE CONTEXT. Do NOT invent, fabricate, or assume any information not present in the context.
4. If the knowledge context doesn't cover the question, say: "I don't have specific information about that in my knowledge base, but here's what I generally know..." and give brief general guidance.
5. For medical emergencies, always say: "Call 108 ambulance or go to the nearest hospital immediately"
6. Never provide specific medical dosages — always say "consult your doctor for dosage"
7. NEVER mention or invent app features that don't exist. The ONLY real DengueSpot features are:
   - **Scan** [NAV:scan]: AI-powered mosquito breeding site scanner (Roboflow image recognition)
   - **Checklist** [NAV:checklist]: Weekly prevention checklist for home and neighborhood
   - **Hotspot Map** [NAV:map]: Community reporting with geolocation mapping
   - **Learn** [NAV:learn]: Educational content about dengue (facts, myths vs facts)
   - **Community Chat** [NAV:community]: Real-time city/area-based chat rooms for community discussions
   - **Weather Alert**: Real-time weather-based dengue risk assessment
   - **Leaderboard**: Top community reporters ranking
   - **News Ticker**: Real-time dengue news updates
   - **AI Chatbot**: This assistant (you)
   Do NOT mention features like "Symptom Tracker", "Symptom Checker", "Forum", "Doctor Finder", "Report Generator", or any feature not listed above.
8. When a user greets you (hi, hello, hey), respond warmly and briefly mention what you can help with. Do NOT list app features unless explicitly asked.
9. Keep answers focused and practical. Prefer actionable advice over lengthy explanations.
10. NAVIGATION LINKS: When referring users to a specific app section, include the navigation tag [NAV:tabname] after mentioning it. Valid tab names are: scan, checklist, map, learn, community. Example: "Check the Community tab [NAV:community] to join chat rooms." The app will automatically convert these into clickable buttons. Always include the [NAV:...] tag when directing users to a section.

FORMAT:
- Use short paragraphs
- Use bullet points for lists
- Bold key terms with **term**
- Keep responses under 250 words unless the user asks for detailed information`;

async function getMemory(sessionId) {
  try {
    const key = `chat:session:${sessionId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Memory read error:', error.message);
    return [];
  }
}

async function saveMemory(sessionId, messages) {
  try {
    const key = `chat:session:${sessionId}`;
    const trimmed = messages.slice(-MAX_MEMORY_MESSAGES);
    await redisClient.set(key, JSON.stringify(trimmed), 'EX', MEMORY_TTL);
  } catch (error) {
    console.error('Memory save error:', error.message);
  }
}

async function clearMemory(sessionId) {
  try {
    const key = `chat:session:${sessionId}`;
    await redisClient.del(key);
  } catch (error) {
    console.error('Memory clear error:', error.message);
  }
}

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const response = await axios.post(GROQ_API_URL, {
    model: GROQ_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 800,
    top_p: 0.85,
    stream: false
  }, {
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return response.data.choices[0].message.content;
}

function generateFallbackResponse(query, knowledgeChunks) {
  if (knowledgeChunks.length === 0) {
    return "I don't have specific information about that in my knowledge base. Could you ask about dengue symptoms, prevention, treatment, or the DengueSpot app features? 🦟";
  }

  // Use the best matching chunk as the response
  const best = knowledgeChunks[0];
  let response = `**${best.title}**\n\n${best.content}`;

  // If there are more relevant chunks, add a brief mention
  if (knowledgeChunks.length > 1) {
    response += `\n\n💡 I also have information about: ${knowledgeChunks.slice(1, 3).map(c => c.title).join(', ')}. Feel free to ask!`;
  }

  return response;
}

router.post('/', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId are required'
      });
    }

    // Check if user is authenticated
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let isAuthenticated = false;

    if (token) {
      try {
        const decoded = verifyToken(token);
        isAuthenticated = !!(decoded && decoded.userId);
      } catch (e) {
        isAuthenticated = false;
      }
    }

    // Rate limit for unauthenticated users (max 2 messages per session)
    if (!isAuthenticated) {
      const guestKey = `chat:guest:${sessionId}`;
      let guestCount = 0;
      try {
        const stored = await redisClient.get(guestKey);
        guestCount = stored ? parseInt(stored) : 0;
      } catch (e) { /* Redis fail, allow */ }

      if (guestCount >= 2) {
        return res.json({
          success: true,
          response: "🔒 You've reached the free question limit! Please **log in** to continue chatting with DengueSpot AI. Logging in gives you unlimited questions, personalized advice, and conversation memory. Click the **Login** button at the top to get started! 🦟",
          metadata: { rateLimited: true, requiresLogin: true }
        });
      }

      // Increment guest message count (expire in 24 hours)
      try {
        await redisClient.set(guestKey, (guestCount + 1).toString(), 'EX', 86400);
      } catch (e) { /* ignore */ }
    }

    let knowledgeChunks = [];
    let retrievalMethod = 'none';

    try {
      if (process.env.PINECONE_API_KEY) {
        knowledgeChunks = await searchKnowledge(message, 5);
        retrievalMethod = 'pinecone';
      }
    } catch (err) {
      console.warn('⚠️ Pinecone search failed, falling back to local:', err.message);
    }

    if (knowledgeChunks.length === 0) {
      knowledgeChunks = localSearch(message, 5);
      retrievalMethod = retrievalMethod === 'none' ? 'local' : retrievalMethod;
    }

    const memory = await getMemory(sessionId);

    const contextText = knowledgeChunks.length > 0
      ? knowledgeChunks.map((c, i) => `[Source ${i + 1}: ${c.title}]\n${c.content}`).join('\n\n')
      : 'No specific knowledge found for this query.';

    const groqMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `KNOWLEDGE CONTEXT (use this to answer):\n\n${contextText}` }
    ];

    // Add conversation memory (past messages)
    if (memory.length > 0) {
      groqMessages.push(...memory);
    }

    groqMessages.push({ role: 'user', content: message });

    let botResponse;
    let usedLLM = false;

    if (GROQ_API_KEY) {
      try {
        botResponse = await callGroq(groqMessages);
        usedLLM = true;
      } catch (err) {
        console.error('⚠️ Groq API error:', err.response?.data?.error?.message || err.message);
        botResponse = generateFallbackResponse(message, knowledgeChunks);
      }
    } else {
      botResponse = generateFallbackResponse(message, knowledgeChunks);
    }

    const updatedMemory = [
      ...memory,
      { role: 'user', content: message },
      { role: 'assistant', content: botResponse }
    ];
    await saveMemory(sessionId, updatedMemory);

    res.json({
      success: true,
      response: botResponse,
      metadata: {
        retrievalMethod,
        chunksUsed: knowledgeChunks.length,
        memoryMessages: memory.length,
        usedLLM,
        model: usedLLM ? GROQ_MODEL : 'fallback'
      }
    });

  } catch (error) {
    console.error('❌ Chat error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      response: "I'm having trouble right now. Please try again in a moment. 🙏"
    });
  }
});

router.get('/user-info', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.json({ success: true, name: null, authenticated: false });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.json({ success: true, name: null, authenticated: false });
    }

    const user = await User.findById(decoded.userId).select('name email avatar').lean();
    if (!user) {
      return res.json({ success: true, name: null, authenticated: false });
    }

    res.json({
      success: true,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      authenticated: true
    });
  } catch (error) {
    console.error('User info error:', error.message);
    res.json({ success: true, name: null, authenticated: false });
  }
});

router.delete('/memory/:sessionId', async (req, res) => {
  try {
    await clearMemory(req.params.sessionId);
    res.json({ success: true, message: 'Conversation memory cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to clear memory' });
  }
});

module.exports = router;
