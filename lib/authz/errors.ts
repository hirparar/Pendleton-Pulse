export type AuthzCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INACTIVE"
  | "PENDING"
  | "DENIED"
  | "UNKNOWN_STATUS";

export class AuthzError extends Error {
  code: AuthzCode;
  status: number;

  constructor(code: AuthzCode, message?: string, status?: number) {
    super(message ?? code);
    this.code = code;
    this.status = status ?? (code === "UNAUTHENTICATED" ? 401 : 403);
  }
}
