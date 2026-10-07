export const RIPPLE_EXCLUDED_TARGETS = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  '[role="button"]',
  '[role="tab"]',
  '[data-ripple]',
  '.desky-stage',
  '.desky-sound-toggle',
  '.workspace-card',
  '.sample-prompt-card',
  '.feature-card',
  '.resource-card',
  '.tool-card',
  '.footer-contact-links',
].join(', ');

export function rotationDeltaForPointer(deltaX: number, deltaY: number, sensitivity = 0.009) {
  return {
    yaw: -deltaX * sensitivity,
    pitch: -deltaY * sensitivity,
  };
}

export function isRippleTargetExcluded(target: { closest: (selector: string) => unknown }): boolean {
  return Boolean(target.closest(RIPPLE_EXCLUDED_TARGETS));
}
