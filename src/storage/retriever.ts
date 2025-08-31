import { promises as fs } from 'fs';
import path from 'path';

import { InMemoryStore } from '@langchain/core/stores';
import { vectorStore } from '../pg';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ParentDocumentRetriever } from 'langchain/retrievers/parent_document';
// Path to store the parent documents
const STORE_FILE_PATH = path.join(
  __dirname,
  '../../data/parent_documents.json',
);

// Create In memory store
const byteStore = new InMemoryStore<Uint8Array>();

// Create retriver
export const retriever = new ParentDocumentRetriever({
  vectorstore: vectorStore,
  byteStore,
  parentSplitter: new RecursiveCharacterTextSplitter({
    chunkOverlap: 0.15 * 800,
    chunkSize: 800,
  }),

  childSplitter: new RecursiveCharacterTextSplitter({
    chunkOverlap: 0.15 * 200,
    chunkSize: 200,
  }),
  childK: 20,
  parentK: 5,
});

export async function saveParentDocuments() {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname('./'), { recursive: true });

    const data: Record<string, string> = {};

    // Extract all data from in-memory store
    for await (const key of byteStore.yieldKeys()) {
      const [value] = await byteStore.mget([key]);
      if (value) {
        data[key] = Buffer.from(value).toString('base64');
      }
    }

    await fs.writeFile(STORE_FILE_PATH, JSON.stringify(data, null, 2));

    console.log(`Saved ${Object.keys(data).length} parent documents to disk`);
    return Object.keys(data).length;
  } catch (error) {
    console.error('Error saving parent documents:', error);
    return 0;
  }
}

export async function loadParentDocuments() {
  try {
    const fileContent = await fs.readFile(STORE_FILE_PATH, 'utf-8');
    const data: Record<string, string> = JSON.parse(fileContent);

    const keyValuePairs: [string, Uint8Array][] = Object.entries(data).map(
      ([key, base64Value]) => [
        key,
        new Uint8Array(Buffer.from(base64Value, 'base64')),
      ],
    );

    if (keyValuePairs.length > 0) {
      await byteStore.mset(keyValuePairs);
      console.log(`Loaded ${keyValuePairs.length} parent documents from disk`);
      return keyValuePairs.length;
    }
    return 0;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('No existing parent documents found (first run)');
    } else {
      console.error('Error loading parent documents:', error);
    }
    return 0;
  }
}

export async function clearAllData() {
  try {
    // Clear in-memory store
    const keys: string[] = [];
    for await (const key of byteStore.yieldKeys()) {
      keys.push(key);
    }
    if (keys.length > 0) {
      await byteStore.mdelete(keys);
    }

    // Remove file
    try {
      await fs.unlink(STORE_FILE_PATH);
    } catch (error) {
      // File might not exist
    }

    console.log(` Cleared ${keys.length} parent documents`);
    return keys.length;
  } catch (error) {
    console.error(' Error clearing data:', error);
    return 0;
  }
}
