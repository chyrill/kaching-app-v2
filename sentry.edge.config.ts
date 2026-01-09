// This file configures the initialization of Sentry for edge features (middleware, edge API routes, etc.)
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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

  console.log("✅ Sentry edge initialized");
} else {
  console.log("⚠️  Sentry edge skipped (SENTRY_DSN not configured)");
}
