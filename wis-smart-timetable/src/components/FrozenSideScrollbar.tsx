import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FrozenSideScrollbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export const FrozenSideScrollbar: React.FC<FrozenSideScrollbarProps> = ({
  containerRef,
  className = '',
}) => {
  const [scrollInfo, setScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    hasOverflow: false,
    rect: { left: 0, width: 0, top: 0, bottom: 0 },
    isInViewport: false,
  });

  const [trackWidth, setTrackWidth] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const isHoveredRef = useRef(false);
  const dragStartRef = useRef<{
    startX: number;
    startScrollLeft: number;
    trackWidth: number;
    thumbWidth: number;
    maxScrollLeft: number;
  } | null>(null);

  isDraggingRef.current = isDragging;
  isHoveredRef.current = isHovered;

  // Show the scrollbar and schedule auto-hide after 1.5s idle
  const wakeUpAndShow = useCallback(() => {
    setIsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current && !isHoveredRef.current) {
        setIsVisible(false);
      }
    }, 1500);
  }, []);

  // Update layout and scroll metrics
  const updateMetrics = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    const hasOverflow = scrollWidth > clientWidth + 2;

    // Is the table container intersecting the visible viewport?
    const isInViewport = rect.top < window.innerHeight - 30 && rect.bottom > 60;

    setScrollInfo({
      scrollLeft,
      scrollWidth,
      clientWidth,
      hasOverflow,
      rect: {
        left: rect.left,
        width: rect.width,
        top: rect.top,
        bottom: rect.bottom,
      },
      isInViewport,
    });
  }, [containerRef]);

  // Track the actual pixel width of the track element
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateTrackWidth = () => {
      if (track) {
        setTrackWidth(track.clientWidth);
      }
    };

    updateTrackWidth();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateTrackWidth);
      ro.observe(track);
    }

    return () => {
      if (ro) ro.disconnect();
    };
  }, [scrollInfo.isInViewport, scrollInfo.hasOverflow]);

  // Handle window vertical scrolling & resizing
  useEffect(() => {
    const handleWindowScroll = () => {
      updateMetrics();
      // If table is in view when scrolling page up/down, show the frozen scrollbar
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 30 && rect.bottom > 60) {
        wakeUpAndShow();
      }
    };

    const handleWindowResize = () => {
      updateMetrics();
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [containerRef, updateMetrics, wakeUpAndShow]);

  // Handle table horizontal scrolling & interactions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTableScroll = () => {
      updateMetrics();
      wakeUpAndShow();
    };

    const handleTableMouseMove = () => {
      wakeUpAndShow();
    };

    const handleTableTouch = () => {
      wakeUpAndShow();
    };

    const handleTableWheel = () => {
      wakeUpAndShow();
    };

    el.addEventListener('scroll', handleTableScroll, { passive: true });
    el.addEventListener('mousemove', handleTableMouseMove, { passive: true });
    el.addEventListener('touchstart', handleTableTouch, { passive: true });
    el.addEventListener('wheel', handleTableWheel, { passive: true });

    // Observe size changes of the container
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateMetrics();
      });
      ro.observe(el);
    }

    // Initial measurement
    updateMetrics();

    return () => {
      el.removeEventListener('scroll', handleTableScroll);
      el.removeEventListener('mousemove', handleTableMouseMove);
      el.removeEventListener('touchstart', handleTableTouch);
      el.removeEventListener('wheel', handleTableWheel);
      if (ro) ro.disconnect();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [containerRef, updateMetrics, wakeUpAndShow]);

  // If there's no horizontal overflow or table is not in viewport, don't show
  if (!scrollInfo.hasOverflow || !scrollInfo.isInViewport) {
    return null;
  }

  const { scrollLeft, scrollWidth, clientWidth, rect } = scrollInfo;
  const maxScrollLeft = Math.max(1, scrollWidth - clientWidth);
  const scrollRatio = Math.max(0, Math.min(1, scrollLeft / maxScrollLeft));

  // Determine dynamic thumb width and position
  const effectiveTrackWidth = trackWidth > 0 ? trackWidth : Math.max(100, rect.width - 120);
  const calculatedThumbWidth = Math.max(
    44,
    Math.min(effectiveTrackWidth - 10, (clientWidth / scrollWidth) * effectiveTrackWidth)
  );
  const availableTrackSpace = Math.max(0, effectiveTrackWidth - calculatedThumbWidth);
  const thumbLeft = availableTrackSpace * scrollRatio;

  // Calculate vertical frozen position:
  // When the bottom of the timetable is below the viewport (rect.bottom > window.innerHeight):
  // Freeze at the bottom of the screen (12px from viewport bottom).
  // When the user reaches the bottom of the timetable (rect.bottom <= window.innerHeight):
  // Float right at the bottom border of the timetable table so it stays naturally docked.
  const bottomOffset = Math.max(12, window.innerHeight - rect.bottom + 8);

  // Position and clamp within viewport & table bounds
  const horizontalPadding = 12;
  const rawWidth = Math.max(160, rect.width - horizontalPadding * 2);
  const maxViewportWidth = window.innerWidth - 24;
  const clampedWidth = Math.min(rawWidth, maxViewportWidth);
  const rawLeft = rect.left + horizontalPadding;
  const clampedLeft = Math.max(12, Math.min(rawLeft, window.innerWidth - clampedWidth - 12));

  // Drag handlers
  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container || !trackRef.current) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startScrollLeft: container.scrollLeft,
      trackWidth: effectiveTrackWidth,
      thumbWidth: calculatedThumbWidth,
      maxScrollLeft,
    };
    setIsDragging(true);
    setIsVisible(true);
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const { startX, startScrollLeft, trackWidth: tWidth, thumbWidth: tThumbWidth, maxScrollLeft: maxScroll } = dragStartRef.current;
    const trackSpace = tWidth - tThumbWidth;
    if (trackSpace <= 0) return;

    const deltaX = e.clientX - startX;
    const scrollDelta = (deltaX / trackSpace) * maxScroll;
    container.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + scrollDelta));
  };

  const handleThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      isDraggingRef.current = false;
      dragStartRef.current = null;
      setIsDragging(false);
      wakeUpAndShow();
    }
  };

  // Click on track outside thumb to jump/step
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current) return;
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const trackRect = track.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const trackSpace = track.clientWidth - calculatedThumbWidth;
    if (trackSpace <= 0) return;

    const targetRatio = Math.max(0, Math.min(1, (clickX - calculatedThumbWidth / 2) / trackSpace));
    container.scrollTo({
      left: targetRatio * maxScrollLeft,
      behavior: 'smooth',
    });
    wakeUpAndShow();
  };

  // Step scroll buttons
  const handleStepScroll = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;
    const step = Math.max(180, clientWidth * 0.35);
    container.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
    wakeUpAndShow();
  };

  // Wheel over the scrollbar translates directly to horizontal scroll
  const handleWheel = (e: React.WheelEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    container.scrollLeft += delta;
    wakeUpAndShow();
  };

  const shouldShow = isVisible || isDragging || isHovered;

  return (
    <div
      role="region"
      aria-label="Timetable side scroll"
      className={`fixed z-35 no-print select-none transition-all duration-300 ease-out ${
        shouldShow ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
      } ${className}`}
      style={{
        left: `${clampedLeft}px`,
        width: `${clampedWidth}px`,
        bottom: `${bottomOffset}px`,
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        setIsVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        wakeUpAndShow();
      }}
      onWheel={handleWheel}
    >
      <div className="bg-white/95 backdrop-blur-md border border-[#94A3B8]/70 shadow-[0_6px_20px_rgba(15,23,42,0.18)] rounded-full px-2 py-1.5 flex items-center gap-2">
        {/* Step Left Button */}
        <button
          type="button"
          onClick={() => handleStepScroll('left')}
          disabled={scrollLeft <= 0}
          aria-label="Scroll timetable left"
          title="Scroll timetable left"
          className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[#475569] hover:text-[#0F172A] hover:bg-slate-200/80 active:bg-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative flex-1 h-3 bg-slate-200/90 hover:bg-slate-300/80 rounded-full cursor-pointer transition-colors overflow-hidden group/track"
          title="Click or drag to scroll timetable sideways"
        >
          {/* Thumb */}
          <div
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
            className={`absolute top-0.5 bottom-0.5 rounded-full bg-[#2F6F4E] hover:bg-[#23563D] active:bg-[#1B432F] cursor-grab active:cursor-grabbing transition-colors shadow-xs flex items-center justify-center ${
              isDragging ? 'ring-2 ring-[#2F6F4E]/40' : ''
            }`}
            style={{
              left: `${thumbLeft}px`,
              width: `${calculatedThumbWidth}px`,
            }}
          >
            {/* Subtle grip indicators on the thumb */}
            <div className="flex items-center gap-0.5 opacity-60 pointer-events-none">
              <span className="w-0.5 h-1.5 bg-white rounded-full inline-block" />
              <span className="w-0.5 h-1.5 bg-white rounded-full inline-block" />
              <span className="w-0.5 h-1.5 bg-white rounded-full inline-block" />
            </div>
          </div>
        </div>

        {/* Step Right Button */}
        <button
          type="button"
          onClick={() => handleStepScroll('right')}
          disabled={scrollLeft >= maxScrollLeft - 1}
          aria-label="Scroll timetable right"
          title="Scroll timetable right"
          className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[#475569] hover:text-[#0F172A] hover:bg-slate-200/80 active:bg-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
