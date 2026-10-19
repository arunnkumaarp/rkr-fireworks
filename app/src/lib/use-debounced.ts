import { useEffect, useState } from 'react';

/** The value, once it has stopped changing for `ms`. Keeps search boxes from querying on every key. */
export function useDebounced<T>(value: T, ms: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
