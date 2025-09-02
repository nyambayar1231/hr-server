import path from 'path';
import { promises as fs } from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { InMemoryStore } from '@langchain/core/stores';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ParentDocumentRetriever } from 'langchain/retrievers/parent_document';

import dotenv from 'dotenv';
import { loadParentDocuments, saveParentDocuments } from '../storage/retriever';
import { createVectorStoreInstance } from '../utils/vector-store-utils';

dotenv.config();

const policiesDirectory = path.join(__dirname, '../data/policies');

async function createStandaloneRetriever(): Promise<ParentDocumentRetriever> {
  const vectorStore = await createVectorStoreInstance();
  const byteStore = new InMemoryStore<Uint8Array>();

  return new ParentDocumentRetriever({
    vectorstore: vectorStore,
    byteStore,
    parentSplitter: new RecursiveCharacterTextSplitter({
      chunkOverlap: 400,
      chunkSize: 2000,
    }),
    childSplitter: new RecursiveCharacterTextSplitter({
      chunkOverlap: 0.15 * 200,
      chunkSize: 200,
    }),
    childK: 20,
    parentK: 5,
  });
}

async function main() {
  console.log('Starting policy ingestion...\n');

  const retriever = await createStandaloneRetriever();

  try {
    // Load existing parent documents
    console.log('Loading existing parent documents...');
    const existingCount = await loadParentDocuments();
    console.log(`Existing document counts: ${existingCount}`);

    const filenames = await fs.readdir(policiesDirectory);
    const pdfFilenames = filenames.filter((f) => f.endsWith('.pdf'));

    if (pdfFilenames.length === 0) {
      console.log('No PDF files found in', policiesDirectory);
      return;
    }

    console.log(`Found ${pdfFilenames.length} PDF files to processs\n`);

    let totalProcessed = 0;

    for (let i = 0; i < pdfFilenames.length; i++) {
      const filename = pdfFilenames[i];
      console.log(
        `[${i + 1}/${pdfFilenames.length}] Processing ${filename}...`,
      );

      const filePath = path.join(policiesDirectory, filename);
      const docs = await loadPDF(filePath);

      if (docs.length === 0) {
        console.log(`No content extracted from ${filename}`);
        continue;
      }

      // Add metadata
      const docsWithMetadata = docs.map((doc) => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          type: 'policy',
          filename,
          source: filePath,
          ingested_at: new Date().toISOString(),
        },
      }));

      //   Process in batches
      const batchSize = 5;
      for (let j = 0; j < docsWithMetadata.length; j += batchSize) {
        const batch = docsWithMetadata.slice(j, j + batchSize);

        try {
          await retriever.addDocuments(batch);
          console.log(
            `Processed batch ${Math.floor(j / batchSize) + 1}/${Math.ceil(
              docsWithMetadata.length / batchSize,
            )}`,
          );
        } catch (error: any) {
          console.error(
            `Error processing batch ${Math.floor(j / batchSize) + 1}:`,
            error.message,
          );
        }
      }

      totalProcessed += docs.length;
      console.log(`Completed ${filename}: ${docs.length} pages\n`);
    }

    // Save parent documents to disk
    console.log('Saving parent documents to disk...');
    const savedCount = await saveParentDocuments();

    console.log('\nIngestion completed!');
    console.log(`Summary:`);
    console.log(`   • Total pages processed: ${totalProcessed}`);
    console.log(`   • Parent documents saved: ${savedCount}`);
    console.log(`   • PDF files processed: ${pdfFilenames.length}`);
  } catch (error) {
    console.error('Fatal error during ingestion:', error);

    console.log('Attempting to save partial data...');
    await saveParentDocuments();

    process.exit(1);
  }
}

async function loadPDF(filePath: string): Promise<Document[]> {
  try {
    const loader = new PDFLoader(filePath, {
      splitPages: false,
    });
    const docs = await loader.load();

    // TO DO: Probably will improve this. This is just for a test purpose!!!
    const unwantedTextPattern =
      /(М-Си-Эс Групп|ХӨДӨЛМӨРИЙН ДОТООД ЖУРАМ|Код|HR-0100R|Дотоод хэрэгцээнд \/ Office use only|Хуудас \d+ \/ \d+)/g;

    const cleanedDocs = docs.map((doc) => {
      let cleanedContent = doc.pageContent
        .replace(unwantedTextPattern, '')
        .trim();

      cleanedContent = cleanedContent.replace(/\n\s*\n/g, '\n\n');

      return {
        ...doc,
        pageContent: cleanedContent,
      };
    });

    return cleanedDocs;
  } catch (error: any) {
    console.error(`Error loading PDF ${filePath}:`, error.message);
    return [];
  }
}

main().catch(console.error);
