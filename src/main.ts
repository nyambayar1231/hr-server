import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL]
        : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
