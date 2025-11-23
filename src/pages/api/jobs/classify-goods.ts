import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import {
  classifyGoodsJob,
  type ClassifyGoodsJobResult,
} from "@/lib/jobs/classify-goods";

/**
 * Job status interface
 */
interface JobStatus {
  running: boolean;
  lastRun?: Date;
  lastResult?: ClassifyGoodsJobResult;
}

/**
 * API response interfaces
 */
interface JobStatusResponse extends JobStatus {}

interface JobTriggerResponse {
  message: string;
  status: "running";
}

interface ErrorResponse {
  error: string;
  message?: string;
}

// In-memory job state (simple MVP approach)
let jobRunning = false;
let lastResult: ClassifyGoodsJobResult | null = null;
let lastRunDate: Date | null = null;
// Flag to signal job cancellation (exported for use in classify-goods job)
export let shouldStopJob = false;

export function setShouldStopJob(value: boolean) {
  shouldStopJob = value;
}

/**
 * GET /api/jobs/classify-goods - Check job status
 * POST /api/jobs/classify-goods - Trigger job execution
 * DELETE /api/jobs/classify-goods - Stop running job
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobStatusResponse | JobTriggerResponse | ErrorResponse>,
) {
  // GET - Return job status
  if (req.method === "GET") {
    try {
      const status: JobStatusResponse = {
        running: jobRunning,
        lastRun: lastRunDate || undefined,
        lastResult: lastResult || undefined,
      };

      return res.status(200).json(status);
    } catch (error) {
      console.error("[API] Failed to get job status:", error);
      return res.status(500).json({
        error: "Failed to retrieve job status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // POST - Trigger job execution
  if (req.method === "POST") {
    // Check if job already running
    if (jobRunning) {
      console.log("[API] Job already running, returning 409 Conflict");
      return res.status(409).json({
        error: "Job already running",
      });
    }

    try {
      await connectToDatabase();

      // Mark job as running
      jobRunning = true;
      setShouldStopJob(false); // Reset stop flag
      console.log("[API] Background classification job triggered");

      // Run job asynchronously (don't await - return 202 immediately)
      classifyGoodsJob({ batchSize: 1, limit: 1000 })
        .then((result) => {
          lastResult = result;
          lastRunDate = new Date();
          console.log("[API] Job completed successfully:", result);
        })
        .catch((error) => {
          console.error("[API] Job failed:", error);
          // Keep last result even on failure for debugging
          lastRunDate = new Date();
        })
        .finally(() => {
          jobRunning = false;
          setShouldStopJob(false);
          console.log("[API] Job status reset to idle");
        });

      // Return 202 Accepted immediately
      return res.status(202).json({
        message: "Background classification job started",
        status: "running",
      });
    } catch (error) {
      jobRunning = false;
      setShouldStopJob(false);
      console.error("[API] Failed to start job:", error);
      return res.status(500).json({
        error: "Failed to start job",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // DELETE - Stop running job
  if (req.method === "DELETE") {
    if (!jobRunning) {
      return res.status(200).json({
        running: false,
        lastRun: lastRunDate || undefined,
        lastResult: lastResult || undefined,
      });
    }

    try {
      setShouldStopJob(true);
      console.log("[API] Job stop requested");

      return res.status(200).json({
        running: true,
        lastRun: lastRunDate || undefined,
        lastResult: lastResult || undefined,
      });
    } catch (error) {
      console.error("[API] Failed to stop job:", error);
      return res.status(500).json({
        error: "Failed to stop job",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    error: "Method not allowed",
  });
}
