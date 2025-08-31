import { PoolConfig } from 'pg';
import {
  DistanceStrategy,
  PGVectorStore,
} from '@langchain/community/vectorstores/pgvector';

import { embeddings } from './embeddings';

const config = {
  postgresConnectionOptions: {
    type: 'postgres',
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'As4dfqwezxc$',
    database: 'hr_help_desk',
  } as PoolConfig,
  tableName: 'testlangchainjs',
  columns: {
    idColumnName: 'id',
    vectorColumnName: 'vector',
    contentColumnName: 'content',
    metadataColumnName: 'metadata',
  },
  // supported distance strategies: cosine (default), innerProduct, or euclidean
  distanceStrategy: 'cosine' as DistanceStrategy,
};

export async function getVectorStore() {
  return await PGVectorStore.initialize(embeddings, config);
}

export const vectorStore = getVectorStore();
