import { useEffect } from "react";

const DEV_SERVICE_WORKER_URL = "/dev-sw.js";
const PRODUCTION_SERVICE_WORKER_URL = "/sw.js";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register(
      import.meta.env.DEV ? DEV_SERVICE_WORKER_URL : PRODUCTION_SERVICE_WORKER_URL,
    );
  }, []);

  return null;
}
