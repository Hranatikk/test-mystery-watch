import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Rendering is allowed only when the owner says the view is relevant
 * (visible card, focused screen) AND the app is in the foreground.
 */
export function useRenderGate(active: boolean): boolean {
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  return active && appActive;
}
