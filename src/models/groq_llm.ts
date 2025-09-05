/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ChatGroq } from '@langchain/groq';
// import { ChatOpenAI } from '@langchain/openai';
import { ConfigurationService } from '../config/configuration.service';

// export const llm = new ChatGroq({
//   model: 'llama-3.3-70b-versatile',
//   temperature: 0,
// });

export function createLLM(configService: ConfigurationService) {
  // return new ChatOpenAI({
  //   model: configService.modelName,
  //   temperature: configService.temperature,
  // });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return new ChatGroq({
    model: configService.modelName,
    temperature: configService.temperature,
  });
}
