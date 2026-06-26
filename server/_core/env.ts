export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  adminUsername: process.env.ADMIN_USERNAME ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  /** Shared secret guarding /api/scheduled/* endpoints. Empty = endpoints disabled (503). */
  cronSecret: process.env.CRON_SECRET ?? "",
};
