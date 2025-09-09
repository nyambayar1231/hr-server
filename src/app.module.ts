import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueryClassifierService } from './services/query-classifier.service';
import { DocumentProcessorService } from './services/document-processor.service';
import { RetrievalService } from './services/retrieval.service';
import { GenerationService } from './services/generation.service';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { VectorStoreService } from './services/vector-store.service';
import { EmployeeService } from './services/employee.service';
import { ConfigurationService } from './config/configuration.service';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ConfigurationService,
    QueryClassifierService,
    EmployeeService,
    DocumentProcessorService,
    RetrievalService,
    GenerationService,
    ChatOrchestratorService,
    VectorStoreService,
  ],
})
export class AppModule {}
