/**
 * Mock JWT helpers. This is NOT real auth — it base64-encodes a payload so the
 * app can simulate token storage/inspection (TDD §9). Replace with a real auth
 * provider in the backend phase.
 */
interface MockJwtPayload {
  sub: string; // userId
  iat: number;
}

function base64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createMockToken(userId: string, issuedAt: number): string {
  const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload: MockJwtPayload = { sub: userId, iat: issuedAt };
  const body = base64Url(JSON.stringify(payload));
  return `${header}.${body}.mock`;
}

export function decodeMockToken(token: string): MockJwtPayload | null {
  try {
    const [, body] = token.split(".");
    const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as MockJwtPayload;
  } catch {
    return null;
  }
}
