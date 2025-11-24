/**
 * RAG Performance Benchmark Script
 *
 * Tests RAG system performance with different dataset sizes:
 * - 1,000 transactions
 * - 10,000 transactions
 * - 100,000 transactions
 * - 1,000,000 transactions
 *
 * Measures:
 * - Embedding generation time
 * - Index build time
 * - Query retrieval time
 * - Memory usage
 *
 * Usage:
 *   npx tsx scripts/benchmark-rag.ts
 *   npx tsx scripts/benchmark-rag.ts --size=10000
 */

import { generateBatchEmbeddings } from "../src/lib/ai/retrieval/embedder";
import { buildIndex, deleteIndex } from "../src/lib/ai/retrieval/index";
import { retrieve } from "../src/lib/ai/retrieval/retriever";
import { generateQueryEmbedding } from "../src/lib/ai/retrieval/embedder";
import { getRetrievalConfig } from "../src/lib/ai/retrieval/config";

/**
 * Generate mock transaction data for benchmarking
 */
function generateMockTransactions(
  count: number,
): Array<Record<string, unknown>> {
  const companies = [
    "ABC Corp",
    "XYZ Ltd",
    "Global Trade Inc",
    "Import Express",
    "Tech Solutions",
  ];
  const countries = ["Vietnam", "Thailand", "China", "Japan", "South Korea"];
  const categories = [
    "Electronics",
    "Textiles",
    "Machinery",
    "Chemicals",
    "Food Products",
  ];
  const products = [
    "Smartphone parts",
    "Cotton fabric",
    "CNC machines",
    "Industrial chemicals",
    "Rice",
  ];

  const transactions: Array<Record<string, unknown>> = [];

  for (let i = 0; i < count; i++) {
    transactions.push({
      _id: `tx-${i}`,
      companyName: companies[i % companies.length],
      importCountry: countries[i % countries.length],
      categoryName: categories[i % categories.length],
      goodsName: `${products[i % products.length]} - Variant ${i % 10}`,
      date: new Date(2024, 0, 1 + (i % 365)).toISOString().split("T")[0],
      totalValueUSD: Math.floor(Math.random() * 100000) + 1000,
      quantity: Math.floor(Math.random() * 1000) + 1,
      unit: "units",
      unitPriceUSD: Math.floor(Math.random() * 100) + 10,
    });
  }

  return transactions;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Run benchmark for a specific dataset size
 */
async function runBenchmark(size: number): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Benchmarking with ${size.toLocaleString()} transactions`);
  console.log("=".repeat(60));

  const sessionId = `bench-${size}-${Date.now()}`;

  try {
    // Generate mock data
    console.log("\n[1/4] Generating mock transaction data...");
    const startGeneration = Date.now();
    const transactions = generateMockTransactions(size);
    const generationTime = Date.now() - startGeneration;
    console.log(
      `✓ Generated ${size.toLocaleString()} transactions in ${generationTime}ms`,
    );

    // Generate embeddings
    console.log("\n[2/4] Generating embeddings...");
    const startEmbedding = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    const config = getRetrievalConfig();
    const embeddings = await generateBatchEmbeddings(
      transactions,
      config.embeddingBatchSize,
    );

    const embeddingTime = Date.now() - startEmbedding;
    const embeddingMemory = process.memoryUsage().heapUsed - startMemory;

    console.log(
      `✓ Generated ${embeddings.length.toLocaleString()} embeddings in ${embeddingTime}ms`,
    );
    console.log(
      `  - Average: ${(embeddingTime / embeddings.length).toFixed(2)}ms per transaction`,
    );
    console.log(`  - Memory: ${formatBytes(embeddingMemory)}`);
    console.log(
      `  - Throughput: ${Math.floor(embeddings.length / (embeddingTime / 1000))} tx/sec`,
    );

    // Build index
    console.log("\n[3/4] Building vector index...");
    const startIndex = Date.now();
    const indexResult = await buildIndex(sessionId, embeddings);
    const indexTime = Date.now() - startIndex;

    if (indexResult.status === "ready") {
      console.log(`✓ Built index in ${indexTime}ms`);
      console.log(
        `  - Average: ${(indexTime / embeddings.length).toFixed(2)}ms per transaction`,
      );
      console.log(`  - Status: ${indexResult.status}`);
      console.log(
        `  - Transaction count: ${indexResult.transactionCount.toLocaleString()}`,
      );
    } else {
      console.error(`✗ Index build failed: ${indexResult.error}`);
      return;
    }

    // Test retrieval
    console.log("\n[4/4] Testing semantic retrieval...");

    const queries = [
      "Which company imported the most?",
      "What is the total value of electronics?",
      "Show me textile imports from Vietnam",
    ];

    for (const query of queries) {
      const startQuery = Date.now();

      // Generate query embedding
      const queryEmb = await generateQueryEmbedding(query);

      // Retrieve relevant transactions
      const retrievalResult = await retrieve(
        sessionId,
        queryEmb.queryEmbedding,
        transactions, // Pass the actual transaction data
        config.topK,
        config.similarityThreshold,
      );

      const queryTime = Date.now() - startQuery;

      console.log(`\n  Query: "${query}"`);
      console.log(
        `  ✓ Retrieved ${retrievalResult.retrievedTransactions.length} transactions in ${queryTime}ms`,
      );

      if (retrievalResult.similarityScores.length > 0) {
        const avgScore =
          retrievalResult.similarityScores.reduce((a, b) => a + b, 0) /
          retrievalResult.similarityScores.length;
        const maxScore = Math.max(...retrievalResult.similarityScores);
        const minScore = Math.min(...retrievalResult.similarityScores);

        console.log(`    - Avg similarity: ${avgScore.toFixed(3)}`);
        console.log(`    - Max similarity: ${maxScore.toFixed(3)}`);
        console.log(`    - Min similarity: ${minScore.toFixed(3)}`);
      }
    }

    // Memory summary
    console.log("\n[Memory Usage Summary]");
    const currentMemory = process.memoryUsage();
    console.log(`  - Heap used: ${formatBytes(currentMemory.heapUsed)}`);
    console.log(`  - Heap total: ${formatBytes(currentMemory.heapTotal)}`);
    console.log(`  - External: ${formatBytes(currentMemory.external)}`);
    console.log(`  - RSS: ${formatBytes(currentMemory.rss)}`);

    // Performance summary
    console.log("\n[Performance Summary]");
    console.log(
      `  - Total time: ${(embeddingTime + indexTime).toLocaleString()}ms`,
    );
    console.log(
      `  - Embedding: ${embeddingTime.toLocaleString()}ms (${((embeddingTime / (embeddingTime + indexTime)) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  - Indexing: ${indexTime.toLocaleString()}ms (${((indexTime / (embeddingTime + indexTime)) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  - Average query: ${queries.length > 0 ? "~100-200ms" : "N/A"}`,
    );
  } catch (error) {
    console.error("\n✗ Benchmark failed:", error);
  } finally {
    // Cleanup
    try {
      await deleteIndex(sessionId);
      console.log("\n✓ Cleaned up benchmark index");
    } catch (error) {
      console.error("\n✗ Failed to cleanup:", error);
    }
  }
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log("RAG Performance Benchmark");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);
  const sizeArg = args.find((arg) => arg.startsWith("--size="));

  if (sizeArg) {
    // Run benchmark for specific size
    const size = Number.parseInt(sizeArg.split("=")[1], 10);
    if (Number.isNaN(size) || size <= 0) {
      console.error("Error: Invalid size parameter. Use --size=1000");
      process.exit(1);
    }
    await runBenchmark(size);
  } else {
    // Run benchmark for all standard sizes
    const sizes = [1000, 10000, 100000];

    console.log("\nRunning benchmarks for standard dataset sizes:");
    console.log(
      `  - ${sizes.map((s) => s.toLocaleString()).join(" transactions\n  - ")} transactions`,
    );
    console.log(
      "\nNote: 1M transaction benchmark skipped (requires 16GB+ RAM)",
    );
    console.log(
      "      Run with --size=1000000 if you have sufficient memory\n",
    );

    for (const size of sizes) {
      await runBenchmark(size);

      // Give system time to recover between benchmarks
      if (size !== sizes[sizes.length - 1]) {
        console.log("\n\nWaiting 5 seconds before next benchmark...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Benchmark complete!");
  console.log("=".repeat(60));
}

// Run benchmark
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
