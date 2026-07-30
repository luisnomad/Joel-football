export const MAX_SIMULATION_FRAME_SECONDS = 0.25;

/**
 * Preserve ordinary frame stalls so simulation time does not become slow
 * motion, while bounding background-tab or debugger gaps.
 */
export const clampSimulationFrameDelta = (
  deltaMilliseconds,
  maximumSeconds = MAX_SIMULATION_FRAME_SECONDS,
) => Math.min(
  Math.max(0, Number(maximumSeconds) || MAX_SIMULATION_FRAME_SECONDS),
  Math.max(0, Number(deltaMilliseconds) || 0) / 1000,
);
