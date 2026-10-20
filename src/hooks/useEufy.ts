import { useEffect } from 'react';
import { runEufy, subscribeEufy, useEufySession } from '../services/eufy/session';
export function useEufy(enabled = true, intervalMs = 5000) {
  const state = useEufySession();
  useEffect(() => enabled ? subscribeEufy(intervalMs) : undefined, [enabled, intervalMs]);
  return { ...state, run: runEufy };
}
