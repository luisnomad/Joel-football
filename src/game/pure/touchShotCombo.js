export const TOUCH_CHILENA_COMBO_WINDOW_MS = 480;
export const TOUCH_CHILENA_COMBO_MIN_INTERVAL_MS = 45;

export const createTouchShotComboState = () => ({
  lastAction: null,
  lastTapAt: null,
  pendingAction: null,
  lastIntervalMs: null,
});

export const registerTouchShotTap = (
  state = createTouchShotComboState(),
  {
    action,
    at,
  } = {},
) => {
  const safeAction = action === 'lob' ? 'lob' : action === 'kick' ? 'kick' : null;
  const safeAt = Number(at);
  if (!safeAction || !Number.isFinite(safeAt)) return { ...state };
  const interval = state.lastAction === safeAction && Number.isFinite(state.lastTapAt)
    ? safeAt - state.lastTapAt
    : null;
  const combo = interval !== null
    && interval >= TOUCH_CHILENA_COMBO_MIN_INTERVAL_MS
    && interval <= TOUCH_CHILENA_COMBO_WINDOW_MS;
  return {
    lastAction: combo ? null : safeAction,
    lastTapAt: combo ? null : safeAt,
    pendingAction: combo ? safeAction : null,
    lastIntervalMs: interval,
  };
};

export const consumeTouchShotCombo = (state = createTouchShotComboState()) => ({
  action: state.pendingAction,
  state: {
    ...state,
    pendingAction: null,
  },
});
