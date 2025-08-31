import { CohereRerank } from '@langchain/cohere';
import dotenv from 'dotenv';
dotenv.config();

export const cohereRerank = new CohereRerank({
  apiKey: process.env.COHERE_API_KEY!,
  topN: 3, // Default
  model: 'rerank-multilingual-v3.0',
});
