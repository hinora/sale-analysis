import { useEffect, useRef } from "react";

/**
 * Job status interface
 */
interface JobStatus {
  running: boolean;
  lastRun?: string;
  lastResult?: {
    processed: number;
    succeeded: number;
    failed: number;
    duration: number;
  };
}

/**
 * Unclassified count response
 */
interface UnclassifiedCountResponse {
  count: number;
}

/**
 * Custom hook for automatic background job triggering
 *
 * Automatically triggers the background AI classification job at regular intervals.
 * Includes smart checks to prevent unnecessary API calls:
 * - Checks if job is already running before triggering
 * - Optionally checks if there are goods to process
 * - Handles errors gracefully without disrupting UI
 *
 * @param intervalMinutes - Interval in minutes between trigger attempts (default: 5)
 * @param checkCount - Whether to check unclassified count before triggering (default: true)
 *
 * @example
 * ```tsx
 * function MyApp({ Component, pageProps }: AppProps) {
 *   // Auto-trigger background job every 5 minutes
 *   useBackgroundJobTrigger(5);
 *
 *   return (
 *     <ThemeProvider theme={theme}>
 *       <Component {...pageProps} />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function useBackgroundJobTrigger(
  intervalMinutes: number = 5,
  checkCount: boolean = true,
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const triggerJob = async () => {
      try {
        // Step 1: Check if job is already running
        const statusResponse = await fetch("/api/jobs/classify-goods");

        if (!statusResponse.ok) {
          console.error(
            "[BackgroundJob] Failed to check job status:",
            statusResponse.status,
          );
          return;
        }

        const status: JobStatus = await statusResponse.json();

        // If already running, skip trigger
        if (status.running) {
          console.log("[BackgroundJob] Job already running, skipping trigger");
          return;
        }

        // Step 2: (Optional) Check if there are goods to process
        if (checkCount) {
          const countResponse = await fetch("/api/goods/unclassified-count");

          if (!countResponse.ok) {
            console.warn(
              "[BackgroundJob] Failed to check unclassified count, proceeding anyway",
            );
          } else {
            const { count }: UnclassifiedCountResponse =
              await countResponse.json();

            if (count === 0) {
              console.log(
                "[BackgroundJob] No unclassified goods, skipping trigger",
              );
              return;
            }

            console.log(
              `[BackgroundJob] Found ${count} unclassified goods, triggering job`,
            );
          }
        }

        // Step 3: Trigger job
        const triggerResponse = await fetch("/api/jobs/classify-goods", {
          method: "POST",
        });

        if (triggerResponse.status === 202) {
          console.log("[BackgroundJob] Job triggered successfully");
        } else if (triggerResponse.status === 409) {
          // Race condition: job was started between our status check and trigger
          console.log(
            "[BackgroundJob] Job already running (race condition detected)",
          );
        } else {
          console.error(
            "[BackgroundJob] Failed to trigger job:",
            triggerResponse.status,
          );
        }
      } catch (error) {
        console.error("[BackgroundJob] Error during job trigger:", error);
        // Don't throw - gracefully handle errors to avoid disrupting UI
      }
    };

    // Trigger immediately on mount
    console.log(
      `[BackgroundJob] Hook initialized with ${intervalMinutes}-minute interval`,
    );
    triggerJob();

    // Set up interval for periodic triggers
    intervalRef.current = setInterval(triggerJob, intervalMinutes * 60 * 1000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log("[BackgroundJob] Hook cleanup - interval cleared");
      }
    };
  }, [intervalMinutes, checkCount]);
}
