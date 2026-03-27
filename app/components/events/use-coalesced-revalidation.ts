import { useCallback, useRef } from "react";
import { useRevalidator } from "react-router";

let scheduled = false;

export function useCoalescedRevalidation() {
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);

  revalidatorRef.current = revalidator;

  return useCallback(() => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      revalidatorRef.current.revalidate();
    });
  }, []);
}

export function resetCoalescedRevalidationForTests() {
  scheduled = false;
}
