/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export const keys = <O extends object>(obj: O) =>
  Object.keys(obj) as (keyof O)[]

export const values = <O extends object>(obj: O) =>
  Object.values(obj) as O[keyof O][]

export const entries = <O extends object>(obj: O) =>
  Object.entries(obj) as [keyof O, O[keyof O]][]

export const fromEntries = <O extends object>(
  entries: [keyof O, O[keyof O]][]
) => Object.fromEntries(entries) as O

export const identity = <T>(x: T) => x

export function scrollToPosition(
  container: HTMLElement,
  targetY: number,
  duration: number = 300
): Promise<void> {
  return new Promise((resolve) => {
    const start = container.scrollTop;
    const distance = targetY - start;
    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // easeInOutQuad easing
      const ease =
        progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress;

      container.scrollTop = start + distance * ease;

      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        container.scrollTop = targetY; // snap exactly
        resolve();
      }
    }

    requestAnimationFrame(step);
  });
}
