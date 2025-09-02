import { PoolConfig } from 'pg';
import {
  DistanceStrategy,
  PGVectorStore,
} from '@langchain/community/vectorstores/pgvector';
import { embeddings } from '../embeddings';
import { ConfigurationService } from '../config/configuration.service';

export function getVectorStoreConfig(config?: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}) {
  return {
    postgresConnectionOptions: {
      type: 'postgres',
      host: config?.host || process.env.DB_HOST || '127.0.0.1',
      port: config?.port || parseInt(process.env.DB_PORT || '5432'),
      user: config?.user || process.env.DB_USER || 'postgres',
      password: config?.password || process.env.DB_PASSWORD!,
      database: config?.database || process.env.DB_NAME || 'hr_help_desk',
    } as PoolConfig,
    tableName: 'testlangchainjs',
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'vector',
      contentColumnName: 'content',
      metadataColumnName: 'metadata',
    },
    distanceStrategy: 'cosine' as DistanceStrategy,
  };
}

export async function createVectorStoreInstance(
  configService?: ConfigurationService,
): Promise<PGVectorStore> {
  let config;

  if (configService) {
    config = {
      postgresConnectionOptions: {
        type: 'postgres',
        host: configService.database!.host,
        port: configService.database!.port,
        user: configService.database!.user,
        password: configService.database!.password,
        database: configService.database!.database,
      } as PoolConfig,
      tableName: 'testlangchainjs',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'vector',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      },
      distanceStrategy: 'cosine' as DistanceStrategy,
    };
  } else {
    // Use environment variables (standalone context)
    config = getVectorStoreConfig();
  }

  return await PGVectorStore.initialize(embeddings, config);
}
