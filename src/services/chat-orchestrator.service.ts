import { Injectable } from '@nestjs/common';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { RetrievalService, RetrievalResult } from './retrieval.service';
import { GenerationService } from './generation.service';

const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  userEmail: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  userEmail: Annotation<string>,
  queryType: Annotation<'personal' | 'policy' | 'mixed'>,
  context: Annotation<any[]>,
  answer: Annotation<string>,
  debugInfo: Annotation<any>,
});

@Injectable()
export class ChatOrchestratorService {
  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly generationService: GenerationService,
  ) {}

  async processChat(
    question: string,
    userEmail: string,
  ): Promise<{
    response: string;
    timestamp: string;
    debugInfo?: any;
  }> {
    const graph = new StateGraph(StateAnnotation)
      .addNode('retrieve', this.retrieve.bind(this))
      .addNode('generate', this.generate.bind(this))
      .addEdge('__start__', 'retrieve')
      .addEdge('retrieve', 'generate')
      .addEdge('generate', '__end__')
      .compile();

    const inputs = {
      question,
      userEmail,
    };

    const results = await graph.invoke(inputs);

    return {
      response: results.answer,
      timestamp: new Date().toDateString(),
      debugInfo: results.debugInfo,
    };
  }

  private async retrieve(state: typeof InputStateAnnotation.State) {
    const result: RetrievalResult =
      await this.retrievalService.retrieveDocuments(
        state.question,
        state.userEmail,
      );

    console.log(result);

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
