import { useEffect, useRef } from 'react';

/**
 * Returns a ref; when `active` becomes truthy, scrolls that element into view
 * so toasts/banners at the top are visible after actions lower on the page.
 */
export default function useScrollIntoViewWhen(active, options = { behavior: 'smooth', block: 'start' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const id = requestAnimationFrame(() => {
      ref.current?.scrollIntoView(options);
    });
    return () => cancelAnimationFrame(id);
    // options is typically a stable literal; active is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return ref;
}
