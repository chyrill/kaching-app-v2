// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { env } from "~/env";

// Only initialize Sentry if DSN is provided (optional for local dev)
if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,

    // Add optional integrations for session recording, analytics, etc.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production to reduce data volume
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Capture Replay for 10% of all sessions in production, 100% of errors
    replaysSessionSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,

    // Note: if you want to override the automatic release value, do not set a
    // `release` value here - use the environment variable `SENTRY_RELEASE`, so
    // that it will also get attached to your source maps
    
    environment: env.NODE_ENV,
  });

  console.log("✅ Sentry client initialized");
} else {
  console.log("⚠️  Sentry client skipped (SENTRY_DSN not configured)");
}
