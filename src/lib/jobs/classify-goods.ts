import { connectToDatabase } from "@/lib/db/connection";
import { Goods } from "@/lib/db/models/Goods";
import { aiClassifier } from "@/lib/ai/classifier";
import { aiNameShortener } from "@/lib/ai/name-shortener";

/**
 * Job result interface
 */
export interface ClassifyGoodsJobResult {
  processed: number;
  succeeded: number;
  failed: number;
  duration: number;
  completedAt?: Date;
}

/**
 * Job options interface
 */
export interface ClassifyGoodsJobOptions {
  batchSize?: number;
  limit?: number;
}

/**
 * Background job to classify goods with fallback classification
 *
 * Processes goods where classifiedBy='fallback' and updates them with:
 * - AI-generated category (via Ollama DeepSeek-R1)
 * - AI-generated short name (via Ollama DeepSeek-R1)
 * - Updated classifiedBy field ('deepseek-r1')
 * - Updated classifiedAt timestamp
 *
 * @param options - Job configuration options
 * @returns Job execution result with statistics
 */
export async function classifyGoodsJob(
  options: ClassifyGoodsJobOptions = {},
): Promise<ClassifyGoodsJobResult> {
  const { batchSize = 1, limit = 1000 } = options;
  const startTime = Date.now();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  console.log("[ClassifyJob] Starting background AI classification job");
  console.log(
    `[ClassifyJob] Configuration: batchSize=${batchSize}, limit=${limit}`,
  );

  try {
    // Ensure database connection
    await connectToDatabase();

    // Query goods with fallback classification
    const unclassifiedGoods = await Goods.find({
      classifiedBy: "fallback",
    })
      .limit(limit)
      .lean(); // Use lean() for better performance (plain JS objects)

    const totalGoods = unclassifiedGoods.length;
    console.log(`[ClassifyJob] Found ${totalGoods} goods to process`);

    if (totalGoods === 0) {
      console.log("[ClassifyJob] No goods to process, exiting");
      const duration = (Date.now() - startTime) / 1000;
      return { processed: 0, succeeded: 0, failed: 0, duration };
    }

    // Process in batches to avoid overwhelming Ollama
    for (let i = 0; i < unclassifiedGoods.length; i += batchSize) {
      const batch = unclassifiedGoods.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(unclassifiedGoods.length / batchSize);

      console.log(
        `[ClassifyJob] Processing batch ${batchNumber}/${totalBatches} (${batch.length} goods)`,
      );

      // Process batch in parallel with error isolation
      const results = await Promise.allSettled(
        batch.map(async (goods) => {
          try {
            // Classify with AI
            const classification = await aiClassifier.classifyGoods(
              goods.rawName,
            );
            const categoryId = await aiClassifier.getOrCreateCategory(
              classification.category,
            );

            // Shorten name with AI
            const shortenResult = await aiNameShortener.shortenName(
              goods.rawName,
            );

            // Update goods record
            await Goods.findByIdAndUpdate(goods._id, {
              category: categoryId,
              shortName: shortenResult.shortName,
              classifiedBy: "deepseek-r1",
              classifiedAt: new Date(),
            });

            succeeded++;
            const preview = goods.rawName.substring(0, 50);
            console.log(
              `[ClassifyJob] ✓ Classified: ${preview}${goods.rawName.length > 50 ? "..." : ""} → ${classification.category}`,
            );
          } catch (error) {
            failed++;
            console.error(
              `[ClassifyJob] ✗ Failed to classify goods ${goods._id}:`,
              error instanceof Error ? error.message : "Unknown error",
            );
            throw error; // Re-throw to be caught by Promise.allSettled
          }
        }),
      );

      processed += batch.length;

      // Log batch results
      const batchSucceeded = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const batchFailed = results.filter((r) => r.status === "rejected").length;
      console.log(
        `[ClassifyJob] Batch ${batchNumber} complete: ${batchSucceeded} succeeded, ${batchFailed} failed`,
      );

      // Rate limiting: pause between batches to avoid overwhelming Ollama
      if (i + batchSize < unclassifiedGoods.length) {
        console.log("[ClassifyJob] Pausing 1s between batches...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(
      `[ClassifyJob] Job completed in ${duration.toFixed(2)}s | ` +
        `Processed: ${processed} | Success: ${succeeded} | Failed: ${failed}`,
    );

    return {
      processed,
      succeeded,
      failed,
      duration: Number.parseFloat(duration.toFixed(2)),
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error("[ClassifyJob] Job failed with error:", error);

    return {
      processed,
      succeeded,
      failed,
      duration: Number.parseFloat(duration.toFixed(2)),
    };
  }
}
