import { CohereRerank } from '@langchain/cohere';
import { ConfigurationService } from '../config/configuration.service';

export function createCohereRerank(configService: ConfigurationService) {
  return new CohereRerank({
    apiKey: configService.cohereApiKey,
    topN: configService.rerankTopN,
    model: 'rerank-multilingual-v3.0',
  });
}
