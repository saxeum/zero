import { defineConfig } from "orval";

export default defineConfig({
  zero: {
    input: { target: "./openapi.yaml" },
    output: {
      mode: "single",
      target: "./shared/generated/api.ts",
      client: "zod",
      schemas: { path: "./shared/generated/model" },
      clean: true,
      override: {
        zod: {
          // classic = the full `zod` package; `mini` would emit zod/mini instead.
          variant: "classic",
          version: 4,
          // The spec says additionalProperties: false; without this the generator
          // silently drops it and unknown keys are stripped rather than rejected.
          strict: { body: true, response: true, param: true, query: true, header: true },
        },
      },
    },
  },
});
