import { Injectable } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { createRetriever, loadParentDocuments } from '../storage/retriever';
import { createCohereRerank } from '../models/cohere_rerank';
import { QueryClassifierService, QueryType } from './query-classifier.service';
import { DocumentProcessorService } from './document-processor.service';
import { ConfigurationService } from '../config/configuration.service';
import { VectorStoreService } from './vector-store.service';

export interface RetrievalResult {
  documents: Document[];
  queryType: QueryType;
  debugInfo: {
    queryType: QueryType;
    personalDocsFound: number;
    policyDocsFound: number;
    totalBeforeRerank: number;
    totalAfterRerank: number;
    error?: string;
  };
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly queryClassifier: QueryClassifierService,
    private readonly documentProcessor: DocumentProcessorService,
    private readonly configService: ConfigurationService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async retrieveDocuments(
    question: string,
    userEmail: string,
  ): Promise<RetrievalResult> {
    console.log('\n Starting retrieval process...');

    const normalizedEmail = userEmail.toLowerCase().trim();

    const vectorStore = await this.vectorStoreService.getVectorStore();

    const retriever = await createRetriever();

    // Load parent documents if not already loaded
    await loadParentDocuments();

    const queryType = this.queryClassifier.classifyQuery(question);
    const allResults: Document[] = [];
    const debugInfo = {
      queryType,
      personalDocsFound: 0,
      policyDocsFound: 0,
      totalBeforeRerank: 0,
      totalAfterRerank: 0,
    };

    try {
      // Personal document retrieval
      if (queryType === 'personal' || queryType === 'mixed') {
        const personalDocs = await this.retrievePersonalDocuments(
          vectorStore,
          question,
          userEmail,
        );
        allResults.push(...personalDocs);
        debugInfo.personalDocsFound = personalDocs.length;
      }

      // Policy document retrieval
      if (queryType === 'policy' || queryType === 'mixed') {
        const policyDocs = await this.retrievePolicyDocuments(
          vectorStore,
          retriever,
          question,
        );
        allResults.push(...policyDocs);
        debugInfo.policyDocsFound = policyDocs.length;
      }

      debugInfo.totalBeforeRerank = allResults.length;
      console.log(`Total documents before reranking: ${allResults.length}`);

      if (allResults.length === 0) {
        console.log('No documents found');
        return { documents: [], queryType, debugInfo };
      }

      // Reranking and processing
      const finalResults = await this.rerankAndProcessDocuments(
        allResults,
        question,
      );
      debugInfo.totalAfterRerank = finalResults.length;

      // Log document sources for debugging
      this.logDocumentSources(finalResults);

      return { documents: finalResults, queryType, debugInfo };
    } catch (error) {
      console.error('Error in retrieve step:', error);
      return {
        documents: [],
        queryType,
        debugInfo: { ...debugInfo, error: error.message },
      };
    }
  }

  private async retrievePersonalDocuments(
    vectorStore: any,
    question: string,
    userEmail: string,
  ): Promise<Document[]> {
    console.log(`Searching personal documents for: ${userEmail}`);

    const personalResults = await vectorStore.similaritySearchWithScore(
      question,
      8,
      {
        type: 'personal',
        email: userEmail,
      },
    );

    const personalDocs = personalResults.map(([doc, score]) => ({
      ...doc,
      metadata: { ...doc.metadata, relevanceScore: score },
    }));

    console.log(`Found ${personalDocs.length} personal documents`);
    return personalDocs;
  }

  private async retrievePolicyDocuments(
    vectorStore: any,
    retriever: any,
    question: string,
  ): Promise<Document[]> {
    console.log('Searching policy documents with ParentDocumentRetriever...');

    try {
      const policyDocs = await retriever.invoke(question);
      const policyDocsWithType = policyDocs.map((doc) => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          type: 'policy',
          retrievalMethod: 'ParentDocumentRetriever',
        },
      }));

      console.log(
        `Found ${policyDocsWithType.length} policy documents (with full context)`,
      );
      return policyDocsWithType;
    } catch (error: any) {
      console.error(
        'ParentDocumentRetriever failed, falling back to direct search:',
        error.message,
      );

      // Fallback to direct vector search
      return await this.fallbackPolicySearch(vectorStore, question);
    }
  }

  private async fallbackPolicySearch(
    vectorStore: any,
    question: string,
  ): Promise<Document[]> {
    const policyResults = await vectorStore.similaritySearchWithScore(
      question,
      15,
      { type: 'policy' },
    );

    const policyDocs = policyResults.map(([doc, score]) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        relevanceScore: score,
        retrievalMethod: 'fallback',
      },
    }));

    console.log(`Fallback found ${policyDocs.length} policy documents`);
    return policyDocs;
  }

  private async rerankAndProcessDocuments(
    documents: Document[],
    question: string,
  ): Promise<Document[]> {
    console.log('Reranking documents...');
    const cohereRerank = createCohereRerank(this.configService);
    const rerankedResults = await cohereRerank.compressDocuments(
      documents,
      question,
    );

    // Document merging and filtering
    return this.documentProcessor.mergeDocuments(rerankedResults);
  }

  private logDocumentSources(documents: Document[]): void {
    documents.forEach((doc, i) => {
      const source = doc.metadata.filename || doc.metadata.source || 'Unknown';
      const type = doc.metadata.type || 'Unknown';
      console.log(
        `   [${i + 1}] ${type}: ${source} (${doc.pageContent.length} chars)`,
      );
    });
  }
}
