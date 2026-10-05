import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "hktraffic",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-09-29",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      VISITS: bindings.analyticsEngineDataset({ name: "hktraffic_visits" }),
      VISIT_COUNTS: bindings.kv({ id: "f7b62c640e0b484b88e6005025615f3e" }),
    },
  }),
});
