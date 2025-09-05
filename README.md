# HR Help Desk Server

An intelligent HR help desk system built with NestJS that provides AI-powered responses to employee queries about policies and personal information. The system uses vector embeddings, document retrieval, and language models to deliver accurate and contextual answers.

## 🚀 Features

- **AI-Powered Chat Interface**: Intelligent responses using OpenAI's GPT models
- **Document Retrieval**: Advanced vector-based document search using PGVector
- **Query Classification**: Automatically categorizes queries as personal, policy, or mixed
- **Document Processing**: Handles PDF policy documents and Excel employee data
- **Reranking**: Uses Cohere's reranking for improved relevance
- **Multi-language Support**: Handles both English and Mongolian content
- **Scalable Architecture**: Built with NestJS for enterprise-grade performance

## 🏗️ Architecture

The system follows a modular architecture with the following key components:

### Core Services

- **ChatOrchestratorService**: Main orchestrator using LangGraph for workflow management
- **RetrievalService**: Handles document retrieval from vector store
- **GenerationService**: Manages AI response generation
- **QueryClassifierService**: Classifies user queries by type
- **DocumentProcessorService**: Processes and merges documents
- **VectorStoreService**: Manages PGVector database connections

### Data Flow

1. **Query Reception**: User sends query via `/chat` endpoint
2. **Query Classification**: System determines if query is personal, policy, or mixed
3. **Document Retrieval**: Relevant documents are fetched from vector store
4. **Reranking**: Documents are reranked using Cohere for better relevance
5. **Response Generation**: AI generates contextual response using retrieved documents
6. **Response Delivery**: Structured response returned to user

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher) with pgvector extension
- pnpm package manager
- OpenAI API key
- Cohere API key

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd hr-server
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up PostgreSQL with pgvector**

   ```bash
   # Install pgvector extension
   CREATE EXTENSION vector;
   ```

4. **Configure environment variables**

   ```bash
   cp env.example .env
   ```

   Update the `.env` file with your configuration:

   ```env
   PORT=3100
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=hr_help_desk

   OPENAI_API_KEY=your_openai_key
   COHERE_API_KEY=your_cohere_key
   JWT_SECRET=your_jwt_secret
   ```

5. **Build the application**
   ```bash
   pnpm run build
   ```

## 🚀 Usage

### Starting the Server

```bash
# Development mode
pnpm run start:dev

# Production mode
pnpm run start:prod
```

The server will start on `http://localhost:3100` (or your configured PORT).

### Data Ingestion

Before using the system, you need to ingest your data:

1. **Ingest Employee Data**

   ```bash
   pnpm run ingest:employees
   ```

   This processes the Excel file at `src/data/employees/employee_data.xlsx`

2. **Ingest Policy Documents**
   ```bash
   pnpm run ingest:policies
   ```
   This processes PDF files in `src/data/policies/` directory

### API Endpoints

#### POST `/chat`

Send a chat message to the HR help desk.

**Request:**

```json
{
  "message": "What is my salary?"
}
```

**Headers:**

```
x-user-email: user@company.com
```

**Response:**

```json
{
  "response": "Based on your employee record, your salary is $75,000...",
  "timestamp": "Mon Jan 01 2024",
  "debugInfo": {
    "queryType": "personal",
    "personalDocsFound": 1,
    "policyDocsFound": 0,
    "totalBeforeRerank": 1,
    "totalAfterRerank": 1
  }
}
```

#### GET `/`

Health check endpoint that returns "Hello World!"

## 📁 Project Structure

```
src/
├── auth/                    # Authentication modules
├── config/                  # Configuration files
│   ├── app.config.ts       # Application configuration
│   └── configuration.service.ts
├── data/                   # Data files
│   ├── employees/          # Employee Excel files
│   └── policies/           # Policy PDF files
├── embeddings/             # Embedding utilities
├── ingestion/              # Data ingestion scripts
│   ├── ingest_employees.ts
│   └── ingest_policies.ts
├── models/                 # AI model configurations
│   ├── cohere_rerank.ts
│   └── groq_llm.ts
├── services/               # Core business logic
│   ├── chat-orchestrator.service.ts
│   ├── document-processor.service.ts
│   ├── generation.service.ts
│   ├── query-classifier.service.ts
│   ├── retrieval.service.ts
│   └── vector-store.service.ts
├── storage/                # Data storage utilities
│   └── retriever.ts
├── utils/                  # Utility functions
│   └── vector-store-utils.ts
├── app.controller.ts       # Main controller
├── app.module.ts          # Main module
├── app.service.ts         # Main service
└── main.ts               # Application entry point
```

## 🔧 Configuration

### Environment Variables

| Variable          | Description                     | Default      |
| ----------------- | ------------------------------- | ------------ |
| `PORT`            | Server port                     | 3100         |
| `DB_HOST`         | PostgreSQL host                 | 127.0.0.1    |
| `DB_PORT`         | PostgreSQL port                 | 5432         |
| `DB_USER`         | Database user                   | postgres     |
| `DB_PASSWORD`     | Database password               | Required     |
| `DB_NAME`         | Database name                   | hr_help_desk |
| `OPENAI_API_KEY`  | OpenAI API key                  | Required     |
| `COHERE_API_KEY`  | Cohere API key                  | Required     |
| `JWT_SECRET`      | JWT secret key                  | Required     |
| `LLM_MODEL`       | LLM model name                  | gpt-4        |
| `LLM_TEMPERATURE` | LLM temperature                 | 0            |
| `MAX_DOCUMENTS`   | Max documents to retrieve       | 10           |
| `RERANK_TOP_N`    | Top N documents after reranking | 5            |

### Database Schema

The system uses PostgreSQL with the following key tables:

- `langchain_pg_embedding`: Stores document embeddings
- `langchain_pg_collection`: Stores collection metadata
- Custom tables for parent document retrieval

## 🧪 Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## 📊 Monitoring and Debugging

The system provides comprehensive debug information in responses:

- Query classification results
- Document retrieval counts
- Reranking statistics
- Error details

Enable detailed logging by setting appropriate log levels in your environment.

## 🔒 Security Considerations

- JWT-based authentication (configured but not fully implemented)
- CORS protection
- Input validation and sanitization
- Secure environment variable handling

## 🚀 Deployment

### Production Build

```bash
pnpm run build
pnpm run start:prod
```

### Docker Support

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

EXPOSE 3100

CMD ["pnpm", "run", "start:prod"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the UNLICENSED license.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the debug information in API responses

## 🔄 Version History

- **v0.0.1**: Initial release with basic chat functionality and document retrieval
