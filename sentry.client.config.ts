import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Captures 10% of sessions for performance monitoring (keeps the free tier comfortable)
  tracesSampleRate: 0.1,

  // Only send errors in production — not during local development
  enabled: process.env.NODE_ENV === "production",
});
