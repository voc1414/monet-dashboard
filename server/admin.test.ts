import { describe, expect, it, vi } from "vitest";

// Mock ENV before importing the module
vi.mock("./_core/env", () => ({
  ENV: {
    adminUsername: "commit.1414@gmail.com",
    adminPassword: "hara1414",
    cookieSecret: "test-secret-key-for-jwt",
    ownerOpenId: "",
    isProduction: false,
    forgeApiUrl: "",
    forgeApiKey: "",
    appId: "",
    databaseUrl: "",
    oAuthServerUrl: "",
  },
}));

// Mock the SDK to avoid actual OAuth calls
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockResolvedValue(null),
  },
}));

// Mock db functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(authHeader?: string): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: authHeader ? { authorization: authHeader } : {},
      cookies: {},
    } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

describe("admin.login", () => {
  it("should succeed with correct credentials and return token", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.login({
      username: "commit.1414@gmail.com",
      password: "hara1414",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    // JWT has 3 parts separated by dots
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("should fail with wrong password", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.login({
        username: "commit.1414@gmail.com",
        password: "wrongpassword",
      })
    ).rejects.toThrow("IDまたはパスワードが正しくありません");
  });

  it("should fail with wrong username", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.login({
        username: "wrong@email.com",
        password: "hara1414",
      })
    ).rejects.toThrow("IDまたはパスワードが正しくありません");
  });
});

describe("admin.me", () => {
  it("should return null when no token provided", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.me();
    expect(result).toBeNull();
  });

  it("should return admin info with valid token from login", async () => {
    // Login first to get a token
    const loginCtx = createMockContext();
    const loginCaller = appRouter.createCaller(loginCtx);

    const loginResult = await loginCaller.admin.login({
      username: "commit.1414@gmail.com",
      password: "hara1414",
    });

    // Use the token in Authorization header
    const meCtx = createMockContext(`Bearer ${loginResult.token}`);
    const meCaller = appRouter.createCaller(meCtx);

    const result = await meCaller.admin.me();
    expect(result).toEqual({
      role: "admin",
      username: "commit.1414@gmail.com",
    });
  });

  it("should return null with invalid token", async () => {
    const ctx = createMockContext("Bearer invalid-token-here");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.me();
    expect(result).toBeNull();
  });
});

describe("admin.logout", () => {
  it("should return success", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.logout();
    expect(result).toEqual({ success: true });
  });
});
