import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatPrice } from '../utils/math';

const SPEED_PX_PER_SEC = 96;

function normalizeOffset(offset, segmentWidth) {
  if (!segmentWidth) return 0;
  let next = offset % segmentWidth;
  if (next > 0) next -= segmentWidth;
  return next;
}

const Ticker = memo(({ items, theme, onItemClick }) => {
  const trackRef = useRef(null);
  const segmentRef = useRef(null);
  const animationRef = useRef(null);
  const offsetRef = useRef(0);
  const lastFrameRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const segmentWidthRef = useRef(0);
  const velocityRef = useRef(0);
  const lastPointerXRef = useRef(0);
  const lastPointerTimeRef = useRef(0);
  const momentumRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [segmentVersion, setSegmentVersion] = useState(0);

  const applyOffset = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    }
  }, []);

  useLayoutEffect(() => {
    if (!segmentRef.current) return undefined;

    const updateWidth = () => {
      const nextWidth = Math.round(segmentRef.current?.getBoundingClientRect().width || 0);
      if (!nextWidth) return;
      segmentWidthRef.current = nextWidth;
      offsetRef.current = normalizeOffset(offsetRef.current, nextWidth);
      applyOffset();
      setSegmentVersion((v) => v + 1);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'function') return undefined;

    const observer = new ResizeObserver(updateWidth);
    observer.observe(segmentRef.current);
    return () => observer.disconnect();
  }, [items, applyOffset]);

  useEffect(() => {
    if (isDragging || items.length === 0 || !segmentWidthRef.current) return undefined;

    const animate = (now) => {
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const deltaMs = now - lastFrameRef.current;
      lastFrameRef.current = now;

      offsetRef.current = normalizeOffset(
        offsetRef.current - ((deltaMs / 1000) * SPEED_PX_PER_SEC),
        segmentWidthRef.current
      );
      applyOffset();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      lastFrameRef.current = 0;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [applyOffset, isDragging, items, segmentVersion]);

  const startMomentum = useCallback(() => {
    if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
    let vel = velocityRef.current;
    const friction = 0.95;
    const tick = () => {
      vel *= friction;
      if (Math.abs(vel) < 0.5) {
        setIsDragging(false);
        return;
      }
      offsetRef.current = normalizeOffset(offsetRef.current + vel, segmentWidthRef.current);
      applyOffset();
      momentumRef.current = requestAnimationFrame(tick);
    };
    momentumRef.current = requestAnimationFrame(tick);
  }, [applyOffset]);

  const handlePointerDown = (e) => {
    if (!items.length) return;
    if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
    dragDistanceRef.current = 0;
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    lastPointerXRef.current = e.clientX;
    lastPointerTimeRef.current = performance.now();
    velocityRef.current = 0;
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !segmentWidthRef.current) return;
    const delta = e.clientX - dragStartXRef.current;
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(delta));
    offsetRef.current = normalizeOffset(dragStartOffsetRef.current + delta, segmentWidthRef.current);
    applyOffset();
    // Track velocity for momentum
    const now = performance.now();
    const dt = now - lastPointerTimeRef.current;
    if (dt > 0) {
      velocityRef.current = (e.clientX - lastPointerXRef.current) / Math.max(dt, 1) * 16; // px per frame
    }
    lastPointerXRef.current = e.clientX;
    lastPointerTimeRef.current = now;
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (Math.abs(velocityRef.current) > 1) {
      startMomentum();
    } else {
      setIsDragging(false);
    }
  };

  const renderItem = (item, idx, clone = 0) => (
    <button
      type="button"
      key={`${item.key}-${clone}-${idx}`}
      onClick={(e) => {
        const threshold = e.pointerType === 'touch' ? 12 : 10;
        if (dragDistanceRef.current > threshold) { e.preventDefault(); return; }
        if (onItemClick) onItemClick(item.name);
      }}
      style={{
        display: 'flex',
        gap: 6,
        fontSize: 12,
        opacity: 0.82,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'inherit',
        flex: '0 0 auto',
        font: 'inherit',
      }}
    >
      <span style={{ fontWeight: 600 }}>{item.name}</span>
      <span>${formatPrice(item.price || 0)}</span>
      <span style={{ color: (item.change || 0) >= 0 ? theme.green : theme.red }}>
        {(item.change || 0) >= 0 ? '\u25B2' : '\u25BC'}{Math.abs(item.change || 0).toFixed(2)}%
      </span>
      {Math.abs(item.change || 0) >= 5 && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: '#f59e0b',
          border: '1px solid rgba(245,158,11,0.3)',
          animation: 'pulse-amber-tick 1.8s infinite',
          display: 'inline-block', marginLeft: 2, verticalAlign: 'middle',
        }} />
      )}
    </button>
  );

  return (
    <div
      className="ticker-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setIsDragging(false)}
      onPointerLeave={() => setIsDragging(false)}
      style={{
        overflow: 'hidden',
        borderBottom: `0.5px solid ${theme.border}`,
        background: theme.bg,
        color: theme.text,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        width: '100%',
        maxWidth: '100%',
        touchAction: 'pan-x',
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          width: 'max-content',
          willChange: 'transform',
        }}
      >
        <div
          ref={segmentRef}
          style={{
            display: 'flex',
            gap: 24,
            padding: '8px 16px',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          {items.map((item, idx) => renderItem(item, idx))}
        </div>
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            gap: 24,
            padding: '8px 16px',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          {items.map((item, idx) => renderItem(item, idx, 1))}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.items.length !== nextProps.items.length) return false;

  for (let i = 0; i < prevProps.items.length; i++) {
    const prev = prevProps.items[i];
    const next = nextProps.items[i];
    if (prev.key !== next.key || prev.price !== next.price || prev.change !== next.change) {
      return false;
    }
  }

  return true;
});

Ticker.displayName = 'Ticker';

export default Ticker;
