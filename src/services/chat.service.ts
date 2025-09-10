import { Annotation, StateGraph } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Inject, Injectable } from '@nestjs/common';
import { RetrievalResult, RetrievalService } from './retrieval.service';
import { GenerationService } from './generation.service';
import { Document } from '@langchain/core/documents';

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
  queryType: Annotation<'personal' | 'policy' | 'mixed'>(),
  context: Annotation<Document[]>(),
  answer: Annotation<string>(),
  debugInfo: Annotation<any>(),
});

@Injectable()
export class ChatService {
  private readonly graph: any;

  constructor(
    @Inject('CHECKPOINTER') private readonly checkpointer: PostgresSaver,
    private readonly retrievalService: RetrievalService,
    private readonly generationService: GenerationService,
  ) {
    const newGraph = new StateGraph(StateAnnotation)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .addNode('retrieve', this.retrieve.bind(this))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .addNode('generate', this.generate.bind(this))
      .addEdge('__start__', 'retrieve')
      .addEdge('retrieve', 'generate')
      .addEdge('generate', '__end__')
      .compile({
        checkpointer: this.checkpointer,
      });

    // Create the graph
    this.graph = newGraph;
  }

  async processChat(
    question: string,
    userEmail: string,
  ): Promise<{ response: string }> {
    const config = { configurable: { thread_id: userEmail } };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await this.graph.invoke({ question, userEmail }, config);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    return { response: result?.answer ?? 'aaa' };
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
