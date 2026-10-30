import { zipFunctions } from "@netlify/zip-it-and-ship-it";
import { mkdir } from "node:fs/promises";
await mkdir(".netlify/functions", { recursive: true });
const results = await zipFunctions("netlify/functions", ".netlify/functions", {
  config: { "*": { nodeBundler: "esbuild", nodeVersion: "22" } },
});
if (!results.some((r) => r.name === "game"))
  throw new Error("game function missing");
console.log(
  JSON.stringify(
    results.map((r) => ({ name: r.name, path: r.path, runtime: r.runtime })),
    null,
    2,
  ),
);
