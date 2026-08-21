// Cloudflare-Workers-targeted Prisma client (generator "workerd" in
// prisma/schema.prisma) — for apps/email-worker (or any workerd runtime)
// only. Importing the classic "@huella/db" export here throws
// "ReferenceError: module is not defined" — its CJS output can't load in
// a Workers runtime at all.
export * from "./generated/workerd/client.js";
