import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './app.config';

@Injectable()
export class ConfigurationService {
  constructor(private configService: ConfigService) {}

  get database() {
    return this.configService.get<AppConfig['database']>('app.database');
  }

  get ai() {
    return this.configService.get<AppConfig['ai']>('app.ai');
  }

  get retrieval() {
    return this.configService.get<AppConfig['retrieval']>('app.retrieval');
  }

  get all(): AppConfig {
    return {
      database: this.database!,
      ai: this.ai!,
      retrieval: this.retrieval!,
    };
  }

  // Helper methods for common config access
  get openaiApiKey(): string {
    return this.ai?.openaiApiKey ?? '';
  }

  get cohereApiKey(): string {
    return this.ai?.cohereApiKey ?? '';
  }

  get modelName(): string {
    return this.ai?.modelName ?? '';
  }

  get temperature(): number {
    return this.ai?.temperature ?? 0;
  }

  get maxDocuments(): number {
    return this.retrieval?.maxDocuments ?? 0;
  }

  get rerankTopN(): number {
    return this.retrieval?.rerankTopN ?? 0;
  }
}
