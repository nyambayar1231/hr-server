// import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';
dotenv.config();

// export const llm = new ChatGroq({
//   model: 'llama-3.3-70b-versatile',
//   temperature: 0,
// });

export const llm = new ChatOpenAI({ model: 'gpt-4', temperature: 0 });
