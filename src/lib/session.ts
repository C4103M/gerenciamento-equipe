import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "nfs_session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: "GLOBAL_ADMIN" | "MEMBER";
  teamId: string | null;
}

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET || "nunca-foi-sort-fallback-dev-secret-2026";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    teamId: payload.teamId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    const role =
      payload.role === "GLOBAL_ADMIN" ? "GLOBAL_ADMIN" : "MEMBER";
    const teamId =
      typeof payload.teamId === "string" ? payload.teamId : null;

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role,
      teamId,
    };
  } catch {
    return null;
  }
}
