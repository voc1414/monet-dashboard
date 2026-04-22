import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { SignJWT } from "jose";

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "monet-admin-secret-key"
);

// ─── In-memory store ───
const store = new Map<
  string,
  { staffName: string; storeName: string; status: string; retiredMonth: string | null }
>();

// ─── Mock db.ts ───
vi.mock("./db", () => ({
  getAllStaffStatus: vi.fn(async () => Array.from(store.values())),
  getStaffStatusByKey: vi.fn(async (staffName: string, storeName: string) => {
    return store.get(`${staffName}|${storeName}`) || undefined;
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

    // Create a status
    await caller.admin.updateStaffStatus({
      staffName: "TestStaff",
      storeName: "堀江院",
      status: "retired",
      retiredMonth: "2026-04",
    });

    // Fetch all statuses
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

    // Verify it was stored
    expect(store.has("Hitomi|福島院")).toBe(true);
    expect(store.get("Hitomi|福島院")?.status).toBe("retired");
  });

  it("allows admin to set a staff member back to active", async () => {
    const ctx = await createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // First set as retired
    await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "retired",
      retiredMonth: "2026-04",
    });

    // Then set back to active
    const result = await caller.admin.updateStaffStatus({
      staffName: "Hitomi",
      storeName: "福島院",
      status: "active",
    });

    expect(result).toEqual({ success: true });

    // Verify the status was updated
    const statuses = await caller.admin.getStaffStatuses();
    const found = statuses.find(
      (s: any) => s.staffName === "Hitomi" && s.storeName === "福島院"
    );
    expect(found?.status).toBe("active");
    // retiredMonth should be null when active
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
});

describe("admin.bulkInitStaffStatuses", () => {
  beforeEach(() => {
    store.clear();
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

    // Verify all were created
    expect(store.size).toBe(3);
    expect(store.get("Staff2|福島院")?.status).toBe("retired");
    expect(store.get("Staff2|福島院")?.retiredMonth).toBe("2026-03");
  });
});
