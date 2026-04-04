import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = "http://localhost:3000/api/trpc";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "commit.1414@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "hara1414";

let adminToken: string;

/** tRPC query (GET) with superjson */
async function trpcQuery(proc: string, input?: any, token?: string) {
  const url = input
    ? `${BASE}/${proc}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `${BASE}/${proc}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const body = await res.json();
  // superjson wraps in result.data.json
  return body?.result?.data?.json ?? body;
}

/** tRPC mutation (POST) with superjson */
async function trpcMutation(proc: string, input: any, token?: string) {
  const url = `${BASE}/${proc}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ json: input }),
  });
  const body = await res.json();
  return body?.result?.data?.json ?? body;
}

/** Raw fetch for error-checking (returns full response) */
async function trpcRaw(proc: string, token?: string) {
  const url = `${BASE}/${proc}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  return { status: res.status, body: await res.json() };
}

describe("staffOverrides CRUD", () => {
  beforeAll(async () => {
    // ログインしてトークンを取得
    const res = await trpcMutation("admin.login", {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });
    adminToken = res.token;
    expect(adminToken).toBeTruthy();
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    const overrides = await trpcQuery("admin.staffOverrides", undefined, adminToken);
    if (Array.isArray(overrides)) {
      for (const o of overrides) {
        if (o.originalName === "__test_override__") {
          await trpcMutation("admin.deleteStaffOverride", { id: o.id }, adminToken);
        }
      }
    }
  });

  it("should list overrides", async () => {
    const data = await trpcQuery("admin.staffOverrides", undefined, adminToken);
    expect(Array.isArray(data)).toBe(true);
  });

  it("should upsert a staff override", async () => {
    const res = await trpcMutation(
      "admin.upsertStaffOverride",
      {
        originalName: "__test_override__",
        store: "堀江院",
        displayName: "テスト太郎",
      },
      adminToken
    );
    expect(res.success).toBe(true);
  });

  it("should reflect the upserted override in the list", async () => {
    const overrides = await trpcQuery("admin.staffOverrides", undefined, adminToken);
    const found = overrides.find(
      (o: any) => o.originalName === "__test_override__" && o.store === "堀江院"
    );
    expect(found).toBeDefined();
    expect(found.displayName).toBe("テスト太郎");
    expect(found.hidden).toBe(0);
  });

  it("should update an existing override via upsert", async () => {
    const res = await trpcMutation(
      "admin.upsertStaffOverride",
      {
        originalName: "__test_override__",
        store: "堀江院",
        displayName: "テスト次郎",
        hidden: 1,
      },
      adminToken
    );
    expect(res.success).toBe(true);

    const overrides = await trpcQuery("admin.staffOverrides", undefined, adminToken);
    const found = overrides.find(
      (o: any) => o.originalName === "__test_override__" && o.store === "堀江院"
    );
    expect(found.displayName).toBe("テスト次郎");
    expect(found.hidden).toBe(1);
  });

  it("should delete a staff override by id", async () => {
    // まず対象のIDを取得
    const overrides = await trpcQuery("admin.staffOverrides", undefined, adminToken);
    const target = overrides.find(
      (o: any) => o.originalName === "__test_override__" && o.store === "堀江院"
    );
    expect(target).toBeDefined();

    const res = await trpcMutation(
      "admin.deleteStaffOverride",
      { id: target.id },
      adminToken
    );
    expect(res.success).toBe(true);

    const afterDelete = await trpcQuery("admin.staffOverrides", undefined, adminToken);
    const found = afterDelete.find(
      (o: any) => o.originalName === "__test_override__" && o.store === "堀江院"
    );
    expect(found).toBeUndefined();
  });

  it("staffOverrides list is public (no auth needed)", async () => {
    // staffOverridesはpublicProcedure（ダッシュボード側でも使用）
    const data = await trpcQuery("admin.staffOverrides");
    expect(Array.isArray(data)).toBe(true);
  });

  it("should reject upsert without admin token", async () => {
    const raw = await trpcRaw("admin.upsertStaffOverride");
    // POST without body should fail
    expect(raw.body.error).toBeTruthy();
  });
});
