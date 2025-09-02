import { Injectable } from '@nestjs/common';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { ConfigurationService } from '../config/configuration.service';
import { createVectorStoreInstance } from '../utils/vector-store-utils';

@Injectable()
export class VectorStoreService {
  private vectorStore: PGVectorStore | null = null;

  constructor(private readonly configService: ConfigurationService) {}

  async getVectorStore(): Promise<PGVectorStore> {
    if (this.vectorStore) {
      return this.vectorStore;
    }

    this.vectorStore = await createVectorStoreInstance(this.configService);
    return this.vectorStore;
  }

  async clearCache(): Promise<void> {
    this.vectorStore = null;
  }
}
