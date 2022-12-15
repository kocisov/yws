import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/server.ts", "src/client.ts"],
  format: ["cjs"],
  minify: true,
  sourcemap: true,
});
