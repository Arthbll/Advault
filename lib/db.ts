/**
 * Wraps a Prisma (or any async) call with a hard timeout.
 * If the DB doesn't respond within `ms` milliseconds, returns `fallback`
 * instead of hanging the page render.
 *
 * Usage:
 *   const campaigns = await withTimeout(prisma.campaign.findMany(...), [], 3000);
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  ms = 3000,
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), ms)
  );
  return Promise.race([promise, timeout]);
}
