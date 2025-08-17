import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function getUserIdentity(ctx: QueryCtx | MutationCtx) {
  // Use Clerk's getUserIdentity directly through ConvexProviderWithClerk
  return await ctx.auth.getUserIdentity();
}

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await getUserIdentity(ctx);
  if (!identity) {
    throw new Error("Authentication required");
  }
  return identity;
}

export async function requireAdminRole(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);

  if (!identity.role || identity.role !== "admin") {
    throw new Error("Admin role required for this action");
  }

  return identity;
}

export async function getOrCreateUser(ctx: MutationCtx): Promise<Id<"users">> {
  const identity = await getUserIdentity(ctx);

  if (!identity) {
    // Create anonymous user (preserve existing behavior)
    return await createAnonymousUser(ctx);
  }

  // Check if user exists by clerkId
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (existingUser) {
    return existingUser._id;
  }

  // Create new authenticated user
  return await ctx.db.insert("users", {
    name: identity.name || identity.email?.split("@")[0] || "User",
    email: identity.email,
    clerkId: identity.subject,
    role: typeof identity.role === "string" ? identity.role : "user",
    isAnonymous: false,
  });
}

async function createAnonymousUser(ctx: MutationCtx): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    name: "Anonymous Player",
    isAnonymous: true,
  });
}

export async function getCurrentUserIdForMutation(
  ctx: MutationCtx,
): Promise<Id<"users">> {
  const identity = await getUserIdentity(ctx);

  if (!identity) {
    // For anonymous users, find or create a temporary user
    let user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAnonymous"), true))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        name: "Anonymous Player",
        isAnonymous: true,
      });
      return userId;
    }
    return user._id;
  }

  // For authenticated users, get or create their user record
  return await getOrCreateUser(ctx);
}

export async function getCurrentUserIdForQuery(
  ctx: QueryCtx,
): Promise<Id<"users"> | null> {
  const identity = await getUserIdentity(ctx);

  if (!identity) {
    // For anonymous users, find an existing temporary user
    let user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAnonymous"), true))
      .first();

    return user?._id || null;
  }

  // For authenticated users, find their existing user record
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return existingUser?._id || null;
}
