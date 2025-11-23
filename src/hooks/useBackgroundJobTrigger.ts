import { useEffect, useRef } from "react";

/**
 * Custom hook for automatic background job triggering
 *
 * NOTE: This hook is deprecated in favor of manual toggle control via Navigation component.
 * The auto-trigger functionality is now controlled by the user via the AppBar toggle switch.
 *
 * @deprecated Use Navigation toggle instead
 */
export function useBackgroundJobTrigger(
  _intervalMinutes: number = 5,
  _checkCount: boolean = true,
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Disabled - job is now controlled via Navigation toggle
    console.log(
      "[BackgroundJob] Auto-trigger hook is disabled. Use Navigation toggle to control job.",
    );

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
