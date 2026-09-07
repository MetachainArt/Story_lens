import { useCallback, useEffect, useRef } from 'react';

/** One active generation observer per mounted page, including StrictMode replay. */
export function useGenerationScope() {
  const controllerRef = useRef<AbortController | null>(null);
  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  const begin = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);
  useEffect(() => cancel, [cancel]);
  return { begin, cancel };
}

/** Clear the pending timeout as soon as the page stops observing this job. */
export function waitForGenerationPoll(delay: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
