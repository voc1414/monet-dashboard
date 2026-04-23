import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, staffStatus, type StaffStatus, staffStatusHistory, type StaffStatusHistory } from "../drizzle/schema";
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

// ─── Staff Status helpers ───

/** Get all staff status records */
export async function getAllStaffStatus(): Promise<StaffStatus[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(staffStatus);
}

/** Get a single staff status by name + store */
export async function getStaffStatusByKey(staffName: string, storeName: string): Promise<StaffStatus | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(staffStatus)
    .where(and(eq(staffStatus.staffName, staffName), eq(staffStatus.storeName, storeName)))
    .limit(1);
  return rows[0];
}

/** Upsert staff status (insert or update on duplicate staffName+storeName) */
export async function upsertStaffStatus(input: {
  staffName: string;
  storeName: string;
  status: "active" | "retired";
  retiredMonth?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(staffStatus).values({
    staffName: input.staffName,
    storeName: input.storeName,
    status: input.status,
    retiredMonth: input.retiredMonth ?? null,
  }).onDuplicateKeyUpdate({
    set: {
      status: input.status,
      retiredMonth: input.retiredMonth ?? null,
      updatedAt: new Date(),
    },
  });
}

// ─── Staff Status History helpers ───

/** Insert a new history record for a staff status change */
export async function insertStaffStatusHistory(input: {
  staffName: string;
  storeName: string;
  previousStatus: "active" | "retired";
  newStatus: "active" | "retired";
  changeMonth?: string | null;
  changedBy?: string;
  note?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(staffStatusHistory).values({
    staffName: input.staffName,
    storeName: input.storeName,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    changeMonth: input.changeMonth ?? null,
    changedBy: input.changedBy ?? "admin",
    note: input.note ?? null,
  });
}

/** Get all history records, ordered by newest first */
export async function getAllStaffStatusHistory(): Promise<StaffStatusHistory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(staffStatusHistory).orderBy(desc(staffStatusHistory.createdAt));
}

/** Get history records for a specific staff member */
export async function getStaffStatusHistoryByStaff(
  staffName: string,
  storeName: string
): Promise<StaffStatusHistory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(staffStatusHistory)
    .where(and(eq(staffStatusHistory.staffName, staffName), eq(staffStatusHistory.storeName, storeName)))
    .orderBy(desc(staffStatusHistory.createdAt));
}

/** Get retirement count within a date range (based on createdAt of history records where newStatus='retired') */
export async function getRetirementCountByPeriod(
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions = [eq(staffStatusHistory.newStatus, "retired")];
  if (startDate) conditions.push(gte(staffStatusHistory.createdAt, startDate));
  if (endDate) conditions.push(lte(staffStatusHistory.createdAt, endDate));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(staffStatusHistory)
    .where(and(...conditions));

  return Number(result[0]?.count ?? 0);
}

/** Get reactivation (rehire) count within a date range */
export async function getReactivationCountByPeriod(
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions = [
    eq(staffStatusHistory.newStatus, "active"),
    eq(staffStatusHistory.previousStatus, "retired"),
  ];
  if (startDate) conditions.push(gte(staffStatusHistory.createdAt, startDate));
  if (endDate) conditions.push(lte(staffStatusHistory.createdAt, endDate));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(staffStatusHistory)
    .where(and(...conditions));

  return Number(result[0]?.count ?? 0);
}
