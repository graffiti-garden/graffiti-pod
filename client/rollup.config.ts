import typescript from "rollup-plugin-typescript2";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { visualizer } from "rollup-plugin-visualizer";
import nodePolyfills from "rollup-plugin-node-polyfills";

function createConfig(
  outputFile: string,
  format: "es" | "cjs",
  browser: boolean,
) {
  const external: string[] = [];
  // on browser everything is external
  if (!browser) {
    // externalize the api so
    // instanceof checks work for errors
    external.push("@graffiti-garden/api");
    // And these because they can be big
    external.push("ajv");
    external.push("ajv-draft-04");
    external.push("@graffiti-garden/solid-oidc-session-manager");
    external.push("@graffiti-garden/implementation-local/database");
    external.push("@graffiti-garden/implementation-local/synchronize");
    external.push("@graffiti-garden/implementation-local/utilities");
    external.push("@repeaterjs/repeater");
    external.push("fast-json-patch");
  }
  return {
    input: "src/index.ts",
    output: {
      file: "dist/" + outputFile,
      format,
      sourcemap: true,
    },
    external,
    plugins: [
      typescript({
        tsconfig: "tsconfig.json",
        useTsconfigDeclarationDir: true,
      }),
      json(),
      resolve({
        browser: format === "es",
        preferBuiltins: format === "cjs",
      }),
      commonjs(),
      ...(format === "es" ? [nodePolyfills()] : []),
      terser(),
      visualizer({ filename: `dist-stats/${outputFile}.html` }),
    ],
  };
}

export default [
  createConfig("index.js", "es", false),
  createConfig("index.browser.js", "es", true),
  createConfig("index.cjs.js", "cjs", false),
];
