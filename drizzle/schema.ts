import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * スタッフ名オーバーライドテーブル
 * CSVの元名（originalName）を表示名（displayName）にマッピングする。
 * 管理者ページから編集し、ダッシュボード全体で参照する。
 */
export const staffOverrides = mysqlTable("staff_overrides", {
  id: int("id").autoincrement().primaryKey(),
  /** CSV上の元のスタッフ名（一意キー） */
  originalName: varchar("originalName", { length: 255 }).notNull(),
  /** 所属店舗名（正規化済み） */
  store: varchar("store", { length: 255 }).notNull(),
  /** ダッシュボード上の表示名（管理者が編集可） */
  displayName: varchar("displayName", { length: 255 }).notNull(),
  /** 非表示フラグ（trueの場合ダッシュボードから非表示） */
  hidden: int("hidden").default(0).notNull(),
  /** 退社月（YYYY-MM形式、nullなら在籍中） */
  retiredMonth: varchar("retiredMonth", { length: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StaffOverride = typeof staffOverrides.$inferSelect;
export type InsertStaffOverride = typeof staffOverrides.$inferInsert;