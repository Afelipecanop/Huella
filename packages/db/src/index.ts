// Classic, Node-targeted Prisma client — for apps/api (or any plain Node
// process) only. Cloudflare Workers can't run this client's binary query
// engine; Worker code must import from "@huella/db/workerd" instead.
export * from "@prisma/client";
