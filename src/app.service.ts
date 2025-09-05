import { Injectable } from '@nestjs/common';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';

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
    } catch (error: any) {
      console.log(error);
      throw new Error(error);
    }
  }
}
