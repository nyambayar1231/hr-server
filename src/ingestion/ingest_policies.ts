import path from 'path';
import { promises as fs } from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

import dotenv from 'dotenv';
import { retriever, saveParentDocuments } from '../storage/retriever';

dotenv.config();

const policiesDirectory = path.join(__dirname, '../../policies');

async function main() {
  console.log('Starting policy ingestion...\n');

  try {
    // Load existing parent documents
    console.log('Loading existing parent documents...');
    // const existingCount = await loadParentDocuments();

    // Process PDF files
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

async function loadPDF(filePath: string) {
  try {
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    return docs;
  } catch (error: any) {
    console.error(`Error loading PDF ${filePath}:`, error.message);
    return [];
  }
}

main().catch(console.error);
