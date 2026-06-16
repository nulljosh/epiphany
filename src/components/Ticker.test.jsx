import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ticker from './Ticker';

const theme = {
  bg: '#000',
  text: '#fff',
  border: '#222',
  green: '#0f0',
  red: '#f00',
};

describe('Ticker', () => {
  let originalRaf;
  let originalCaf;
  let rectSpy;

  beforeEach(() => {
    originalRaf = global.requestAnimationFrame;
    originalCaf = global.cancelAnimationFrame;
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 600,
      bottom: 20,
      width: 600,
      height: 20,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRaf;
    global.cancelAnimationFrame = originalCaf;
    rectSpy?.mockRestore();
  });

  it('advances ticker transform when content overflows', () => {
    let animationStep = null;
    global.requestAnimationFrame = vi.fn((callback) => {
      animationStep = callback;
      return 1;
    });
    global.cancelAnimationFrame = vi.fn();

    const initialItems = [
      { key: 'AAPL', name: 'AAPL', price: 250, change: 0.8 },
      { key: 'MSFT', name: 'MSFT', price: 400, change: 0.3 },
    ];

    const { container, rerender } = render(
      <Ticker
        theme={theme}
        items={initialItems}
      />
    );

    const scroller = container.querySelector('.ticker-container');
    const track = container.querySelector('.ticker-container > div');
    expect(scroller).toBeTruthy();
    expect(track).toBeTruthy();

    rerender(
      <Ticker
        theme={theme}
        items={[
          { key: 'AAPL', name: 'AAPL', price: 251, change: 0.8 },
          { key: 'MSFT', name: 'MSFT', price: 400, change: 0.3 },
        ]}
      />
    );

    const initialTransform = track.style.transform;
    animationStep(1000);
    animationStep(1100);

    expect(track.style.transform).not.toBe(initialTransform);
    expect(track.style.transform).toContain('translate3d(-');
  });
});
