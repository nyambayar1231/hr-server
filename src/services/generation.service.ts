import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';
import { createLLM } from '../models/groq_llm';
import { DocumentProcessorService } from './document-processor.service';
import { ConfigurationService } from '../config/configuration.service';

@Injectable()
export class GenerationService {
  private readonly promptTemplate = ChatPromptTemplate.fromTemplate(`
    You are a helpful HR assistant for the company. Your role is to provide accurate information based on company policies and employee data.
    
    Context:
    {context}
    
    Question: {question}
    
    Instructions:
    - Use ONLY information from the provided context to answer questions
    - If information is not available in the context, say "I don't have that information available"
    - Be conversational and helpful - offer to help find related information if needed
    - For personal information requests, only provide data that matches the requesting user
    - Never expose or reference email addresses in your responses
    - Provide specific, actionable answers when possible
    - If referring to policies, mention the relevant document name if available
    - When a user asks a question that starts with 'Миний …' or 'Надад …', interpret it as referring to Ажилтан (employee) or Ажилтаны (employee's).
    
    Answer in the same language as the question:`);

  constructor(
    private readonly documentProcessor: DocumentProcessorService,
    private readonly configService: ConfigurationService,
  ) {}

  async generateResponse(
    question: string,
    documents: Document[],
  ): Promise<string> {
    console.log('\n Generating response...');

    if (documents.length === 0) {
      console.log('No context available');
      return 'Уучлаарай, таны асуултад хариулахад хангалттай мэдээлэл олдсонгүй. Өөр асуулт асуухыг хүсч байна уу?';
    }

    // Prepare context
    const docsContent =
      this.documentProcessor.formatContextForGeneration(documents);
    console.log(`📝 Using ${documents.length} documents for generation`);

    try {
      const messages = await this.promptTemplate.invoke({
        question,
        context: docsContent,
      });

      const llm = createLLM(this.configService);
      const response = await llm.invoke(messages);
      console.log('Response generated successfully');

      return response.content as string;
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Уучлаарай, хариулт үүсгэхэд алдаа гарлаа';
    }
  }
}
