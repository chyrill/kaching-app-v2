// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { env } from "~/env";

// Only initialize Sentry if DSN is provided (optional for local dev)
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production to reduce data volume
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    environment: env.NODE_ENV,
  });

  console.log("✅ Sentry server initialized");
} else {
  console.log("⚠️  Sentry server skipped (SENTRY_DSN not configured)");
}
