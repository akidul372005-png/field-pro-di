import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Debounces rapidly changing values (such as search inputs) by `delayMs`
 * so heavy in-memory filters never block keystrokes on mobile devices.
 */
export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Progressive windowed list renderer:
 * - Renders only the first `pageSize` (default 30) filtered items immediately (<100ms paint)
 * - Auto-appends the next `pageSize` items smoothly via IntersectionObserver
 * - Exposes `loadMore` and `showAll` fallbacks when IntersectionObserver is unavailable
 */
export function useWindowedList<T>(
  items: readonly T[],
  resetKey: string,
  pageSize = 30
) {
  const [visibleCount, setVisibleCount] = useState<number>(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset window cleanly whenever search / filter criteria change
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [resetKey, pageSize]);

  const totalCount = items.length;
  const hasMore = visibleCount < totalCount;
  const remainingCount = Math.max(0, totalCount - visibleCount);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(totalCount, prev + pageSize));
  }, [totalCount, pageSize]);

  const showAll = useCallback(() => {
    setVisibleCount(totalCount);
  }, [totalCount]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(totalCount, prev + pageSize));
        }
      },
      {
        rootMargin: '320px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, totalCount, pageSize]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  return {
    visibleItems,
    visibleCount: visibleItems.length,
    totalCount,
    hasMore,
    remainingCount,
    loadMore,
    showAll,
    sentinelRef,
  };
}
