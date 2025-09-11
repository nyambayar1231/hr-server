/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Annotation, StateGraph } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Inject, Injectable } from '@nestjs/common';
import { RetrievalResult, RetrievalService } from './retrieval.service';
import { GenerationService } from './generation.service';
import { Document } from '@langchain/core/documents';
import { ChatOpenAI } from '@langchain/openai';
import { createLLM } from 'src/models/groq_llm';
import { ConfigurationService } from 'src/config/configuration.service';
import { Pool } from 'pg';
import { EmployeeService } from './employee.service';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  userEmail: Annotation<string>,
  username: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>(),
  userEmail: Annotation<string>(),
  username: Annotation<string>(),
  queryType: Annotation<'personal' | 'employee' | 'policy' | 'mixed'>(),
  context: Annotation<Document[]>(),
  answer: Annotation<string>(),
  debugInfo: Annotation<any>(),

  //  message persistence
  messages: Annotation<Array<ChatMessage>>({
    reducer: (x, y) => {
      // Merge messages, avoiding duplicates
      const allMessages = [...(x ?? []), ...(y ?? [])];
      return allMessages;
    },
    default: () => [],
  }),

  // Conversation metadata
  conversationId: Annotation<string>(),
  lastActivity: Annotation<Date>(),

  // Action tracking
  actionType: Annotation<
    'askEmailPermission' | 'sendEmail' | 'askEmployee' | 'none'
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

      // Edges
      .addEdge('__start__', 'analyzeQuery')
      .addConditionalEdges('analyzeQuery', (state) =>
        this.selectActionType(state),
      )

      .addEdge('askEmailPermission', '__end__')
      .addEdge('sendEmail', '__end__')
      .addEdge('askEmployee', '__end__')

      .addEdge('retrieve', 'generate')
      .addEdge('generate', '__end__')
      .compile({
        checkpointer: this.checkpointer,
      });

    // Create the graph
    this.graph = newGraph;
    this.structuredLlm = createLLM(configService);
  }

  private askEmailPermission() {
    const answer = `Та цагийн бүртгэл авахыг хүсэж байн уу?`;

    // Add system message to conversation history
    const newMessage: ChatMessage = {
      role: 'system',
      content: answer,
      timestamp: new Date(),
    };

    return {
      answer,
      messages: [newMessage],
      lastActivity: new Date(),
    };
  }

  private sendEmail(state: typeof StateAnnotation.State) {
    const answer = 'sent email successfully';

    // Add system message about email being sent
    const newMessage: ChatMessage = {
      role: 'system',
      content: answer,
      timestamp: new Date(),
    };

    return {
      answer,
      messages: [newMessage],
      lastActivity: new Date(),
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
      default:
        return 'retrieve';
    }
  }

  private async analyzeQuery(state: typeof StateAnnotation.State) {
    const hashedUserEmail = this.employeeService.createEmailHash(
      state.userEmail,
    );

    const secureUser = await this.employeeService.getSecureEmployeeData([
      hashedUserEmail,
    ]);

    const requestingUserRole = secureUser[0]?.employee_role;

    const lowerQuestion = state.question.toLowerCase().trim();

    // Add the new user message into conversation history
    const userMessage: ChatMessage = {
      role: 'user',
      content: state.question,
      timestamp: new Date(),
    };

    // Use the last few messages as context
    const conversationContext = (state.messages ?? [])
      .slice(-1)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // Detect if we recently asked for time tracking permission
    const askedPermissionRecently = (state.messages ?? [])
      .slice(-3) // Check more messages
      .some((m) => {
        return (
          m.role === 'system' &&
          typeof m.content === 'string' &&
          (m.content.includes('Та цагийн бүртгэл авахыг хүсэж байн уу?') ||
            m.content.includes('permission') ||
            m.content.includes('consent'))
        );
      });

    // Check for both Cyrillic and Latin variants
    const mentionsTimeTracking =
      lowerQuestion.includes('цаг бүртгэл') ||
      lowerQuestion.includes('tsag burtgel') ||
      lowerQuestion.includes('tsag burgel');

    const prompt = `You are a strict classifier that returns only one of: sendEmail, askEmailPermission, none.
  
  Conversation (most recent last):
  ${conversationContext ?? ''}
  user: ${state.question}
  
  Rules (must follow exactly):
  - Look for time tracking topics: "цаг бүртгэл", "tsag burtgel", "tsag burgel"
  - If user message indicates agreement/consent (e.g., "тийм", "тэгий", "за", "зөв", "болъё", "ok", "okay", "yes") AND recent context shows we asked permission about time tracking, return sendEmail.
  - If user message mentions time tracking for the first time or asks about it, return askEmailPermission.
  - Otherwise return none.
  
  Return exactly one token: sendEmail | askEmailPermission | none.`;

    let actionType:
      | 'askEmailPermission'
      | 'sendEmail'
      | 'askEmployee'
      | 'none' = 'none';

    try {
      const response = await this.structuredLlm.invoke(prompt);
      const text = this.getTextFromMessageContent(
        (response as { content: unknown }).content,
      ).toLowerCase();

      if (text.includes('sendemail')) {
        actionType = 'sendEmail';
      } else if (text.includes('askemailpermission')) {
        if (requestingUserRole === 'Human Resource') {
          actionType = 'askEmailPermission';
        } else {
          actionType = 'askEmployee';
        }
      }

      if (actionType === 'sendEmail' && !askedPermissionRecently) {
        actionType = 'none';
      }

      if (actionType === 'none' && mentionsTimeTracking) {
        actionType = 'askEmailPermission';
      }
    } catch {
      // Fallback logic when LLM fails
      if (actionType === 'none' && mentionsTimeTracking) {
        if (requestingUserRole === 'Human Resource') {
          actionType = 'askEmailPermission';
        } else {
          actionType = 'askEmployee';
        }
      }
    }

    return {
      actionType,
      messages: [...(state.messages ?? []), userMessage],
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
  ): Promise<{ response: string }> {
    const config = { configurable: { thread_id: userEmail } };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.graph.invoke({ question, userEmail }, config);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { response: result.answer };
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

    return { answer };
  }
}
