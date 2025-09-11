import { Controller, Get, Post, Body, Headers, Param } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('conversations')
  getConversations(@Headers() headers: Record<string, string>) {
    const userEmail = headers['x-user-email'];
    const conversations = this.appService.getConversations(userEmail);
    return conversations;
  }

  @Get('conversations/:conversationId')
  getConversationMessages(@Param('conversationId') conversationId: string) {
    const conversationMessages =
      this.appService.getConversationMessages(conversationId);

    console.log({ conversationMessages });

    return conversationMessages;
  }

  @Post('chat')
  postChat(
    @Body() body: { message: string },
    @Headers() headers: Record<string, string>,
  ) {
    const userEmail = headers['x-user-email'];
    return this.appService.chatv2(body.message, userEmail);
  }

  @Post('chat-power-app')
  postPowerChat(
    @Body() body: { message: string },
    @Headers() headers: Record<string, string>,
  ) {
    console.log({ body, headers });
    const userEmail = 'nyambayar.e@techpack.mn';
    // const username = 'nyambayar enkhbayar';
    return this.appService.chatv2(body.message, userEmail);
  }

  @Post('ingest/employees')
  async ingestEmployees() {
    return this.appService.ingestEmployees();
  }

  @Post('ingest/policies')
  async ingestPolicies() {
    return this.appService.ingestPolicies();
  }
}
