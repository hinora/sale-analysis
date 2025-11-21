# Quickstart Guide: Export Goods Analysis Application

**Feature**: Export Goods Analysis  
**Branch**: `001-export-goods-analysis`  
**Created**: 2025-11-20

## Overview

This guide helps developers set up the Export Goods Analysis application locally, understand the architecture, and start contributing. The application is built with Next.js (Pages Router), MongoDB, and Ollama for AI-powered analysis.

---

## Prerequisites

Before starting, **choose one of two setup methods**:

### Option 1: Docker Compose (Recommended for Quick Start)

- **Docker Desktop**: Version 4.0+ ([Download](https://www.docker.com/products/docker-desktop/))
  - Includes Docker Engine and Docker Compose
- **System Requirements**:
  - 8GB RAM minimum (4GB allocated to Docker)
  - 15GB disk space (for images, volumes, and models)
- **Advantages**:
  - Zero dependency installation
  - Consistent environment across all developers
  - Single command to start everything
  - Automatic model downloads

### Option 2: Local Installation (More Control)

- **Node.js**: Version 18+ ([Download](https://nodejs.org/))
- **npm**: Version 9+ (comes with Node.js)
- **MongoDB**: Version 7+ ([Installation Guide](https://www.mongodb.com/docs/manual/installation/))
- **Ollama**: Latest version ([Installation Guide](https://ollama.ai/download))
- **Git**: For version control
- **Advantages**:
  - Direct access to services for debugging
  - No Docker overhead
  - Familiar local development workflow

### Verify Installations

**For Docker Compose:**
```bash
docker --version        # Should be 20.10.0 or higher
docker-compose --version  # Should be 2.0.0 or higher
```

**For Local Installation:**
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
mongod --version  # Should be 7.0 or higher
ollama --version  # Should show installed version
```

---

## Quick Start with Docker Compose (Recommended)

### 1. Clone and Start Services

```bash
# Clone repository
git clone <repository-url>
cd sale-analysis
git checkout 001-export-goods-analysis

# Copy Docker environment file
cp .env.docker .env

# Build and start all services
docker-compose up --build
```

**What this does:**
- Builds Next.js application container (~5 minutes first time)
- Starts MongoDB 7 with persistent volume
- Starts Ollama service
- Downloads llama3.1 and mistral models (~8GB, takes 5-10 minutes first time)
- Starts application on http://localhost:3000

### 2. Verify All Services Running

```bash
# Check service status
docker-compose ps

# Expected output:
# NAME                          STATUS              PORTS
# export-goods-app              Up                  0.0.0.0:3000->3000/tcp
# export-goods-mongodb          Up (healthy)        0.0.0.0:27017->27017/tcp
# export-goods-ollama           Up (healthy)        0.0.0.0:11434->11434/tcp
# export-goods-ollama-setup     Exited (0)
```

### 3. Access Application

- **Web Application**: http://localhost:3000
- **MongoDB**: mongodb://localhost:27017/export-goods (use MongoDB Compass for GUI)
- **Ollama API**: http://localhost:11434

### 4. Development Workflow with Docker

```bash
# Make changes in src/ directory
# → Next.js automatically hot-reloads (no restart needed)

# View application logs
docker-compose logs -f app

# View all service logs
docker-compose logs -f

# Restart a specific service
docker-compose restart app

# Stop all services (preserves data)
docker-compose down

# Stop and remove all data (clean slate)
docker-compose down -v

# Rebuild after package.json changes
docker-compose up --build app
```

### 5. Docker Troubleshooting

**Problem**: Ollama models not downloading

```bash
# Check Ollama service status
docker-compose exec ollama ollama list

# Manually pull models if needed
docker-compose exec ollama ollama pull llama3.1
docker-compose exec ollama ollama pull mistral
```

**Problem**: MongoDB connection refused

```bash
# Check MongoDB health
docker-compose ps mongodb

# View MongoDB logs
docker-compose logs mongodb

# Restart MongoDB
docker-compose restart mongodb
```

**Problem**: Port already in use (3000, 27017, or 11434)

```bash
# Option 1: Stop conflicting service
lsof -ti:3000 | xargs kill -9

# Option 2: Change port in docker-compose.yml
# Edit ports section, e.g., "3001:3000" (host:container)
```

**Problem**: Out of disk space

```bash
# Remove unused Docker resources
docker system prune -a --volumes

# Check disk usage
docker system df
```

---

## Local Installation Setup (Alternative)

If you prefer local installation without Docker:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd sale-analysis
git checkout 001-export-goods-analysis
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- Next.js 16+ (Pages Router)
- React 19+
- Material-UI v6+
- Mongoose (MongoDB ODM)
- TypeScript 5+
- Biome (linting/formatting)
- And all other required packages

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/export-goods

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_TELEMETRY_DISABLED=1
```

### 4. Start MongoDB

```bash
# Start MongoDB service (macOS with Homebrew)
brew services start mongodb-community

# Or run MongoDB directly
mongod --dbpath /usr/local/var/mongodb

# For Linux (systemd)
sudo systemctl start mongod
```

Verify MongoDB is running:
```bash
mongosh --eval "db.version()"
```

### 5. Install and Start Ollama

```bash
# Install Ollama models
ollama pull llama3.1
ollama pull mistral

# Start Ollama service (runs in background by default)
ollama serve
```

Verify Ollama is running:
```bash
curl http://localhost:11434/api/version
```

### 6. Start Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

### 7. Optional: Seed Sample Data

```bash
npm run seed
```

This imports data from `data-example/sale-raw-data-small.csv` into the database.

---

## Choosing Docker vs Local Installation

| Criteria | Docker Compose | Local Installation |
|----------|----------------|-------------------|
| **Setup Time** | 5 minutes | 20-30 minutes |
| **Consistency** | ✅ Identical across all developers | ⚠️ Version differences possible |
| **Resource Usage** | 4GB RAM for containers | 2GB RAM for services |
| **Debugging** | Requires docker commands | Direct service access |
| **Hot Reload** | ✅ Supported via volumes | ✅ Native support |
| **Database GUI** | ✅ Connect to localhost:27017 | ✅ Connect to localhost:27017 |
| **Best For** | Quick start, CI/CD, new team members | Deep debugging, service customization |

**Recommendation**: Use Docker Compose for initial setup and daily development. Switch to local installation if you need to debug MongoDB queries, customize Ollama parameters, or work offline.

---

## Project Structure

```text
sale-analysis/
├── src/
│   ├── pages/
│   │   ├── index.tsx               # Dashboard/home page
│   │   ├── import.tsx              # CSV import page
│   │   ├── transactions.tsx        # Transaction query page
│   │   ├── goods.tsx               # Goods catalog page
│   │   ├── companies.tsx           # Company dashboard page
│   │   ├── ai-analysis.tsx         # AI analysis page
│   │   └── api/                    # Backend API routes
│   │       ├── import/             # CSV import endpoints
│   │       ├── transactions/       # Transaction query endpoints
│   │       ├── goods/              # Goods catalog endpoints
│   │       ├── companies/          # Company dashboard endpoints
│   │       └── ai/                 # AI analysis endpoints
│   ├── components/                 # React components
│   │   ├── layout/                 # Layout components
│   │   ├── import/                 # Import-related components
│   │   ├── tables/                 # Table components
│   │   ├── ai/                     # AI interface components
│   │   └── common/                 # Shared components
│   ├── lib/
│   │   ├── db/                     # Database models and connection
│   │   │   ├── connection.ts
│   │   │   └── models/             # Mongoose schemas
│   │   ├── csv/                    # CSV processing logic
│   │   ├── ai/                     # Ollama AI integration
│   │   ├── utils/                  # Utility functions
│   │   └── types/                  # TypeScript type definitions
│   └── styles/                     # Global styles and theme
├── tests/                          # Test files
│   ├── unit/                       # Unit tests
│   └── integration/                # Integration tests
├── public/
│   └── templates/                  # CSV template files
├── data-example/                   # Sample data
├── specs/001-export-goods-analysis/  # Feature specifications
│   ├── spec.md                     # Feature specification
│   ├── plan.md                     # Implementation plan
│   ├── research.md                 # Technology research
│   ├── data-model.md               # Database schemas
│   ├── quickstart.md               # This file
│   └── contracts/                  # API contracts (OpenAPI)
├── docker-compose.yml              # Docker services orchestration
├── Dockerfile                      # Next.js container definition
├── .dockerignore                   # Docker build exclusions
├── .env.docker                     # Docker environment template
└── package.json
```

---

## Development Workflow

### Running the Application

**With Docker Compose:**
```bash
docker-compose up        # Start and view logs
docker-compose up -d     # Start in background (detached)
docker-compose down      # Stop all services
```

**With Local Installation:**
```bash
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm start                # Start production server
```

### Code Quality

```bash
# Run linter and formatter
npm run lint

# Auto-fix formatting issues
npm run format
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

---

## Key Features Implementation Status

### Phase 1 - Core Data Import (Priority: P1)
- [ ] CSV file upload with streaming processing
- [ ] Duplicate detection (within file and database)
- [ ] AI goods classification with Ollama
- [ ] CSV template download endpoint
- [ ] Import progress tracking

### Phase 2 - Transaction Queries (Priority: P1)
- [ ] Transaction list page with pagination
- [ ] Filter by company, date range, category, goods
- [ ] Sort by price, quantity, total value
- [ ] URL query parameter persistence

### Phase 3 - Goods Catalog (Priority: P2)
- [ ] Goods list with aggregated statistics
- [ ] Filter by company, date range, category
- [ ] Sort by export value, quantity, transaction count
- [ ] Goods detail view with top companies

### Phase 4 - Company Dashboard (Priority: P2)
- [ ] Company list with aggregated statistics
- [ ] Filter by category, goods, date range
- [ ] Sort by import value, quantity, transaction count
- [ ] Company detail view with import patterns

### Phase 5 - AI Analysis (Priority: P3)
- [ ] AI session creation and management
- [ ] Data selection interface with filters
- [ ] Feed data to Ollama endpoint
- [ ] Natural language query interface
- [ ] Conversation history display
- [ ] Suggested analytical questions

---

## API Endpoints

All API endpoints are documented in OpenAPI format in `specs/001-export-goods-analysis/contracts/`:

- **import-api.yaml**: CSV import endpoints
- **transactions-api.yaml**: Transaction query endpoints
- **goods-api.yaml**: Goods catalog endpoints
- **companies-api.yaml**: Company dashboard endpoints
- **ai-analysis-api.yaml**: AI analysis endpoints

You can view the API documentation using [Swagger UI](https://swagger.io/tools/swagger-ui/) or [Redoc](https://redocly.com/redoc/).

---

## Database Management

### Connect to MongoDB Shell

```bash
mongosh sale_analysis
```

### Common MongoDB Commands

```javascript
// Show all collections
show collections

// Count transactions
db.transactions.countDocuments()

// Find a specific transaction
db.transactions.findOne({ declarationNumber: "306709194540" })

// List all companies
db.companies.find().limit(10)

// Check indexes
db.transactions.getIndexes()

// Drop database (CAUTION: deletes all data)
db.dropDatabase()
```

### Backup and Restore

```bash
# Backup database
mongodump --db sale_analysis --out ./backup

# Restore database
mongorestore --db sale_analysis ./backup/sale_analysis
```

---

## Ollama AI Integration

### Available Models

The application supports multiple Ollama models:

- **llama3.1** (default): Best for classification and complex queries
- **mistral**: Faster, good for name shortening
- **llama2**: Alternative for classification
- **codellama**: For technical queries

### Pull Additional Models

```bash
ollama pull llama2
ollama pull codellama
```

### Test Ollama Directly

```bash
# Test goods classification
curl -X POST http://localhost:11434/api/generate -d '{
  "model": "llama3.1",
  "prompt": "Classify this goods into a category: CÁ NGỦ MẮT TO TƯƠI NGUYÊN CON. Choose from: Frozen Seafood, Agricultural Products, Manufactured Goods, Other",
  "stream": false
}'
```

---

## Troubleshooting

### MongoDB Connection Issues

**Problem**: `MongoServerError: connect ECONNREFUSED`

**Solution**:
```bash
# Check if MongoDB is running
brew services list | grep mongodb

# Restart MongoDB
brew services restart mongodb-community
```

### Ollama Not Responding

**Problem**: `ECONNREFUSED localhost:11434`

**Solution**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# Start Ollama service
ollama serve
```

### TypeScript Errors

**Problem**: Type errors in IDE

**Solution**:
```bash
# Reinstall dependencies and rebuild
rm -rf node_modules package-lock.json
npm install
```

### Port 3000 Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

---

## Testing Strategy

### Unit Tests

Located in `tests/unit/`, these test individual functions and utilities:

```bash
# Run specific unit test
npm test tests/unit/csv-parser.test.ts
```

### Integration Tests

Located in `tests/integration/`, these test full API workflows:

```bash
# Run specific integration test
npm test tests/integration/import.test.ts
```

### Manual Testing Checklist

Before submitting a PR, verify:

1. ✅ CSV import works with sample data
2. ✅ Duplicate detection identifies and skips duplicates
3. ✅ AI classification assigns reasonable categories
4. ✅ Transaction filters work correctly
5. ✅ Pagination loads pages without errors
6. ✅ AI query returns grounded responses with citations

---

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/sale_analysis
OLLAMA_HOST=http://localhost:11434
```

### Production

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/sale_analysis
OLLAMA_HOST=http://ollama-server:11434
```

### Testing

```env
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/sale_analysis_test
OLLAMA_HOST=http://localhost:11434
```

---

## Contributing Guidelines

1. **Create a feature branch** from `001-export-goods-analysis`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow TypeScript strict mode** - no `any` types unless absolutely necessary

3. **Write tests** for new functionality:
   - Unit tests for utility functions
   - Integration tests for API endpoints

4. **Run linter before committing**:
   ```bash
   npm run lint
   ```

5. **Follow commit message conventions**:
   ```
   feat: add CSV duplicate detection
   fix: resolve pagination issue on goods page
   docs: update quickstart with Ollama setup
   test: add integration test for import workflow
   ```

6. **Submit PR** with:
   - Clear description of changes
   - Link to relevant spec/issue
   - Screenshots for UI changes
   - Test results

---

## Performance Monitoring

### Key Metrics to Watch

- **CSV Import**: <5 minutes for 10K rows (SC-001)
- **Transaction Query**: <2 seconds (SC-004)
- **Pagination**: <1 second (SC-010)
- **AI Query Response**: <10 seconds (SC-006)

### Profiling Tools

```bash
# Enable Next.js performance profiling
ANALYZE=true npm run build
```

---

## Resources

- **Specification**: [spec.md](./spec.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Research**: [research.md](./research.md)
- **API Contracts**: [contracts/](./contracts/)
- **Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

### External Documentation

- [Next.js Pages Router](https://nextjs.org/docs/pages)
- [Material-UI](https://mui.com/material-ui/getting-started/)
- [Mongoose](https://mongoosejs.com/docs/guide.html)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [MongoDB Manual](https://www.mongodb.com/docs/manual/)

---

## Support

For questions or issues:
1. Check the [spec.md](./spec.md) for requirements clarification
2. Review [research.md](./research.md) for technology decisions
3. Consult API contracts in [contracts/](./contracts/)
4. Ask team members via Slack/email

---

**Last Updated**: 2025-11-20  
**Maintainers**: Export Goods Analysis Team
