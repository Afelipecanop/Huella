// The `prisma-client`/`workerd` generator emits a couple of non-`.ts`
// runtime asset files alongside its generated `.ts` sources (currently a
// `*_bg.js` runtime shim and a `*_bg.wasm` compiled module — exact basenames
// depend on the generator's `engineType`/`runtime` settings, e.g.
// `query_compiler_bg.{js,wasm}`, loaded via
// `import("./query_compiler_bg.wasm?module")` at runtime). `tsc` only
// compiles `.ts` files, so these non-TS assets never land in `dist/` on
// their own — this script mirrors every non-`.ts` file from
// `src/generated/` into `dist/generated/` after the TypeScript build so
// `@huella/db/workerd`'s built output stays runnable. `dist/` is cleaned
// before `tsc` runs (see the `build` script in package.json), so this never
// has to worry about stale asset files with old basenames lingering after a
// regenerated client (e.g. after an `engineType` change).
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(packageRoot, "src", "generated");
const distDir = join(packageRoot, "dist", "generated");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (fullPath.endsWith(".ts")) continue;

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
