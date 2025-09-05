import path from 'path';
import { promises as fs } from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Document } from '@langchain/core/documents';

import dotenv from 'dotenv';
import {
  createRetriever,
  loadParentDocuments,
  saveParentDocuments,
} from '../storage/retriever';

dotenv.config();

const isProduction = __dirname.includes('dist');
const policiesDirectory = isProduction
  ? path.join(__dirname, '../../src/data/policies')
  : path.join(__dirname, '../data/policies');

export async function ingestPolicies(): Promise<void> {
  const retriever = await createRetriever();

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
            error,
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

/**
 * Load a PDF and clean headers/footers including embedded page numbers.
 */
async function loadPDF(filePath: string): Promise<Document[]> {
  try {
    const loader = new PDFLoader(filePath, {
      splitPages: true, // process per page
    });

    const docs: Document[] = await loader.load();

    // Split each page into lines
    const pageLines: string[][] = docs.map((doc) =>
      doc.pageContent
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    );

    // Detect common header ignoring embedded page numbers
    const headerLines: string[] = detectCommonHeader(pageLines);

    const cleanedDocs: Document[] = docs.map((doc, idx) => {
      let lines = [...pageLines[idx]];

      // Remove multi-line header
      if (headerLines.length > 0) {
        let removeCount = 0;
        for (let i = 0; i < headerLines.length; i++) {
          const lineWithoutPage = removeEmbeddedPageNumbers(lines[i]);
          if (lineWithoutPage === headerLines[i]) {
            removeCount++;
          }
        }
        lines = lines.slice(removeCount);
      }

      // Remove embedded page numbers in remaining lines
      lines = lines.map(removeEmbeddedPageNumbers);

      // Remove footer if it looks like page number only
      const lastLine = lines[lines.length - 1];
      if (isPageNumberOnly(lastLine)) {
        lines = lines.slice(0, -1);
      }

      return {
        ...doc,
        pageContent: lines.join(' ').replace(/\s+/g, ' ').trim(),
      };
    });

    return cleanedDocs;
  } catch (error: any) {
    console.error(`Error loading PDF ${filePath}:`, error);
    return [];
  }
}

/**
 * Detect common multi-line header ignoring embedded page numbers
 */
function detectCommonHeader(pages: string[][]): string[] {
  if (pages.length === 0) return [];

  const minLines = Math.min(...pages.map((p) => p.length));
  const header: string[] = [];

  for (let i = 0; i < minLines; i++) {
    const lineSet = new Set(pages.map((p) => removeEmbeddedPageNumbers(p[i])));
    if (lineSet.size === 1) {
      header.push([...lineSet][0]); // keep the common static text
    } else {
      break;
    }
  }
  return header;
}

/**
 * Remove Mongolian or English page numbers from a line
 */
function removeEmbeddedPageNumbers(line: string): string {
  if (!line) return line;
  return line
    .replace(/(Хуудас\s*\d+\s*\/\s*\d+|Page\s*\d+\s*\/\s*\d+)/gi, '')
    .trim();
}

/**
 * Detect if the line contains only a page number
 */
function isPageNumberOnly(line: string | undefined): boolean {
  if (!line) return false;
  return /^(Хуудас\s*\d+\s*\/\s*\d+|Page\s*\d+\s*\/\s*\d+)$/i.test(line.trim());
}

// Do not auto-execute in server context. This function should be called explicitly
