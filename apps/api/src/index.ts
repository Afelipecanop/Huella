import "dotenv/config";
import { buildServer } from "./server.js";

const server = buildServer();
const port = Number(process.env.PORT ?? 3000);

server.listen({ port, host: "0.0.0.0" }).catch((err) => {
  server.log.error(err);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close().then(() => process.exit(0));
  });
}
