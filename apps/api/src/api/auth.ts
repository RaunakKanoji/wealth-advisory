import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

import { clerkAuthorizedParties, isDemoMode, env } from "../env.js";
import * as usersRepository from "../db/repositories/users.repository.js";
import { ApiError } from "../lib/errors.js";

export type AuthVariables = {
  userId: string;
  externalAuthId: string;
  requestId: string;
};


export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (context, next) => {
  const authorization = context.req.header("Authorization");
  const demoAuthId = context.req.header("x-demo-auth-id")?.trim();
  let externalAuthId: string | undefined;
  let email: string | undefined;
  let user: Awaited<ReturnType<typeof usersRepository.findUserByExternalAuthId>> | undefined;
  let resolvedByConfiguredDemoUser = false;

  // Prefer the explicit demo identity while DEMO_MODE is enabled. This keeps
  // a stale Clerk token from blocking the seeded demo user when the API is
  // running without a Clerk secret.
  if (isDemoMode && demoAuthId === env.DEMO_AUTH_ID) {
    externalAuthId = demoAuthId;
  } else if (authorization?.startsWith("Bearer ")) {
    if (!env.CLERK_SECRET_KEY) throw new ApiError("AUTH_NOT_CONFIGURED", "Server authentication is not configured.", 500);
    try {
      const claims = await verifyToken(authorization.slice("Bearer ".length), {
        secretKey: env.CLERK_SECRET_KEY,
        audience: env.CLERK_AUDIENCE,
        authorizedParties: clerkAuthorizedParties,
      });
      externalAuthId = claims.sub;
    } catch {
      throw new ApiError("UNAUTHORIZED", "Your session is no longer valid.", 401);
    }
  } else if (isDemoMode) {
    user = await usersRepository.findUserById(env.DEMO_USER_ID);
    resolvedByConfiguredDemoUser = true;
  } else {
    throw new ApiError("UNAUTHORIZED", "Authentication is required.", 401);
  }

  let created = false;
  if (!user) {
    if (!externalAuthId) throw new ApiError("USER_NOT_PROVISIONED", "This demo user is not provisioned.", 404);
    user = await usersRepository.findUserByExternalAuthId(externalAuthId);
    created = !user;
    if (!user) {
      user = await usersRepository.upsertUser({ id: randomUUID(), externalAuthId, email });
    }
  }
  if (user.status !== "active") throw new ApiError("USER_INACTIVE", "This profile is not active.", 403);
  externalAuthId ??= user.externalAuthId;
  context.set("userId", user.id);
  context.set("externalAuthId", externalAuthId);
  if (process.env.NODE_ENV !== "production") {
    console.info("[AUTH] authenticated user resolved", {
      requestId: context.get("requestId"),
      source: isDemoMode && (demoAuthId || resolvedByConfiguredDemoUser) ? "demo" : "clerk",
      created,
      userResolved: true,
    });
  }
  await next();
};
