import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Staff status table — tracks active/retired status per staff member.
 * Key: staffName + storeName (unique composite).
 * Managed by admin panel; consumed by frontend to filter retired staff.
 */
export const staffStatus = mysqlTable("staff_status", {
  id: int("id").autoincrement().primaryKey(),
  /** Staff display name (must match monthly report / NPS data) */
  staffName: varchar("staffName", { length: 100 }).notNull(),
  /** Store name the staff belongs to */
  storeName: varchar("storeName", { length: 100 }).notNull(),
  /** Current status: active (在籍) or retired (退社) */
  status: mysqlEnum("status", ["active", "retired"]).default("active").notNull(),
  /** Month the staff retired, e.g. "2026-04". Null if active. */
  retiredMonth: varchar("retiredMonth", { length: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("staff_store_idx").on(table.staffName, table.storeName),
]));

export type StaffStatus = typeof staffStatus.$inferSelect;
export type InsertStaffStatus = typeof staffStatus.$inferInsert;
