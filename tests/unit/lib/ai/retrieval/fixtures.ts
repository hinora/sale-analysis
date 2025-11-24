/**
 * Test Fixtures for RAG Retrieval System
 *
 * Sample transaction data for testing embedder, indexer, and retriever modules
 */

export const sampleTransactions = [
  {
    _id: "txn-001",
    companyName: "Công ty TNHH ABC",
    goodsName: "Laptop Dell XPS 15",
    category: "Điện tử",
    quantity: 10,
    unitPrice: 35000000,
    totalValue: 350000000,
    transactionDate: new Date("2024-01-15"),
    importExport: "import",
    origin: "USA",
  },
  {
    _id: "txn-002",
    companyName: "Công ty CP XYZ",
    goodsName: "iPhone 15 Pro Max",
    category: "Điện tử",
    quantity: 50,
    unitPrice: 32000000,
    totalValue: 1600000000,
    transactionDate: new Date("2024-01-20"),
    importExport: "import",
    origin: "China",
  },
  {
    _id: "txn-003",
    companyName: "Công ty TNHH ABC",
    goodsName: "Cà phê hạt Arabica",
    category: "Nông sản",
    quantity: 5000,
    unitPrice: 120000,
    totalValue: 600000000,
    transactionDate: new Date("2024-02-01"),
    importExport: "export",
    origin: "Vietnam",
  },
  {
    _id: "txn-004",
    companyName: "Công ty CP DEF",
    goodsName: "Máy lạnh Daikin 2HP",
    category: "Điện máy",
    quantity: 20,
    unitPrice: 18000000,
    totalValue: 360000000,
    transactionDate: new Date("2024-02-10"),
    importExport: "import",
    origin: "Japan",
  },
  {
    _id: "txn-005",
    companyName: "Công ty CP XYZ",
    goodsName: "Gạo Jasmine",
    category: "Nông sản",
    quantity: 10000,
    unitPrice: 15000,
    totalValue: 150000000,
    transactionDate: new Date("2024-03-05"),
    importExport: "export",
    origin: "Vietnam",
  },
  {
    _id: "txn-006",
    companyName: "Công ty TNHH GHI",
    goodsName: "Samsung Galaxy S24 Ultra",
    category: "Điện tử",
    quantity: 30,
    unitPrice: 28000000,
    totalValue: 840000000,
    transactionDate: new Date("2024-03-15"),
    importExport: "import",
    origin: "Korea",
  },
  {
    _id: "txn-007",
    companyName: "Công ty TNHH ABC",
    goodsName: "Tôm sú đông lạnh",
    category: "Thủy sản",
    quantity: 2000,
    unitPrice: 350000,
    totalValue: 700000000,
    transactionDate: new Date("2024-04-01"),
    importExport: "export",
    origin: "Vietnam",
  },
  {
    _id: "txn-008",
    companyName: "Công ty CP DEF",
    goodsName: "Ô tô Mercedes-Benz C-Class",
    category: "Phương tiện",
    quantity: 5,
    unitPrice: 1500000000,
    totalValue: 7500000000,
    transactionDate: new Date("2024-04-10"),
    importExport: "import",
    origin: "Germany",
  },
  {
    _id: "txn-009",
    companyName: "Công ty CP XYZ",
    goodsName: "Điện thoại Xiaomi 14 Pro",
    category: "Điện tử",
    quantity: 100,
    unitPrice: 12000000,
    totalValue: 1200000000,
    transactionDate: new Date("2024-05-01"),
    importExport: "import",
    origin: "China",
  },
  {
    _id: "txn-010",
    companyName: "Công ty TNHH GHI",
    goodsName: "Hạt điều rang muối",
    category: "Nông sản",
    quantity: 3000,
    unitPrice: 180000,
    totalValue: 540000000,
    transactionDate: new Date("2024-05-15"),
    importExport: "export",
    origin: "Vietnam",
  },
];

/**
 * Sample queries for testing retrieval relevance
 */
export const sampleQueries = [
  {
    query: "Which company imported the most electronics?",
    expectedRelevantIds: ["txn-001", "txn-002", "txn-006", "txn-009"],
    category: "electronics",
  },
  {
    query: "What agricultural products did Vietnam export?",
    expectedRelevantIds: ["txn-003", "txn-005", "txn-010"],
    category: "agriculture",
  },
  {
    query: "Show me transactions by Công ty TNHH ABC",
    expectedRelevantIds: ["txn-001", "txn-003", "txn-007"],
    category: "company",
  },
  {
    query: "What are the highest value transactions?",
    expectedRelevantIds: ["txn-008", "txn-002", "txn-009"],
    category: "value",
  },
  {
    query: "Which products came from China?",
    expectedRelevantIds: ["txn-002", "txn-009"],
    category: "origin",
  },
];

/**
 * Expected embedding dimensions for Xenova/multilingual-e5-small
 */
export const EXPECTED_EMBEDDING_DIM = 384;

/**
 * Test configuration values
 */
export const testConfig = {
  batchSize: 100,
  topK: 5,
  similarityThreshold: 0.7,
  sessionTTL: 1800000, // 30 minutes in ms
};
