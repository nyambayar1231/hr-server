import { Controller, Get, Post, Body, Headers } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('chat')
  postChat(
    @Body() body: { message: string },
    @Headers() headers: Record<string, string>,
  ) {
    const userEmail = headers['x-user-email'];
    const username = headers['x-user-name'];

    return this.appService.chatv2(body.message, userEmail, username);
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
