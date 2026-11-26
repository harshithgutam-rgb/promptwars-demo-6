import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const relativeTarget = specifier.slice(2);
      const basePath = path.join(projectRoot, relativeTarget);
      const candidates = [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        path.join(basePath, "index.ts"),
        basePath,
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return {
            url: pathToFileURL(candidate).href,
            shortCircuit: true,
          };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
