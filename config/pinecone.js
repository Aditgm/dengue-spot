const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'denguespot-kb';
const NAMESPACE = 'dengue-knowledge';

let _pinecone = null;
function getPinecone() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY not configured');
  }
  if (!_pinecone) {
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return _pinecone;
}

async function getIndex() {
  return getPinecone().index(INDEX_NAME);
}

async function generateEmbedding(text) {
  const pc = getPinecone();
  const result = await pc.inference.embed({
    model: 'multilingual-e5-large',
    inputs: [text],
    parameters: { inputType: 'query' }
  });
  return result.data[0].values;
}

async function seedKnowledgeBase() {
  try {
    const index = await getIndex();
    const ns = index.namespace(NAMESPACE);

    const kbPath = path.join(__dirname, '..', 'data', 'dengue-knowledge-base.json');
    const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    const chunks = kb.chunks;
    const expectedCount = chunks.length;

    // Check if already seeded
    try {
      const check = await ns.fetch(['dengue-overview-1', 'serotypes-1']);
      const foundCount = Object.keys(check.records || {}).length;
      if (foundCount >= 2) {
        console.log(`✅ Pinecone knowledge base already seeded (found ${foundCount} check vectors)`);
        return true;
      }
    } catch (e) {
      // Index might be empty, continue to seed
    }

    console.log(`📚 Seeding ${chunks.length} chunks into Pinecone...`);

    const pc = getPinecone();
    const texts = chunks.map(c => `${c.title}. ${c.content}`);
    const batchSize = 10;
    const allVectors = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchChunks = chunks.slice(i, i + batchSize);

      const embeddingResult = await pc.inference.embed({
        model: 'multilingual-e5-large',
        inputs: batch,
        parameters: { inputType: 'passage' }
      });

      const embeddings = embeddingResult.data;

      for (let j = 0; j < embeddings.length; j++) {
        allVectors.push({
          id: batchChunks[j].id,
          values: embeddings[j].values,
          metadata: {
            title: batchChunks[j].title,
            content: batchChunks[j].content,
            category: batchChunks[j].category,
            text: `${batchChunks[j].title}. ${batchChunks[j].content}`
          }
        });
      }

      console.log(`  Embedded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    }

    console.log(`  Upserting ${allVectors.length} vectors...`);
    for (let i = 0; i < allVectors.length; i += 50) {
      const batch = allVectors.slice(i, i + 50);
      if (batch.length > 0) {
        await ns.upsert({ records: batch });
        console.log(`  Upserted batch: ${batch.length} vectors`);
      }
    }

    console.log(`✅ Pinecone seeded with ${allVectors.length} vectors`);
    return true;
  } catch (error) {
    console.error('❌ Pinecone seeding error:', error.message);
    return false;
  }
}

async function searchKnowledge(query, topK = 5) {
  try {
    const index = await getIndex();
    const ns = index.namespace(NAMESPACE);

    const queryEmbedding = await generateEmbedding(query);
    const results = await ns.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      title: match.metadata.title,
      content: match.metadata.content,
      category: match.metadata.category
    }));
  } catch (error) {
    console.error('❌ Pinecone search error:', error.message);
    return [];
  }
}

function localSearch(query, topK = 5) {
  try {
    const kbPath = path.join(__dirname, '..', 'data', 'dengue-knowledge-base.json');
    const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    const chunks = kb.chunks;

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    const scored = chunks.map(chunk => {
      const text = `${chunk.title} ${chunk.content}`.toLowerCase();
      let score = 0;

      queryTerms.forEach(term => {
        const regex = new RegExp(term, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
          if (chunk.title.toLowerCase().includes(term)) {
            score += 3;
          }
        }
      });

      return { ...chunk, score };
    });

    return scored
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(c => ({
        id: c.id,
        score: c.score,
        title: c.title,
        content: c.content,
        category: c.category
      }));
  } catch (error) {
    console.error('❌ Local search error:', error.message);
    return [];
  }
}

module.exports = {
  seedKnowledgeBase,
  searchKnowledge,
  localSearch,
  generateEmbedding,
  getIndex
};
