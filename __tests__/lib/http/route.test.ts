/**
 * Tests for lib/http/route.ts
 */
import { describe, it, expect, vi } from "vitest";
import { AuthzError } from "@/lib/authz/errors";

// Mock NextResponse to avoid needing a full Next.js environment
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data: unknown, init?: ResponseInit) => ({ body: data, init })),
  },
}));

import { handleRouteError, json } from "@/lib/http/route";
import { NextResponse } from "next/server";

const jsonMock = NextResponse.json as ReturnType<typeof vi.fn>;

describe("json helper", () => {
  it("delegates to NextResponse.json", () => {
    json({ ok: true });
    expect(jsonMock).toHaveBeenCalledWith({ ok: true }, undefined);
  });

  it("passes init options through", () => {
    json({ error: "not found" }, { status: 404 });
    expect(jsonMock).toHaveBeenCalledWith({ error: "not found" }, { status: 404 });
  });
});

describe("handleRouteError", () => {
  it("returns 401 for UNAUTHENTICATED AuthzError", () => {
    const err = new AuthzError("UNAUTHENTICATED");
    handleRouteError(err);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "UNAUTHENTICATED" }),
      { status: 401 }
    );
  });

  it("returns 403 for FORBIDDEN AuthzError", () => {
    const err = new AuthzError("FORBIDDEN");
    handleRouteError(err);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "FORBIDDEN" }),
      { status: 403 }
    );
  });

  it("returns 403 for PENDING AuthzError", () => {
    const err = new AuthzError("PENDING");
    handleRouteError(err);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "PENDING" }),
      { status: 403 }
    );
  });

  it("returns 403 for DENIED AuthzError", () => {
    const err = new AuthzError("DENIED");
    handleRouteError(err);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "DENIED" }),
      { status: 403 }
    );
  });

  it("includes error message in body for AuthzError", () => {
    const err = new AuthzError("FORBIDDEN", "You cannot access this resource");
    handleRouteError(err);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "You cannot access this resource" }),
      expect.anything()
    );
  });

  it("returns 500 for generic Error", () => {
    handleRouteError(new Error("Something exploded"));
    expect(jsonMock).toHaveBeenCalledWith({ error: "INTERNAL_ERROR" }, { status: 500 });
  });

  it("returns 500 for unknown thrown value (string)", () => {
    handleRouteError("a plain string error");
    expect(jsonMock).toHaveBeenCalledWith({ error: "INTERNAL_ERROR" }, { status: 500 });
  });

  it("returns 500 for null", () => {
    handleRouteError(null);
    expect(jsonMock).toHaveBeenCalledWith({ error: "INTERNAL_ERROR" }, { status: 500 });
  });

  it("respects custom status on AuthzError", () => {
    const err = new AuthzError("FORBIDDEN", "Custom msg", 422);
    handleRouteError(err);
    expect(jsonMock).toHaveBeenCalledWith(expect.anything(), { status: 422 });
  });
});
