// The `prisma-client`/`workerd` generator emits a couple of plain-JS/WASM
// runtime asset files alongside its generated `.ts` sources (currently
// `internal/query_engine_bg.js` and `internal/query_engine_bg.wasm`, loaded
// via `import("./query_engine_bg.wasm?module")` at runtime). `tsc` only
// compiles `.ts` files, so these non-TS assets never land in `dist/` on
// their own — this script copies them across after the TypeScript build so
// `@huella/db/workerd`'s built output stays runnable.
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(packageRoot, "src", "generated");
const distDir = join(packageRoot, "dist", "generated");

const ASSET_EXTENSIONS = new Set([".wasm"]);
// Plain-JS runtime helpers emitted next to the generated `.ts` sources
// (e.g. `query_engine_bg.js`) — not compiled output, so `tsc` skips them too.
const ASSET_BASENAMES = new Set(["query_engine_bg.js"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    const ext = fullPath.slice(fullPath.lastIndexOf("."));
    if (!ASSET_EXTENSIONS.has(ext) && !ASSET_BASENAMES.has(entry.name)) continue;

    const rel = relative(srcDir, fullPath);
    const dest = join(distDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await cp(fullPath, dest);
    console.log(`copied ${relative(packageRoot, fullPath)} -> ${relative(packageRoot, dest)}`);
  }
}

try {
  await stat(srcDir);
} catch {
  console.log(`no ${relative(packageRoot, srcDir)} directory found, skipping asset copy`);
  process.exit(0);
}

await walk(srcDir);
