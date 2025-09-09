import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigurationService } from '../config/configuration.service';

// export function createLLM(configService: ConfigurationService) {
//   return new ChatGroq({
//     model: configService.modelName,
//     temperature: configService.temperature,
//   });
// }

export function createLLM(configService: ConfigurationService) {
  return new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  });
}
