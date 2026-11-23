import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

interface FloatingSideScrollProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  timetableView?: string;
  currentDay?: string;
}

export const FloatingSideScroll: React.FC<FloatingSideScrollProps> = ({
  targetRef,
  timetableView,
  currentDay,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [barStyle, setBarStyle] = useState<{ left: number; width: number }>({ left: 16, width: 300 });

  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const isHoveredRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  // Directly sync thumb position and size via DOM to maintain 60/120fps with zero latency
  const updateThumb = useCallback(() => {
    const container = targetRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!container || !track || !thumb) return;

    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const trackWidth = track.clientWidth;

    if (maxScroll <= 0 || trackWidth <= 0) return;

    const visibleRatio = Math.min(1, clientWidth / scrollWidth);
    const thumbWidth = Math.max(48, Math.min(trackWidth - 8, Math.round(trackWidth * visibleRatio)));
    const maxThumbTravel = trackWidth - thumbWidth;
    const scrollFraction = Math.max(0, Math.min(1, container.scrollLeft / maxScroll));
    const thumbLeft = Math.round(scrollFraction * maxThumbTravel);

    thumb.style.width = `${thumbWidth}px`;
    thumb.style.transform = `translateX(${thumbLeft}px)`;
  }, [targetRef]);

  // Check visibility and dimensions
  const updateMetrics = useCallback(() => {
    const container = targetRef.current;
    if (!container) {
      setHasOverflow(false);
      setIsInViewport(false);
      return;
    }

    const rect = container.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const overflow = container.scrollWidth > container.clientWidth + 4;
    setHasOverflow(overflow);

    // Visible when top of container is above viewport bottom, and bottom of container is below viewport top
    const inViewport = rect.top < windowHeight - 40 && rect.bottom > 80;
    setIsInViewport(inViewport);

    const left = Math.max(16, rect.left + 16);
    const right = Math.min(windowWidth - 16, rect.right - 16);
    const width = Math.max(220, right - left);

    setBarStyle({ left, width });
    updateThumb();
  }, [targetRef, updateThumb]);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (!isHoveredRef.current && !isDraggingRef.current) {
        setIsVisible(false);
      }
    }, 2000);
  }, []);

  const triggerActivity = useCallback(() => {
    setIsVisible(true);
    updateMetrics();
    scheduleHide();
  }, [scheduleHide, updateMetrics]);

  // Setup listeners on window
  useEffect(() => {
    updateMetrics();

    const handleWindowScroll = () => {
      triggerActivity();
    };

    const handleWindowResize = () => {
      updateMetrics();
      triggerActivity();
    };

    // Auto-reveal if cursor is moved near bottom of screen (within bottom 80px) over timetable
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight - 80) {
        const container = targetRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && rect.bottom > 80 && rect.top < window.innerHeight) {
            triggerActivity();
          }
        }
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowResize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [updateMetrics, triggerActivity, targetRef]);

  // Bind to container scroll and resize observer
  useEffect(() => {
    const container = targetRef.current;
    if (!container) return;

    updateMetrics();

    const handleContainerScroll = () => {
      updateThumb();
      triggerActivity();
    };

    const handleWheel = () => {
      triggerActivity();
    };

    const handleTouchMove = () => {
      triggerActivity();
    };

    container.addEventListener('scroll', handleContainerScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    try {
      resizeObserver = new ResizeObserver(() => {
        updateMetrics();
      });
      resizeObserver.observe(container);
    } catch {
      // Ignore if ResizeObserver not supported
    }

    return () => {
      container.removeEventListener('scroll', handleContainerScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [targetRef, timetableView, currentDay, updateMetrics, updateThumb, triggerActivity]);

  // Thumb Pointer Events for Dragging using window-level tracking
  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const container = targetRef.current;
    if (!container) return;

    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = container.scrollLeft;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const targetContainer = targetRef.current;
      const track = trackRef.current;
      if (!targetContainer || !track) return;

      const deltaX = ev.clientX - dragStartXRef.current;
      const trackWidth = track.clientWidth;
      const visibleRatio = Math.min(1, targetContainer.clientWidth / targetContainer.scrollWidth);
      const thumbWidth = Math.max(48, Math.min(trackWidth - 8, Math.round(trackWidth * visibleRatio)));
      const maxThumbTravel = trackWidth - thumbWidth;
      const maxScroll = targetContainer.scrollWidth - targetContainer.clientWidth;

      if (maxThumbTravel > 0 && maxScroll > 0) {
        const deltaScroll = (deltaX / maxThumbTravel) * maxScroll;
        targetContainer.scrollLeft = dragStartScrollLeftRef.current + deltaScroll;
        updateThumb();
      }
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      scheduleHide();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    setIsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
  };

  // Track click to jump
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (thumbRef.current && thumbRef.current.contains(e.target as Node)) {
      return;
    }
    const container = targetRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const trackRect = track.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const trackWidth = trackRect.width;
    const visibleRatio = Math.min(1, container.clientWidth / container.scrollWidth);
    const thumbWidth = Math.max(48, Math.min(trackWidth - 8, Math.round(trackWidth * visibleRatio)));
    const maxThumbTravel = trackWidth - thumbWidth;
    const maxScroll = container.scrollWidth - container.clientWidth;

    const targetThumbLeft = clickX - thumbWidth / 2;
    const fraction = Math.max(0, Math.min(1, targetThumbLeft / maxThumbTravel));

    container.scrollTo({
      left: Math.round(fraction * maxScroll),
      behavior: 'smooth',
    });

    triggerActivity();
  };

  // Step buttons
  const handleScrollLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = targetRef.current;
    if (!container) return;
    container.scrollBy({ left: -220, behavior: 'smooth' });
    triggerActivity();
  };

  const handleScrollRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = targetRef.current;
    if (!container) return;
    container.scrollBy({ left: 220, behavior: 'smooth' });
    triggerActivity();
  };

  // Wheel over bar
  const handleBarWheel = (e: React.WheelEvent) => {
    const container = targetRef.current;
    if (!container) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    container.scrollLeft += delta;
    updateThumb();
    triggerActivity();
  };

  if (!hasOverflow || !isInViewport) {
    return null;
  }

  const shouldBeVisible = isVisible;

  return (
    <div
      style={{
        left: `${barStyle.left}px`,
        width: `${barStyle.width}px`,
      }}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        setIsVisible(true);
        if (hideTimerRef.current) {
          window.clearTimeout(hideTimerRef.current);
        }
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        scheduleHide();
      }}
      onWheel={handleBarWheel}
      className={`fixed bottom-4 z-40 flex items-center justify-center transition-all duration-300 ease-out no-print select-none ${
        shouldBeVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <div className="w-full max-w-4xl bg-[#1C2333]/92 text-white backdrop-blur-md px-3 sm:px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] border border-[#334155] flex items-center gap-2 sm:gap-3 ring-1 ring-white/10">
        {/* Label */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 shrink-0 select-none">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>Timetable Scroll</span>
        </div>

        {/* Left Button */}
        <button
          type="button"
          onClick={handleScrollLeft}
          className="w-6 h-6 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/15 active:bg-white/25 transition-colors shrink-0 cursor-pointer"
          title="Scroll Left"
          aria-label="Scroll timetable left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="flex-1 h-3.5 bg-slate-700/80 hover:bg-slate-700 rounded-full relative cursor-pointer overflow-hidden transition-colors border border-slate-600/40"
          title="Click to jump or drag thumb to side scroll"
        >
          {/* Thumb */}
          <div
            ref={thumbRef}
            onPointerDown={handleThumbPointerDown}
            className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-[#2F6F4E] via-[#2A6FA8] to-[#3B82F6] hover:brightness-110 active:brightness-125 cursor-grab active:cursor-grabbing shadow-sm flex items-center justify-center transition-[background-color,filter] will-change-transform"
          >
            <div className="w-3.5 h-1 rounded-full bg-white/80 pointer-events-none" />
          </div>
        </div>

        {/* Right Button */}
        <button
          type="button"
          onClick={handleScrollRight}
          className="w-6 h-6 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/15 active:bg-white/25 transition-colors shrink-0 cursor-pointer"
          title="Scroll Right"
          aria-label="Scroll timetable right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
