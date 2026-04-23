import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { SignJWT } from "jose";

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "monet-admin-secret-key"
);

// ─── In-memory stores ───
const store = new Map<
  string,
  { staffName: string; storeName: string; status: string; retiredMonth: string | null }
>();

const historyStore: Array<{
  id: number;
  staffName: string;
  storeName: string;
  previousStatus: string;
  newStatus: string;
  changeMonth: string | null;
  changedBy: string;
  note: string | null;
  createdAt: Date;
}> = [];

let historyIdCounter = 0;

// ─── Mock db.ts ───
vi.mock("./db", () => ({
  getAllStaffStatus: vi.fn(async () => Array.from(store.values())),
  getStaffStatusByKey: vi.fn(async (staffName: string, storeName: string) => {
    return store.get(`${staffName}|${storeName}`) || undefined;
  }),
  getRetirementCountByPeriod: vi.fn(async (startDate?: Date, endDate?: Date) => {
    return historyStore.filter((h) => {
      if (h.newStatus !== "retired") return false;
      if (startDate && h.createdAt < startDate) return false;
      if (endDate && h.createdAt > endDate) return false;
      return true;
    }).length;
  }),
  getReactivationCountByPeriod: vi.fn(async (startDate?: Date, endDate?: Date) => {
    return historyStore.filter((h) => {
      if (h.newStatus !== "active" || h.previousStatus !== "retired") return false;
      if (startDate && h.createdAt < startDate) return false;
      if (endDate && h.createdAt > endDate) return false;
      return true;
    }).length;
  }),
  upsertStaffStatus: vi.fn(
    async (input: {
      staffName: string;
      storeName: string;
      status: string;
      retiredMonth?: string | null;
    }) => {
      store.set(`${input.staffName}|${input.storeName}`, {
        staffName: input.staffName,
        storeName: input.storeName,
        status: input.status,
        retiredMonth: input.retiredMonth ?? null,
      });
    }
  ),
  insertStaffStatusHistory: vi.fn(
    async (input: {
      staffName: string;
      storeName: string;
      previousStatus: string;
      newStatus: string;
      changeMonth?: string | null;
      changedBy?: string;
      note?: string | null;
    }) => {
      historyIdCounter++;
      historyStore.push({
        id: historyIdCounter,
        staffName: input.staffName,
        storeName: input.storeName,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        changeMonth: input.changeMonth ?? null,
        changedBy: input.changedBy ?? "admin",
        note: input.note ?? null,
        createdAt: new Date(),
      });
    }
  ),
  getAllStaffStatusHistory: vi.fn(async () =>
    [...historyStore].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  ),
  // These are not used by admin router but may be imported transitively
  getDb: vi.fn(async () => null),
  upsertUser: vi.fn(async () => {}),
  getUserByOpenId: vi.fn(async () => undefined),
}));

// ─── Helpers ───

async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET_KEY);
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

async function createAdminContext(): Promise<TrpcContext> {
  const token = await createAdminToken();
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { authorization: `Bearer ${token}` },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Tests ───

describe("admin.getStaffStatuses", () => {
  beforeEach(() => {
    store.clear();
    historyStore.length = 0;
    historyIdCounter = 0;
  });

  it("returns empty array when no statuses exist", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.getStaffStatuses();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("returns statuses after they are created", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.admin.updateStaffStatus({
      staffName: "TestStaff",
      storeName: "堀江院",
      status: "retired",
      retiredMonth: "2026-04",
    });

    const result = await caller.admin.getStaffStatuses();
    expect(result.length).toBe(1);

    const found = result.find(
      (s: any) => s.staffName === "TestStaff" && s.storeName === "堀江院"
    );
    expect(found).toBeDefined();
    expect(found?.status).toBe("retired");
    expect(found?.retiredMonth).toBe("2026-04");
  });
});

describe("admin.updateStaffStatus", () => {
  beforeEach(() => {
    store.clear();
    historyStore.length = 0;
    historyIdCounter = 0;
  });

  it("rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.updateStaffStatus({
        staffName: "TestStaff",
        storeName: "堀江院",
        status: "retired",
        retiredMonth: "2026-04",
      })
    ).rejects.toThrow("管理者認証が必要です");
  });

  it("allows admin to set a staff member as retired", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "retired",
      retiredMonth: "2026-04",
    });

    expect(result).toEqual({ success: true });
    expect(store.has("Hitomi|福島院")).toBe(true);
    expect(store.get("Hitomi|福島院")?.status).toBe("retired");
  });

  it("allows admin to set a staff member back to active", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "retired",
      retiredMonth: "2026-04",
    });

    const result = await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "active",
    });

    expect(result).toEqual({ success: true });

    const statuses = await caller.admin.getStaffStatuses();
    const found = statuses.find(
      (s: any) => s.staffName === "Hitomi" && s.storeName === "福島院"
    );
    expect(found?.status).toBe("active");
    expect(found?.retiredMonth).toBeNull();
  });

  it("validates retiredMonth format", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.updateStaffStatus({
        staffName: "TestStaff",
        storeName: "堀江院",
        status: "retired",
        retiredMonth: "invalid-date",
      })
    ).rejects.toThrow();
  });

  it("records history when status changes to retired", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "retired",
      retiredMonth: "2026-04",
      note: "自己都合退社",
    });

    expect(historyStore.length).toBe(1);
    expect(historyStore[0].staffName).toBe("Hitomi");
    expect(historyStore[0].storeName).toBe("福島院");
    expect(historyStore[0].previousStatus).toBe("active");
    expect(historyStore[0].newStatus).toBe("retired");
    expect(historyStore[0].changeMonth).toBe("2026-04");
    expect(historyStore[0].note).toBe("自己都合退社");
  });

  it("records history when status changes to active (reinstatement)", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // First retire
    await caller.admin.updateStaffStatus({
      staffName: "Kazumi",
      storeName: "堀江院2nd",
      status: "retired",
      retiredMonth: "2026-03",
    });

    // Then reinstate
    await caller.admin.updateStaffStatus({
      staffName: "Kazumi",
      storeName: "堀江院2nd",
      status: "active",
      note: "復帰",
    });

    expect(historyStore.length).toBe(2);

    // First entry: active → retired
    expect(historyStore[0].previousStatus).toBe("active");
    expect(historyStore[0].newStatus).toBe("retired");

    // Second entry: retired → active
    expect(historyStore[1].previousStatus).toBe("retired");
    expect(historyStore[1].newStatus).toBe("active");
    expect(historyStore[1].note).toBe("復帰");
  });

  it("records history with null note when note is not provided", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.admin.updateStaffStatus({
      staffName: "TestStaff",
      storeName: "堀江院",
      status: "retired",
      retiredMonth: "2026-04",
    });

    expect(historyStore.length).toBe(1);
    expect(historyStore[0].note).toBeNull();
  });
});

describe("admin.getStaffStatusHistory", () => {
  beforeEach(() => {
    store.clear();
    historyStore.length = 0;
    historyIdCounter = 0;
  });

  it("rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.getStaffStatusHistory()).rejects.toThrow(
      "管理者認証が必要です"
    );
  });

  it("returns empty array when no history exists", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.getStaffStatusHistory();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("returns history records after status changes", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Make two status changes
    await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "retired",
      retiredMonth: "2026-04",
      note: "退社",
    });

    await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "active",
      note: "復帰",
    });

    const result = await caller.admin.getStaffStatusHistory();
    expect(result.length).toBe(2);

    // Verify both records exist (order depends on mock timing)
    const retiredEntry = result.find((r: any) => r.newStatus === "retired");
    const activeEntry = result.find((r: any) => r.newStatus === "active");
    expect(retiredEntry).toBeDefined();
    expect(retiredEntry?.note).toBe("退社");
    expect(activeEntry).toBeDefined();
    expect(activeEntry?.note).toBe("復帰");
  });
});

describe("admin.getStaffStats", () => {
  beforeEach(() => {
    store.clear();
    historyStore.length = 0;
    historyIdCounter = 0;
  });

  it("rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.getStaffStats()).rejects.toThrow(
      "管理者認証が必要です"
    );
  });

  it("returns zero counts when no data exists", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.getStaffStats();
    expect(result.totalActive).toBe(0);
    expect(result.totalRetired).toBe(0);
    expect(result.totalAll).toBe(0);
    expect(result.periodRetirements).toBe(0);
    expect(result.periodReactivations).toBe(0);
  });

  it("returns correct counts after status changes", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create some staff
    await caller.admin.bulkInitStaffStatuses({
      staffList: [
        { staffName: "Staff1", storeName: "堀江院", status: "active" },
        { staffName: "Staff2", storeName: "福島院", status: "active" },
        { staffName: "Staff3", storeName: "高槻院", status: "active" },
      ],
    });

    // Retire one staff
    await caller.admin.updateStaffStatus({
      staffName: "Staff2",
      storeName: "福島院",
      status: "retired",
      retiredMonth: "2026-04",
    });

    const result = await caller.admin.getStaffStats();
    expect(result.totalActive).toBe(2);
    expect(result.totalRetired).toBe(1);
    expect(result.totalAll).toBe(3);
    expect(result.periodRetirements).toBe(1);
    expect(result.periodReactivations).toBe(0);
  });

  it("counts reactivations correctly", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create and retire a staff member
    await caller.admin.updateStaffStatus({
      staffName: "Staff1",
      storeName: "堀江院",
      status: "retired",
      retiredMonth: "2026-03",
    });

    // Reactivate
    await caller.admin.updateStaffStatus({
      staffName: "Staff1",
      storeName: "堀江院",
      status: "active",
    });

    const result = await caller.admin.getStaffStats();
    expect(result.periodRetirements).toBe(1);
    expect(result.periodReactivations).toBe(1);
  });

  it("accepts optional date range parameters", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.getStaffStats({
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-12-31T23:59:59.999Z",
    });

    expect(result.totalActive).toBe(0);
    expect(result.periodRetirements).toBe(0);
    expect(result.periodReactivations).toBe(0);
  });
});

describe("admin.bulkInitStaffStatuses", () => {
  beforeEach(() => {
    store.clear();
    historyStore.length = 0;
    historyIdCounter = 0;
  });

  it("rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.bulkInitStaffStatuses({
        staffList: [
          { staffName: "A", storeName: "堀江院", status: "active" },
        ],
      })
    ).rejects.toThrow("管理者認証が必要です");
  });

  it("allows admin to bulk initialize staff statuses", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.bulkInitStaffStatuses({
      staffList: [
        { staffName: "Staff1", storeName: "堀江院", status: "active" },
        { staffName: "Staff2", storeName: "福島院", status: "retired", retiredMonth: "2026-03" },
        { staffName: "Staff3", storeName: "高槻院", status: "active" },
      ],
    });

    expect(result).toEqual({ success: true, count: 3 });
    expect(store.size).toBe(3);
    expect(store.get("Staff2|福島院")?.status).toBe("retired");
    expect(store.get("Staff2|福島院")?.retiredMonth).toBe("2026-03");
  });
});
