import { describe, expect, it } from 'vitest';
import { isRippleTargetExcluded, rotationDeltaForPointer } from './homepageInteractions';

describe('homepage interactions', () => {
  it('rotates Desky in the grab direction while preserving the anchored stage', () => {
    expect(rotationDeltaForPointer(20, 10)).toEqual({ yaw: -0.18, pitch: -0.09 });
    expect(rotationDeltaForPointer(-20, -10)).toEqual({ yaw: 0.18, pitch: 0.09 });
  });

  it('blocks ripple creation on interactive or decorative surfaces', () => {
    const target = { closest: (selector: string) => selector.includes('button') ? {} as Element : null };
    expect(isRippleTargetExcluded(target)).toBe(true);

    const background = { closest: () => null };
    expect(isRippleTargetExcluded(background)).toBe(false);
  });
});
