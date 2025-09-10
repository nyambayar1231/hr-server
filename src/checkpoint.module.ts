import { Module } from '@nestjs/common';
import pg from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

const { Pool } = pg;

@Module({
  providers: [
    {
      provide: 'CHECKPOINTER',
      useFactory: async () => {
        const pool = new Pool({
          host: process.env.DB_HOST || '127.0.0.1',
          port: parseInt(process.env.DB_PORT || '5432'),
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME || 'hr_help_desk',
        });

        const checkpointer = new PostgresSaver(pool);
        await checkpointer.setup();
        return checkpointer;
      },
    },
  ],
  exports: ['CHECKPOINTER'],
})
export class CheckpointModule {}
