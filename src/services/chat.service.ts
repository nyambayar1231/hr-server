/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Annotation, StateGraph } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timestamp } from 'rxjs';
import { RetrievalResult, RetrievalService } from './retrieval.service';
import { GenerationService } from './generation.service';
import { Document } from '@langchain/core/documents';
import { ChatOpenAI } from '@langchain/openai';
import { createLLM } from 'src/models/groq_llm';
import { ConfigurationService } from 'src/config/configuration.service';
import { Pool } from 'pg';
import { EmployeeService } from './employee.service';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

export interface ChatMessage {
  role: 'user' | 'system';
  content: string;
  conversationId: string;
  contentType: 'text' | 'table';
  data?: Record<string, any>[];
  timestamp?: Date;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  userEmail: Annotation<string>,
  username: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  // Input states
  question: Annotation<string>(),
  userEmail: Annotation<string>(),
  username: Annotation<string>(),

  // Graph state
  queryType: Annotation<'personal' | 'employee' | 'policy' | 'mixed'>(),
  context: Annotation<Document[]>(),
  answer: Annotation<string>(),
  debugInfo: Annotation<any>(),

  // contentType: Annotation<string>(),
  // data: Annotation<Record<string, any>[]>(),

  //  message persistence
  messages: Annotation<Array<ChatMessage>>({
    reducer: (x, y) => {
      return [...(x ?? []), ...(y ?? [])];
    },
    default: () => [],
  }),

  // Conversation metadata
  conversationId: Annotation<string>(),
  lastActivity: Annotation<Date>(),

  // Action tracking
  actionType: Annotation<
    | 'askEmailPermission'
    | 'sendEmail'
    | 'askEmployee'
    | 'employeeAskHour'
    | 'employeeSendRequest'
    | 'none'
  >(),
});

@Injectable()
export class ChatService {
  private readonly graph: any;
  private readonly structuredLlm: ChatOpenAI;

  // Normalize LangChain MessageContent (string | complex[]) to plain text
  private getTextFromMessageContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return (content as unknown[])
        .map((part) => {
          if (typeof part === 'string') return part;
          const maybeObj = part as { text?: unknown; content?: unknown };
          if (typeof maybeObj.text === 'string') return maybeObj.text;
          if (typeof maybeObj.content === 'string') return maybeObj.content;
          return '';
        })
        .join(' ')
        .trim();
    }
    return '';
  }

  constructor(
    @Inject('CHECKPOINTER') private readonly checkpointer: PostgresSaver,
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly httpService: HttpService,
    private readonly employeeService: EmployeeService,
    private readonly retrievalService: RetrievalService,
    private readonly generationService: GenerationService,
    private readonly configService: ConfigurationService,
  ) {
    const newGraph = new StateGraph(StateAnnotation)
      .addNode('analyzeQuery', this.analyzeQuery.bind(this))
      .addNode('sendEmail', this.sendEmail.bind(this))
      .addNode('retrieve', this.retrieve.bind(this))
      .addNode('generate', this.generate.bind(this))
      .addNode('askEmailPermission', this.askEmailPermission.bind(this))
      .addNode('askEmployee', this.askEmployee.bind(this))
      .addNode('employeeAskHour', this.employeeAskHour.bind(this))
      .addNode('employeeSendRequest', this.employeeSendRequest.bind(this))

      // Edges
      .addEdge('__start__', 'analyzeQuery')
      .addConditionalEdges('analyzeQuery', (state) =>
        this.selectActionType(state),
      )

      .addEdge('askEmailPermission', '__end__')
      .addEdge('sendEmail', '__end__')
      .addEdge('askEmployee', '__end__')
      .addEdge('employeeAskHour', '__end__')
      .addEdge('employeeSendRequest', '__end__')

      .addEdge('retrieve', 'generate')
      .addEdge('generate', '__end__')
      .compile({
        checkpointer: this.checkpointer,
      });

    // Create the graph
    this.graph = newGraph;
    this.structuredLlm = createLLM(configService);
  }

  private async askEmailPermission(state: typeof StateAnnotation.State) {
    const powerAutomateUrl =
      'https://default1041f094871f4fabae5817ae6f66df.fa.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/8e72b9efbf5743fdb62aab6bc6fa298f/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=nOp9d0xtlyxefPYnN9gcG_Qqtg1hFYl0k3n6i945MfQ';

    let content = '';
    let contentType: 'text' | 'table' = 'text';
    let data: Record<string, any>[] = [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          powerAutomateUrl,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );

      // Extract data from the response
      const responseData = response.data as Record<string, any>[];
      const statusCode = response.status;

      contentType = 'table';
      content = 'Та дээрх ажилчид руу сануулах мэйл илгээх үү?';
      data = responseData;
    } catch (error) {
      console.error(error);
      content = 'Алдаа гарлаа';
      contentType = 'text';
    }

    // Add the new user message into conversation history
    const AiMessage: ChatMessage = {
      role: 'system',
      content,
      conversationId: state.conversationId,
      timestamp: new Date(),
      contentType,
      data,
    };

    return {
      messages: [AiMessage],
    };
  }

  private async sendEmail(state: typeof StateAnnotation.State) {
    const powerAutomateUrl =
      'https://default1041f094871f4fabae5817ae6f66df.fa.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/3a4f0fbb44e34d95814b94fb64043936/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QRTRsrFqj18puHwb6TIiVehvLuEjAbmv1c3G-iuoGGM';

    let content = '';
    const data: Record<string, any>[] = [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          powerAutomateUrl,
          { email: state.userEmail },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );

      // Extract data from the response
      const responseData = response.data as Record<string, any>[];

      console.log({ responseData });

      content = 'Амжилттай мэдэгдэл илгээлээ';
    } catch (error) {
      console.error(error);
      content = 'Алдаа гарлаа';
    }

    // Add the new user message into conversation history
    const AiMessage: ChatMessage = {
      role: 'system',
      content,
      conversationId: state.conversationId,
      timestamp: new Date(),
      contentType: 'text',
      data,
    };

    return {
      messages: [AiMessage],
    };
  }

  async employeeAskHour(state: typeof StateAnnotation.State) {
    const powerAutomateUrl =
      'https://default1041f094871f4fabae5817ae6f66df.fa.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/19fd4163f64e46949d675c86625b022a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=te7a11M99Bllcv-HKryz3O5zWSaddWa0lHKdJywLWLQ';

    let content = '';
    let contentType: 'text' | 'table' = 'text';
    let data: Record<string, any>[] = [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          powerAutomateUrl,
          { email: state.userEmail },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );

      // Extract data from the response
      const responseData = response.data as Record<string, any>[];

      console.log({ responseData });

      contentType = 'table';
      content = 'Та цагийн хүсэлт илгээх үү?';
      data = responseData;
    } catch (error) {
      console.error(error);
      content = 'Алдаа гарлаа';
      contentType = 'text';
    }

    // Add the new user message into conversation history
    const AiMessage: ChatMessage = {
      role: 'system',
      content,
      conversationId: state.conversationId,
      timestamp: new Date(),
      contentType,
      data,
    };

    return {
      messages: [AiMessage],
    };
  }
  async employeeSendRequest(state: typeof StateAnnotation.State) {
    const powerAutomateUrl =
      'https://default1041f094871f4fabae5817ae6f66df.fa.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5a6eb85df83e4f4b8053fc8f5273e4a1/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-NMdthtBccJxgsLXNOmVvAfqzp1zWBgT8mmYGdnEQmM';

    let content = '';
    const data: Record<string, any>[] = [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          powerAutomateUrl,
          { ID: 2 },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );

      // Extract data from the response
      const responseData = response.data as Record<string, any>[];

      console.log({ responseData });

      content = 'Цагийн хүсэлт амжилттай илгээлээ';
    } catch (error) {
      console.error(error);
      content = 'Алдаа гарлаа';
    }

    // Add the new user message into conversation history
    const AiMessage: ChatMessage = {
      role: 'system',
      content,
      conversationId: state.conversationId,
      timestamp: new Date(),
      contentType: 'text',
      data,
    };

    return {
      messages: [AiMessage],
    };
  }

  private selectActionType(state: typeof StateAnnotation.State) {
    switch (state.actionType) {
      case 'askEmailPermission':
        return 'askEmailPermission';
      case 'sendEmail':
        return 'sendEmail';
      case 'askEmployee':
        return 'askEmployee';
      case 'employeeAskHour':
        return 'employeeAskHour';
      case 'employeeSendRequest':
        return 'employeeSendRequest';
      default:
        return 'retrieve';
    }
  }

  private analyzeQuery(state: typeof StateAnnotation.State) {
    const lowerQuestion = state.question.toLowerCase().trim();

    // Add the new user message into conversation history
    const userMessage: ChatMessage = {
      role: 'user',
      content: state.question,
      timestamp: new Date(),
      contentType: 'text',
      conversationId: state.conversationId,
    };

    const employeeAskHourRecently = (state.messages ?? [])
      .slice(-1)
      .some((m) => {
        const lowerContent = m.content.toLowerCase().trim();

        return (
          m.role === 'system' &&
          typeof m.content === 'string' &&
          lowerContent.includes('та цагийн хүсэлт илгээх үү?')
        );
      });

    // Check if we recently asked for permission
    const askedPermissionRecently = (state.messages ?? [])
      .slice(-1)
      .some((m) => {
        const lowerContent = m.content.toLowerCase().trim();
        return (
          m.role === 'system' &&
          typeof m.content === 'string' &&
          lowerContent.includes('та дээрх ажилчид руу сануулах мэйл илгээх үү?')
        );
      });

    let actionType:
      | 'askEmailPermission'
      | 'employeeAskHour'
      | 'employeeSendRequest'
      | 'sendEmail'
      | 'sendRequest'
      | 'none' = 'none';

    if (
      lowerQuestion.includes('миний дутуу цаг') ||
      lowerQuestion.includes('дутуу цаг?') ||
      lowerQuestion.includes('dutuu tsag') ||
      lowerQuestion.includes('minii tsag')
    ) {
      actionType = 'employeeAskHour';
    } else if (
      (employeeAskHourRecently && lowerQuestion.includes('yes')) ||
      lowerQuestion.includes('тийм') ||
      lowerQuestion.includes('за') ||
      lowerQuestion.includes('тэгий') ||
      lowerQuestion.includes('tegii')
    ) {
      actionType = 'employeeSendRequest';
    }

    if (
      lowerQuestion.includes('tsagiin burtgel') ||
      lowerQuestion.includes('tsag burtgel') ||
      lowerQuestion.includes('цаг бүртгэл') ||
      lowerQuestion.includes('цагийн бүртгэл')
    ) {
      actionType = 'askEmailPermission';
    } else if (
      (askedPermissionRecently &&
        (lowerQuestion.includes('yes') ||
          lowerQuestion.includes('тийм') ||
          lowerQuestion.includes('за'))) ||
      lowerQuestion.includes('тэгий') ||
      lowerQuestion.includes('tegii')
    ) {
      actionType = 'sendEmail';
    }

    return {
      actionType,
      messages: [userMessage],
      lastActivity: new Date(),
    };
  }

  askEmployee(state: typeof StateAnnotation.State) {
    return {
      answer: 'Only hr allowed to get tsag burtgel if you want I can ...',
    };
  }

  async processChat(
    question: string,
    userEmail: string,
    conversationId?: string,
  ): Promise<{
    response: ChatMessage;
  }> {
    // Create thread id if it is the first time chat
    const sessionId = conversationId ?? uuidv4();

    await this.ensureChatSessionsTable();
    await this.upsertChatSession(sessionId, userEmail);

    const config = { configurable: { thread_id: sessionId } };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.graph.invoke(
      { question, userEmail, conversationId: sessionId },
      config,
    );

    return {
      response: result.messages.slice(-1)?.[0],
    };
  }

  async processCopilotChat(
    question: string,
    userEmail: string,
    conversationId?: string,
  ) {
    const sessionId = conversationId ?? uuidv4();

    await this.ensureChatSessionsTable();
    await this.upsertChatSession(sessionId, userEmail);

    const botUrl =
      'https://directline.botframework.com/v3/directline/tokens/generate';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          botUrl,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.AZURE_APP_BOT_KEY}`,
            },
            timeout: 30000,
          },
        ),
      );

      const { token } = response.data;

      const newConversationResponse = await firstValueFrom(
        this.httpService.post(
          'https://directline.botframework.com/v3/directline/conversations',
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            timeout: 30000,
          },
        ),
      );

      const newConversation = newConversationResponse.data;

      const { conversationId } = newConversation;

      await firstValueFrom(
        this.httpService.post(
          `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`,

          {
            locale: 'mn-MN',
            type: 'message',
            from: {
              id: userEmail,
            },
            text: question,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            timeout: 30000,
          },
        ),
      );

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 5000);
      });

      const getMessagesResponse = await firstValueFrom(
        this.httpService.get(
          `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities/`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            timeout: 30000,
          },
        ),
      );

      const messages = getMessagesResponse.data.activities.map((activity) => ({
        timestamp: activity.timestamp,
        content: activity.text,
        role: activity.from.id === userEmail ? 'user' : 'system',
        contentType: 'text',
      }));
      const lastMessage = messages.slice(-1);

      return lastMessage?.[0];
    } catch (error) {}
  }

  async getUserSessions(userEmail: string) {
    const userEmailHash = this.employeeService.createEmailHash(userEmail);
    try {
      const { rows } = await this.pool.query(
        `
        SELECT session_id, created_at, last_activity
        FROM chat_sessions
        WHERE user_email_hash = $1
        ORDER BY last_activity DESC
      `,
        [userEmailHash],
      );
      return rows as Record<string, any>[];
    } catch (error: any) {
      console.error('Error during list user sessions:', error);
      throw new Error(error);
    }
  }

  async getConversationMessages(conversationId: string) {
    const config = { configurable: { thread_id: conversationId } };

    try {
      const checkpoint = await this.checkpointer.get(config);
      const messages = (checkpoint?.channel_values?.messages ?? []) as Array<
        { timestamp?: Date | string } & Record<string, unknown>
      >;

      const toTime = (m: { timestamp?: Date | string } | undefined) => {
        if (!m || !m.timestamp) return 0;
        try {
          return new Date(m.timestamp as any).getTime() || 0;
        } catch {
          return 0;
        }
      };

      return [...messages].sort((a, b) => toTime(a) - toTime(b));
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      return [];
    }
  }

  private async retrieve(state: typeof InputStateAnnotation.State) {
    const result: RetrievalResult =
      await this.retrievalService.retrieveDocuments(
        state.question,
        state.userEmail,
      );
    return {
      context: result.documents,
      queryType: result.queryType,
      debugInfo: result.debugInfo,
    };
  }

  private async generate(state: typeof StateAnnotation.State) {
    const answer = await this.generationService.generateResponse(
      state.question,
      state.context,
    );

    // Add the new user message into conversation history
    const AiMessage: ChatMessage = {
      role: 'system',
      content: answer,
      conversationId: state.conversationId,
      timestamp: new Date(),
      contentType: 'text',
    };

    return {
      response: AiMessage,
      messages: [AiMessage],
    };
  }

  private async ensureChatSessionsTable() {
    const client = await this.pool.connect();

    try {
      await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        session_id UUID PRIMARY KEY,
        user_email_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_email_hash
        ON chat_sessions (user_email_hash);
    `);

      console.log('Chat Session Table Created:');
    } finally {
      client.release();
    }
  }

  private async upsertChatSession(sessionId: string, userEmail: string) {
    const userEmailHash = this.employeeService.createEmailHash(userEmail);
    await this.pool.query(
      `
        INSERT INTO chat_sessions (session_id, user_email_hash)
        VALUES ($1, $2)
        ON CONFLICT (session_id)
        DO UPDATE SET
            last_activity = NOW()
            WHERE chat_sessions.user_email_hash = EXCLUDED.user_email_hash;
      `,
      [sessionId, userEmailHash],
    );
  }
}
