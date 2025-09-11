// database.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Module({
  providers: [
    {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Pool({
          host: configService.get<string>('DB_HOST', '127.0.0.1'),
          port: parseInt(configService.get<string>('DB_PORT', '5432')),
          user: configService.get<string>('DB_USER', 'postgres'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME', 'hr_help_desk'),
        });
      },
    },
  ],
  exports: ['PG_POOL'],
})
export class DatabaseModule {}
