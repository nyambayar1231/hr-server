import { Injectable } from '@nestjs/common';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { ingestEmployeeData } from './ingestion/ingest_employees';
import { ingestPolicies as ingestPoliciesFn } from './ingestion/ingest_policies';

@Injectable()
export class AppService {
  constructor(private readonly chatOrchestrator: ChatOrchestratorService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async chat(
    message: string,
    userEmail: string,
  ): Promise<{
    response: string;
    timestamp: string;
    debugInfo?: any;
  }> {
    try {
      return await this.chatOrchestrator.processChat(message, userEmail);
    } catch (error: unknown) {
      // Re-throw with a safe string message
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(message);
    }
  }

  async ingestEmployees(): Promise<{ message: string; success: boolean }> {
    try {
      await ingestEmployeeData();
      return {
        message: 'Employee data ingested successfully',
        success: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        message: `Error ingesting employees: ${message}`,
        success: false,
      };
    }
  }

  async ingestPolicies(): Promise<{ message: string; success: boolean }> {
    try {
      await ingestPoliciesFn();
      return {
        message: 'Policy documents ingested successfully',
        success: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        message: `Error ingesting policies: ${message}`,
        success: false,
      };
    }
  }
}
