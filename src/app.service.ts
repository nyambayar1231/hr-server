import { Injectable } from '@nestjs/common';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { ingestEmployeeData } from './ingestion/ingest_employees';
import { ingestPolicies as ingestPoliciesFn } from './ingestion/ingest_policies';
import { ChatService } from './services/chat.service';

@Injectable()
export class AppService {
  constructor(
    private readonly chatOrchestrator: ChatOrchestratorService,
    private readonly chatService: ChatService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async chatCopilot(message: string, userEmail: string): Promise<any> {
    try {
      return await this.chatService.processCopilotChat(message, userEmail);
    } catch (error: unknown) {
      // Re-throw with a safe string message
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(message);
    }
  }

  async chatv2(message: string, userEmail: string, conversationId: string) {
    try {
      return await this.chatService.processChat(
        message,
        userEmail,
        conversationId,
      );
    } catch (error: unknown) {
      // Re-throw with a safe string message
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(message);
    }
  }

  async getConversations(userEmail: string): Promise<Record<string, any>[]> {
    const conversations = await this.chatService.getUserSessions(userEmail);
    return conversations;
  }

  async getConversationMessages(
    conversationId: string,
  ): Promise<Record<string, any>> {
    const conversationMessages =
      await this.chatService.getConversationMessages(conversationId);

    return conversationMessages;
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
