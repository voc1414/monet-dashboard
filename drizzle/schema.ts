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

/**
 * Staff status change history — audit log for status transitions.
 * Records every active↔retired change with timestamp and optional note.
 */
export const staffStatusHistory = mysqlTable("staff_status_history", {
  id: int("id").autoincrement().primaryKey(),
  /** Staff display name */
  staffName: varchar("staffName", { length: 100 }).notNull(),
  /** Store name the staff belongs to */
  storeName: varchar("storeName", { length: 100 }).notNull(),
  /** Previous status before the change */
  previousStatus: mysqlEnum("previousStatus", ["active", "retired"]).notNull(),
  /** New status after the change */
  newStatus: mysqlEnum("newStatus", ["active", "retired"]).notNull(),
  /** Month associated with the change (e.g. retired month) */
  changeMonth: varchar("changeMonth", { length: 7 }),
  /** Who performed the change (admin username or system) */
  changedBy: varchar("changedBy", { length: 100 }).default("admin").notNull(),
  /** Optional note about the change */
  note: text("note"),
  /** When the change was recorded */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StaffStatusHistory = typeof staffStatusHistory.$inferSelect;
export type InsertStaffStatusHistory = typeof staffStatusHistory.$inferInsert;

/**
 * Store master table — manages all monet salon locations.
 * New stores detected from spreadsheet data are auto-inserted by scheduled tasks.
 * Frontend reads this table to render store lists (with hardcoded fallback).
 */
export const stores = mysqlTable("stores", {
  id: int("id").autoincrement().primaryKey(),
  /** Normalized short name used across the dashboard (e.g. "堀江院") */
  name: varchar("name", { length: 100 }).notNull().unique(),
  /** Area/region grouping (e.g. "大阪エリア", "広島エリア") */
  area: varchar("area", { length: 100 }).notNull(),
  /** Display order within the area (lower = first) */
  displayOrder: int("displayOrder").default(0).notNull(),
  /** Raw name variants from spreadsheet (comma-separated for matching) */
  rawNameVariants: text("rawNameVariants"),
  /** Salon board sheet name mapping (e.g. "monet堀江_月別") */
  salonBoardSheetName: varchar("salonBoardSheetName", { length: 200 }),
  /** NPS spreadsheet store name pattern (keyword to match in parseStoreName, e.g. "土橋院") */
  npsAlias: varchar("npsAlias", { length: 200 }),
  /** Monthly report name aliases (comma-separated, e.g. "広島土橋院,土橋院") */
  reportAliases: text("reportAliases"),
  /** Fankuru store name aliases (comma-separated, e.g. "広島土橋院,土橋院") */
  fankuruAliases: text("fankuruAliases"),
  /** Date when this store became "known" (for NEW badge expiry, ISO date string) */
  knownSince: varchar("knownSince", { length: 10 }),
  /** Whether this store is currently active */
  isActive: int("isActive").default(1).notNull(),
  /** Auto-detected flag: true if added by scheduled task */
  isAutoDetected: int("isAutoDetected").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;
