import { useEffect } from "react";

import { useCoalescedRevalidation } from "~/components/events/use-coalesced-revalidation";

export function useBrowserResumeRevalidation() {
  const revalidate = useCoalescedRevalidation();

  useEffect(() => {
    function handleFocus() {
      revalidate();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        revalidate();
      }
    }

    function handlePageShow() {
      revalidate();
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [revalidate]);
}
