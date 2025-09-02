import { Injectable } from '@nestjs/common';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';

@Injectable()
export class AppService {
  constructor(private readonly chatOrchestrator: ChatOrchestratorService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async chat(message: string): Promise<{
    response: string;
    timestamp: string;
    debugInfo?: any;
  }> {
    return await this.chatOrchestrator.processChat(
      message,
      'tara.nelson@example.com',
    );
  }
}
