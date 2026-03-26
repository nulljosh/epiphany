import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatPrice } from '../utils/math';

const SPEED_PX_PER_SEC = 96;

function normalizeOffset(offset, segmentWidth) {
  if (!segmentWidth) return 0;
  let next = offset % segmentWidth;
  if (next > 0) next -= segmentWidth;
  return next;
}

const Ticker = memo(({ items, theme }) => {
  const trackRef = useRef(null);
  const segmentRef = useRef(null);
  const animationRef = useRef(null);
  const offsetRef = useRef(0);
  const lastFrameRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const segmentWidthRef = useRef(0);
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

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePointerDown = (e) => {
    if (!items.length) return;
    dragDistanceRef.current = 0;
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !segmentWidthRef.current) return;
    const delta = e.clientX - dragStartXRef.current;
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(delta));
    offsetRef.current = normalizeOffset(dragStartOffsetRef.current + delta, segmentWidthRef.current);
    applyOffset();
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    stopDragging();
  };

  const renderItem = (item, idx, clone = 0) => (
    <a
      key={`${item.key}-${clone}-${idx}`}
      href={`https://finance.yahoo.com/quote/${item.name}/`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (dragDistanceRef.current > 5) e.preventDefault();
      }}
      style={{
        display: 'flex',
        gap: 6,
        fontSize: 12,
        opacity: 0.82,
        textDecoration: 'none',
        color: 'inherit',
        flex: '0 0 auto',
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
          boxShadow: '0 0 0 0 rgba(245,158,11,0.5)',
          animation: 'pulse-amber-tick 1.8s infinite',
          display: 'inline-block', marginLeft: 2, verticalAlign: 'middle',
        }} />
      )}
    </a>
  );

  return (
    <>
    <style>{`@keyframes pulse-amber-tick { 0%{box-shadow:0 0 0 0 rgba(245,158,11,.5)} 70%{box-shadow:0 0 0 6px rgba(245,158,11,0)} 100%{box-shadow:0 0 0 0 rgba(245,158,11,0)} }`}</style>
    <div
      className="ticker-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
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
    </>
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
