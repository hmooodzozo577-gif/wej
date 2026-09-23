// Guards the decorative flight system against the two regressions users
// actually reported: planes that did not travel their whole route (fades,
// masks, partial keyframe ranges) and planes that did not fly the dashed
// line drawn beside them. Reads the shipped stylesheet source; the browser
// cycle audit in the acceptance report remains the visual proof.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { TravelRouteDecor } from './TravelRouteDecor';
import { FLIGHT_PATHS } from './flightPaths';

const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'styles', 'wejhaty.css'), 'utf8');
const VARIANTS = ['home', 'home-portrait', 'how', 'purpose-header', 'explore-header', 'surprise', 'destination', 'quiz'] as const;

describe('TravelRouteDecor flight system', () => {
  it('drives every plane with the exact path its dashed route draws', () => {
    for (const d of Object.values(FLIGHT_PATHS)) {
      expect(css).toContain(`offset-path: path('${d}')`);
    }
  });

  it('animates each cycle over the full route, 0% to 100%, with no fade or partial range', () => {
    expect(css.replace(/\s+/g, ' ')).toContain('@keyframes route-flight { from { offset-distance: 0%; } to { offset-distance: 100%; } }');
    expect(css).not.toMatch(/@keyframes route-flight-(fade|secondary)/);
    expect(css).not.toMatch(/animation:\s*route-flight-(fade|secondary)/);
    expect(css).not.toMatch(/\.travel-route-band[^{]*\{[^}]*mask-image/);
  });

  it('starts and ends every band route outside its visible box', () => {
    // viewBox sizes per route family — a route must begin and end beyond
    // one of its edges (x < 0, x > width, or y < 0).
    const boxes: Record<string, [number, number]> = {
      homeTop: [1000, 80], homeBottom: [1000, 70], howA: [720, 230], howB: [720, 230], purpose: [720, 230],
      exploreA: [1440, 220], exploreB: [1440, 220], surprise: [600, 160], destination: [1200, 240], quizA: [1200, 90], quizB: [1200, 90],
    };
    for (const [key, d] of Object.entries(FLIGHT_PATHS)) {
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const [w] = boxes[key];
      const outside = (x: number, y: number) => x < 0 || x > w || y < 0;
      expect(outside(nums[0], nums[1]), `${key} start`).toBe(true);
      expect(outside(nums[nums.length - 2], nums[nums.length - 1]), `${key} end`).toBe(true);
    }
  });

  it('never stretches a band plane: only the landscape Home Hero uses a non-uniform viewBox', () => {
    for (const variant of VARIANTS) {
      const { container, unmount } = render(<TravelRouteDecor variant={variant} />);
      for (const svg of container.querySelectorAll('svg')) {
        const ratio = svg.getAttribute('preserveAspectRatio');
        if (variant === 'home') expect(ratio).toBe('none');
        else expect(ratio).toMatch(/ slice$/);
      }
      expect(container.querySelectorAll('.route-plane').length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('gives each context its own composition', () => {
    const count = (variant: (typeof VARIANTS)[number]) => {
      const { container, unmount } = render(<TravelRouteDecor variant={variant} />);
      const n = container.querySelectorAll('.route-plane').length;
      unmount();
      return n;
    };
    expect(count('explore-header')).toBe(2);
    expect(count('surprise')).toBe(1);
    expect(count('quiz')).toBe(2);
    expect(count('destination')).toBe(1);
  });
});
