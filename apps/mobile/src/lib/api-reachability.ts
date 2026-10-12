/**
 * Confirmation policy for the global API health banner.
 *
 * A route change can briefly congest the Expo development tunnel while several
 * data reads run. A timed-out health probe alone does not establish an outage.
 * This pure state machine requires repeated failures spanning a real grace
 * period; successes reset the failure history. It never treats an HTTP error
 * from another endpoint as an API health failure.
 */
export const API_PROBE_INTERVAL_MS = 6_000;
export const API_PROBE_TIMEOUT_MS = 5_000;
export const API_FAILURE_THRESHOLD = 3;
export const API_FAILURE_GRACE_MS = 12_000;
export const API_RECOVERY_THRESHOLD = 2;

export type ApiProbeState = {
  reachable: boolean | null;
  failures: number;
  firstFailureAt: number | null;
  recoveries: number;
};

export function initialApiProbeState(): ApiProbeState {
  return {reachable:null,failures:0,firstFailureAt:null,recoveries:0};
}

export function advanceApiProbe(
  previous: ApiProbeState,
  succeeded: boolean,
  now: number,
): {state: ApiProbeState; recovered: boolean} {
  if (succeeded) {
    if (previous.reachable === false) {
      const successes=previous.recoveries+1;
      if (successes < API_RECOVERY_THRESHOLD) {
        return {state:{reachable:false,failures:0,firstFailureAt:null,
          recoveries:successes},recovered:false};
      }
      return {state:{reachable:true,failures:0,firstFailureAt:null,recoveries:0},
        recovered:true};
    }
    return {state:{reachable:true,failures:0,firstFailureAt:null,recoveries:0},
      recovered:false};
  }

  const failures=Math.min(API_FAILURE_THRESHOLD,previous.failures+1);
  const firstFailureAt=previous.firstFailureAt??now;
  const isConfirmed=failures>=API_FAILURE_THRESHOLD &&
    now-firstFailureAt>=API_FAILURE_GRACE_MS;

  // Remain on the last confirmed status until enough evidence of an outage:
  // false is a *confirmed* outage, null is unresolved, true is healthy.
  return {state:{reachable:isConfirmed?false:previous.reachable,
    failures,firstFailureAt,recoveries:0},recovered:false};
}
