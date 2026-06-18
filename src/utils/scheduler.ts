export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const idle = window.requestIdleCallback as ((callback: IdleRequestCallback, options?: IdleRequestOptions) => number) | undefined;
    if (idle) {
      idle(() => resolve(), { timeout: 80 });
      return;
    }
    window.setTimeout(resolve, 0);
  });
}
