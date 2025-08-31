import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  chat(message: string): string {
    console.log(message);
    return 'Hello From the Chat!';
  }
}
