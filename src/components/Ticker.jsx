import { memo, useRef, useState, useEffect } from 'react';
import { formatPrice } from '../utils/math';

const Ticker = memo(({ items, theme }) => {
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const animationRef = useRef(null);
  const dragDistance = useRef(0);

  // Auto-scroll animation
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || isDragging || isHovered) return;

    let scrollPos = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    const animate = () => {
      scrollPos += 0.5; // Scroll speed
      if (scrollPos >= maxScroll / 2) {
        scrollPos = 0; // Reset to start for infinite scroll
      }
      container.scrollLeft = scrollPos;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDragging, isHovered, items]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragDistance.current = 0;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    dragDistance.current += Math.abs(walk);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        overflowX: 'auto',
        borderBottom: `0.5px solid ${theme.border}`,
        background: theme.bg, color: theme.text,
        cursor: isDragging ? 'grabbing' : 'grab',
        WebkitOverflowScrolling: 'touch',
        userSelect: 'none',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      <style>{`
        .ticker-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={{
        display: 'flex',
        gap: 24,
        padding: '8px 16px',
        whiteSpace: 'nowrap',
        minWidth: 'max-content'
      }}>
        {[...Array(4)].map((_, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 24 }}>
            {items.map(item => (
              <a
                key={`${item.key}-${idx}`}
                href={`https://finance.yahoo.com/quote/${item.name}/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (dragDistance.current > 5) e.preventDefault(); }}
                style={{ display: 'flex', gap: 6, fontSize: 12, opacity: 0.8, textDecoration: 'none', color: 'inherit', cursor: isDragging ? 'grabbing' : 'pointer' }}
              >
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <span>${formatPrice(item.price || 0)}</span>
                <span style={{ color: (item.change || 0) >= 0 ? theme.green : theme.red }}>
                  {(item.change || 0) >= 0 ? '▲' : '▼'}{Math.abs(item.change || 0).toFixed(2)}%
                </span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if items actually changed (deep comparison of prices)
  if (prevProps.items.length !== nextProps.items.length) return false;

  for (let i = 0; i < prevProps.items.length; i++) {
    const prev = prevProps.items[i];
    const next = nextProps.items[i];
    if (prev.price !== next.price || prev.change !== next.change) {
      return false; // Props changed, do re-render
    }
  }

  return true; // Props same, skip re-render
});

Ticker.displayName = 'Ticker';

export default Ticker;
