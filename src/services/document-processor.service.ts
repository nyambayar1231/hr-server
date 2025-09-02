import { Injectable } from '@nestjs/common';
import { Document } from '@langchain/core/documents';

export interface DocumentMetadata {
  source?: string;
  filename?: string;
  type?: string;
  loc?: { pageNumber?: number };
  relevanceScore?: number;
  retrievalMethod?: string;
  mergedFrom?: number;
  totalLength?: number;
}

@Injectable()
export class DocumentProcessorService {
  mergeDocuments(documents: Document[]): Document[] {
    if (documents.length === 0) return [];

    const merged: Document[] = [];
    const processed = new Set<string>();

    for (const doc of documents) {
      const key = this.generateDocumentKey(doc);

      if (processed.has(key)) {
        continue; // Skip duplicates
      }

      // Find similar documents to merge
      const similars = documents.filter((other) => {
        const otherKey = this.generateDocumentKey(other);
        return (
          !processed.has(otherKey) && this.shouldMergeDocuments(doc, other)
        );
      });

      if (similars.length > 1) {
        // Merge similar documents
        const mergedDoc = this.mergeSimilarDocuments(similars);
        merged.push(mergedDoc);

        // Mark all as processed
        similars.forEach((similar) => {
          processed.add(this.generateDocumentKey(similar));
        });
      } else if (!processed.has(key)) {
        // Add standalone document
        merged.push(doc);
        processed.add(key);
      }
    }

    // Return top documents with size limit
    return merged.slice(0, 6);
  }

  private generateDocumentKey(doc: Document): string {
    const source = doc.metadata.source || doc.metadata.filename || 'unknown';
    const page = doc.metadata.loc?.pageNumber || 0;
    const type = doc.metadata.type || 'unknown';
    return `${type}-${source}-${page}`;
  }

  private shouldMergeDocuments(doc1: Document, doc2: Document): boolean {
    const sameSource =
      (doc1.metadata.source || doc1.metadata.filename) ===
      (doc2.metadata.source || doc2.metadata.filename);
    const sameType = doc1.metadata.type === doc2.metadata.type;
    const samePage =
      doc1.metadata.loc?.pageNumber === doc2.metadata.loc?.pageNumber;

    return sameSource && sameType && samePage;
  }

  private mergeSimilarDocuments(documents: Document[]): Document {
    const combinedContent = documents
      .map((doc) => doc.pageContent.trim())
      .filter((content, index, arr) => arr.indexOf(content) === index) // Remove exact duplicates
      .join('\n\n');

    return {
      pageContent: combinedContent,
      metadata: {
        ...documents[0].metadata,
        mergedFrom: documents.length,
        totalLength: combinedContent.length,
      },
    };
  }

  sanitizeContent(content: string): string {
    return content
      .replace(/Email:\s*[^\s|]+/gi, 'Email: [PROTECTED]')
      .replace(/email:\s*[^\s|]+/gi, 'email: [PROTECTED]')
      .replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[EMAIL_PROTECTED]',
      );
  }

  formatContextForGeneration(documents: Document[]): string {
    return documents
      .map((doc, index) => {
        const cleanContent = this.sanitizeContent(doc.pageContent);
        const source = doc.metadata.filename || 'Company Document';
        const docType = doc.metadata.type || 'document';

        return `Document ${index + 1} (${docType} - ${source}):\n${cleanContent}`;
      })
      .join('\n\n---\n\n');
  }
}
