# Export Goods Analysis Application

A comprehensive data analysis platform for export/import transaction data with AI-powered insights using DeepSeek-R1.

## Features

- 📊 **CSV Import**: Fast bulk import with duplicate detection and data validation
- 🔍 **Transaction Query**: Advanced filtering, sorting, and pagination
- 📦 **Goods Catalog**: Product-centric view with aggregated statistics
- 🏢 **Company Dashboard**: Customer analytics with import metrics
- 🤖 **AI Analysis**: Natural language queries powered by DeepSeek-R1 (1.5B for dev, 14B for production)
- ⚡ **Background Jobs**: Asynchronous AI classification of imported goods

## Tech Stack

- **Frontend**: Next.js 16, React, Material-UI (MUI)
- **Backend**: Next.js API Routes, Node.js
- **Database**: MongoDB 7
- **AI**: Ollama with DeepSeek-R1 models
- **RAG (Retrieval-Augmented Generation)**: 
  - `@xenova/transformers` - Embedding generation (multilingual-e5-small)
  - `vectra` - In-memory vector database for semantic search
- **Deployment**: Docker Compose

## AI Models

This application uses DeepSeek-R1 models for AI-powered features:

- **Development**: `deepseek-r1:1.5b` (~1GB) - Fast, lightweight for local development
- **Production**: `deepseek-r1:8b` (~8GB) - More accurate, better reasoning for production use

### Model Configuration

The AI model is automatically selected based on the environment:

```bash
# Development (uses deepseek-r1:1.5b)
NODE_ENV=development

# Production (uses deepseek-r1:8b)
NODE_ENV=production
```

You can override the model by setting the `AI_MODEL` environment variable:

```bash
AI_MODEL=deepseek-r1:8b  # Force 14B model in development
AI_MODEL=deepseek-r1:1.5b # Force 1.5B model in production (not recommended)
```

## RAG (Retrieval-Augmented Generation)

### What is RAG?

RAG enables the AI to work efficiently with millions of transactions by retrieving only the most relevant data for each query, rather than loading all data into memory. This dramatically improves performance and scalability.

### How It Works

1. **Embedding Generation**: Transactions are converted to semantic vectors (384-dimensional embeddings) using the `multilingual-e5-small` model
2. **Vector Indexing**: Embeddings are stored in an in-memory vector database (vectra) for fast similarity search
3. **Semantic Retrieval**: When you ask a question, the system finds the most relevant transactions based on semantic similarity
4. **Answer Generation**: Only relevant transactions are sent to the LLM, reducing memory usage and improving response time

### Key Benefits

- **Scalability**: Handle 1M+ transactions per session
- **Memory Efficiency**: <2GB memory usage vs. 10GB+ without RAG
- **Fast Queries**: <10 seconds response time even for massive datasets
- **Accuracy**: Citations reference specific retrieved transactions for transparency

### Configuration

```bash
# .env.local or environment variables

# Number of transactions to retrieve per query
RAG_TOP_K=100              # Default: 100, Max: 500

# Minimum similarity score (cosine) to include a transaction
RAG_SIMILARITY_THRESHOLD=0.6  # Default: 0.6, Range: 0.0-1.0

# Batch size for embedding generation
RAG_BATCH_SIZE=100         # Default: 100
```

### Performance Characteristics

- **Indexing Speed**: ~0.5-1 second per 1000 transactions
- **Retrieval Speed**: <100ms for semantic search
- **Memory**: ~400MB per 1M transactions
- **Index Lifetime**: 30 minutes (automatic cleanup)

### Technical Stack

- **Embedding Model**: `Xenova/multilingual-e5-small` (384 dimensions)
- **Vector Database**: `vectra` (in-memory TypeScript vector DB)
- **Similarity Metric**: Cosine similarity
- **Languages**: Vietnamese and English fully supported

```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- 8GB+ RAM (16GB recommended for production)
- 10GB+ disk space (for models and data)

### Development Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd sale-analysis
```

2. **Start all services** (development mode with 1.5B model):
```bash
docker-compose up -d
```

This will:
- Start Next.js app on port 3000
- Start MongoDB on port 27017  
- Start Ollama on port 11434
- Download DeepSeek-R1 1.5B model (~1GB, takes 1-2 minutes)

3. **Wait for model download**:
```bash
docker-compose logs -f ollama-setup
```

4. **Access the application**:
- App: http://localhost:3000
- MongoDB: mongodb://localhost:27017

### Production Setup

1. **Start production services** (with 14B model):
```bash
docker-compose -f docker-compose.prod.yml up -d
```

This will:
- Build optimized Next.js production bundle
- Download DeepSeek-R1 14B model (~8GB, takes 10-15 minutes)
- Configure production resource limits

2. **Monitor model download**:
```bash
docker-compose -f docker-compose.prod.yml logs -f ollama-setup
```

## Usage

### 1. Import CSV Data

1. Navigate to **Nhập CSV** (Import CSV)
2. Upload your export transaction CSV file
3. Wait for processing (shows progress bar)
4. Review import summary

**Note**: Initial import uses fast fallback classification. AI classification runs automatically in the background every 5 minutes.

### 2. Query Transactions

1. Navigate to **Tra cứu giao dịch** (Transaction Query)
2. Apply filters:
   - Company name (partial match)
   - Date range
   - Category
   - Goods name
3. Sort by columns
4. Pagination (50 records per page)

### 3. Analyze Goods

1. Navigate to **Danh mục hàng hóa** (Goods Catalog)
2. View aggregated statistics per product
3. Click on any product to see transaction details

### 4. Company Dashboard

1. Navigate to **Phân tích công ty** (Company Analysis)
2. View import statistics by company
3. Click on any company to see transaction breakdown

### 5. AI Analysis

The AI Analysis feature now uses **Retrieval-Augmented Generation (RAG)** to handle datasets with millions of transactions efficiently.

#### How RAG Works

1. **Data Loading**: When you load data into an AI session, transactions are converted to semantic embeddings
2. **Indexing**: A vector index is built to enable fast similarity search (takes ~60 seconds for 100k transactions)
3. **Query Processing**: When you ask a question, the system:
   - Converts your question to an embedding
   - Retrieves the most relevant transactions (default: top 100)
   - Sends only relevant data to the LLM for answer generation
4. **Response**: Get accurate answers with citations, even from millions of records

#### Usage

1. Navigate to **AI Phân tích** (AI Analysis)
2. Select data filters (category, date range, company)
3. Click **"Tải dữ liệu vào AI"** (Load Data to AI)
4. Wait for indexing:
   - Status: "Đang chỉ mục" (Indexing) → "Sẵn sàng" (Ready)
   - Indexing time: ~0.5-1 second per 1000 transactions
5. Ask questions in Vietnamese or English:
   - "Công ty nào nhập khẩu nhiều nhất?" (Which company imports the most?)
   - "Tổng giá trị xuất khẩu là bao nhiêu?" (What's the total export value?)
   - "So sánh giá trị giữa các danh mục" (Compare values between categories)

#### Performance Benefits

- **Memory Usage**: Query millions of transactions with <2GB memory (vs. 10GB+ without RAG)
- **Response Time**: <10 seconds for queries on 1M+ transactions (vs. 60+ seconds without RAG)
- **Scalability**: Handles up to 1M transactions per session

#### RAG Configuration

You can customize RAG behavior with environment variables:

```bash
# Number of transactions to retrieve per query (higher = more context, slower)
RAG_TOP_K=100          # Default: 100, Range: 1-500

# Minimum similarity score to include a transaction (higher = stricter matching)
RAG_SIMILARITY_THRESHOLD=0.6  # Default: 0.6, Range: 0-1

# Batch size for embedding generation (lower = less memory, slower)
RAG_BATCH_SIZE=100     # Default: 100
```

## Development

### Local Development (without Docker)

1. **Install dependencies**:
```bash
yarn install
```

2. **Set environment variables**:
```bash
cp .env.example .env.local
# Edit .env.local with your values
```

3. **Start MongoDB** (required):
```bash
docker-compose up mongodb -d
```

4. **Start Ollama** (required for AI features):
```bash
docker-compose up ollama -d
ollama pull deepseek-r1:1.5b
```

5. **Run development server**:
```bash
yarn dev
```

### Build for Production

```bash
yarn build
yarn start
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ai/             # AI analysis components
│   ├── common/         # Shared components
│   ├── import/         # CSV import components
│   ├── layout/         # Layout components
│   └── tables/         # Data table components
├── lib/                # Backend utilities
│   ├── ai/            # AI services (classifier, query handler)
│   ├── csv/           # CSV processing
│   ├── db/            # Database models and connection
│   ├── jobs/          # Background jobs
│   └── utils/         # Helper functions
├── pages/             # Next.js pages and API routes
│   ├── api/          # API endpoints
│   └── *.tsx         # Page components
└── styles/           # Global styles
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://mongodb:27017/export-goods` |
| `OLLAMA_HOST` | Ollama API URL | `http://ollama:11434` |
| `AI_MODEL` | AI model name | Auto (1.5b dev, 14b prod) |
| `RAG_TOP_K` | Number of transactions to retrieve for RAG queries | `100` |
| `RAG_SIMILARITY_THRESHOLD` | Minimum similarity score for retrieval (0-1) | `0.6` |
| `RAG_BATCH_SIZE` | Batch size for embedding generation | `100` |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1` |

### AI Model Selection Logic

```javascript
// Code automatically selects model based on environment
const model = process.env.AI_MODEL || 
  (process.env.NODE_ENV === "production" 
    ? "deepseek-r1:8b"    // Production: More accurate
    : "deepseek-r1:1.5b"); // Development: Faster
```

## Performance

### Import Speed

- **With fallback classification**: ~5,000 records/minute
- **Background AI classification**: ~10-50 goods/minute (depends on model)

### AI Query Response Time

- **1.5B model** (development): 2-5 seconds per query
- **14B model** (production): 5-15 seconds per query (more accurate)
- **RAG Indexing**: ~0.5-1 second per 1000 transactions (one-time per session)
- **RAG Retrieval**: <100ms to find relevant transactions

### Resource Requirements

| Component | Development (1.5B) | Production (14B) |
|-----------|-------------------|------------------|
| App | 2GB RAM | 4GB RAM |
| MongoDB | 2GB RAM | 4GB RAM |
| Ollama | 4GB RAM | 16GB RAM |
| **RAG Index** | **+400MB per 1M tx** | **+400MB per 1M tx** |
| **Total** | **8GB+ RAM** | **24GB+ RAM** |

**GPU Support**: Highly recommended for production. Reduces AI response time by 10-20x.

**Note**: RAG uses in-memory vector indexes. Each session with 1M transactions requires ~400MB additional memory. Indexes are automatically cleaned up when sessions expire (30-minute TTL).

## Troubleshooting

### Model Download Issues

```bash
# Check Ollama service logs
docker-compose logs ollama

# Manually pull model
docker exec -it export-goods-ollama ollama pull deepseek-r1:1.5b

# Verify models installed
docker exec -it export-goods-ollama ollama list
```

### AI Features Not Working

1. Verify Ollama is running: `curl http://localhost:11434`
2. Check model is downloaded: `docker exec -it export-goods-ollama ollama list`
3. View logs: `docker-compose logs app | grep AI`

### Database Connection Issues

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Test connection
docker exec -it export-goods-mongodb mongosh --eval "db.adminCommand('ping')"
```

## License

[Add your license information here]

## Support

For issues and questions, please open an issue on the repository.
