import { useCallback } from "react";
import { useRevalidator } from "react-router";

let scheduled = false;

export function useCoalescedRevalidation() {
  const revalidator = useRevalidator();

  return useCallback(() => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      revalidator.revalidate();
    });
  }, [revalidator]);
}

export function resetCoalescedRevalidationForTests() {
  scheduled = false;
}
