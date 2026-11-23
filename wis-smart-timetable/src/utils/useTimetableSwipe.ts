import React, { useRef, useCallback, useEffect } from 'react';

interface UseTimetableSwipeOptions {
  onScrollSync?: (scrollLeft: number) => void;
  getSyncTargets?: () => (HTMLElement | null)[];
}

/**
 * Ultra-smooth, 60/120fps swipe and drag-to-scroll hook for the timetable grid.
 * Handles mouse grab-to-pan, touch momentum gliding, and cancels accidental clicks
 * when swiping across cells.
 */
export function useTimetableSwipe(options: UseTimetableSwipeOptions = {}) {
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const activeContainerRef = useRef<HTMLElement | null>(null);
  const preventClickRef = useRef(false);
  const rafMomentumRef = useRef<number | null>(null);
  const velocitySamplesRef = useRef<{ time: number; x: number }[]>([]);

  // Cancel any active momentum animation
  const stopMomentum = useCallback(() => {
    if (rafMomentumRef.current != null) {
      cancelAnimationFrame(rafMomentumRef.current);
      rafMomentumRef.current = null;
    }
  }, []);

  // Sync scrollLeft across all registered timetable containers
  const syncAll = useCallback(
    (sourceEl: HTMLElement, newScrollLeft: number) => {
      sourceEl.scrollLeft = newScrollLeft;
      const targets = options.getSyncTargets ? options.getSyncTargets() : [];
      targets.forEach((target) => {
        if (target && target !== sourceEl && Math.abs(target.scrollLeft - newScrollLeft) > 0.5) {
          target.scrollLeft = newScrollLeft;
        }
      });
      if (options.onScrollSync) {
        options.onScrollSync(newScrollLeft);
      }
    },
    [options]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Only handle primary mouse click or touch
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      // Do not initiate drag from text inputs or buttons that need direct text focus
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return;
      }

      stopMomentum();

      const container = e.currentTarget;
      activeContainerRef.current = container;
      isPointerDownRef.current = true;
      isDraggingRef.current = false;
      preventClickRef.current = false;

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      startScrollLeftRef.current = container.scrollLeft;
      velocitySamplesRef.current = [{ time: performance.now(), x: e.clientX }];
    },
    [stopMomentum]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current) return;
      const container = activeContainerRef.current;
      if (!container) return;

      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;

      // Check if threshold reached to begin horizontal pan
      if (!isDraggingRef.current) {
        if (Math.abs(deltaX) > 5 && Math.abs(deltaX) > Math.abs(deltaY)) {
          isDraggingRef.current = true;
          preventClickRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // pointer capture not supported on some elements
          }
          container.style.cursor = 'grabbing';
          container.style.userSelect = 'none';
        } else if (Math.abs(deltaY) > 8) {
          // Primarily vertical scroll: release gesture so native page scroll works smoothly
          isPointerDownRef.current = false;
          return;
        }
      }

      if (isDraggingRef.current) {
        const nextScrollLeft = startScrollLeftRef.current - deltaX;
        syncAll(container, nextScrollLeft);

        // Track velocity
        const now = performance.now();
        velocitySamplesRef.current.push({ time: now, x: e.clientX });
        // Keep samples from the last 120ms
        velocitySamplesRef.current = velocitySamplesRef.current.filter((s) => now - s.time < 120);
      }
    },
    [syncAll]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      const container = activeContainerRef.current;
      if (container) {
        container.style.cursor = '';
        container.style.userSelect = '';
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // ignore
        }
      }

      if (isDraggingRef.current && container) {
        // Calculate release velocity for natural momentum / inertia gliding
        const samples = velocitySamplesRef.current;
        if (samples.length >= 2) {
          const first = samples[0];
          const last = samples[samples.length - 1];
          const dt = last.time - first.time;
          if (dt > 10) {
            const vx = (last.x - first.x) / dt; // pixels per ms
            if (Math.abs(vx) > 0.15) {
              // Apply smooth momentum
              let velocity = vx * 16; // approximate frame step
              const stepGlide = () => {
                if (Math.abs(velocity) < 0.25 || !container) {
                  stopMomentum();
                  return;
                }
                const nextLeft = container.scrollLeft - velocity;
                syncAll(container, nextLeft);
                velocity *= 0.925; // smooth deceleration curve
                rafMomentumRef.current = requestAnimationFrame(stepGlide);
              };
              rafMomentumRef.current = requestAnimationFrame(stepGlide);
            }
          }
        }

        // Keep preventClick true for a brief instant so that onClick handlers on child cells don't fire
        setTimeout(() => {
          preventClickRef.current = false;
          isDraggingRef.current = false;
        }, 120);
      } else {
        isDraggingRef.current = false;
        preventClickRef.current = false;
      }

      activeContainerRef.current = null;
    },
    [stopMomentum, syncAll]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      onPointerUp(e);
    },
    [onPointerUp]
  );

  // Capture click events during or immediately after a drag to prevent accidental modals
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (preventClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMomentum();
    };
  }, [stopMomentum]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
    stopMomentum,
  };
}
