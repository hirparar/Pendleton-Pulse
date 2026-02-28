import { NextResponse } from "next/server";
import { AuthzError } from "@/lib/authz/errors";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleRouteError(err: unknown) {
  if (err instanceof AuthzError) {
    return json(
      { error: err.code, message: err.message },
      { status: err.status }
    );
  }

  return json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
