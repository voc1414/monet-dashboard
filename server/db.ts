import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, staffOverrides, InsertStaffOverride, StaffOverride } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Staff Overrides =====

/** 全スタッフオーバーライドを取得 */
export async function getAllStaffOverrides(): Promise<StaffOverride[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(staffOverrides);
}

/** 特定のスタッフオーバーライドを取得（originalName + storeで検索） */
export async function getStaffOverride(originalName: string, store: string): Promise<StaffOverride | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(staffOverrides)
    .where(and(eq(staffOverrides.originalName, originalName), eq(staffOverrides.store, store)))
    .limit(1);
  return result[0];
}

/** スタッフオーバーライドを作成または更新（upsert） */
export async function upsertStaffOverride(data: {
  originalName: string;
  store: string;
  displayName: string;
  hidden?: number;
  retiredMonth?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getStaffOverride(data.originalName, data.store);
  if (existing) {
    await db.update(staffOverrides)
      .set({
        displayName: data.displayName,
        hidden: data.hidden ?? existing.hidden,
        retiredMonth: data.retiredMonth !== undefined ? data.retiredMonth : existing.retiredMonth,
      })
      .where(eq(staffOverrides.id, existing.id));
  } else {
    await db.insert(staffOverrides).values({
      originalName: data.originalName,
      store: data.store,
      displayName: data.displayName,
      hidden: data.hidden ?? 0,
      retiredMonth: data.retiredMonth ?? null,
    });
  }
}

/** スタッフオーバーライドを削除 */
export async function deleteStaffOverride(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(staffOverrides).where(eq(staffOverrides.id, id));
}
