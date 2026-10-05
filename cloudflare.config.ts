import { bindings, defineConfig, defineWorker } from "cf/config";

// The daily visit counter needs a KV namespace on your own Cloudflare account:
//   npx wrangler kv namespace create smartldn-visits
// then set SMARTLDN_VISITS_KV_ID to the id it prints. Without it the site runs
// and simply does not count visits.
const visitsKv = process.env.SMARTLDN_VISITS_KV_ID;

export default defineConfig({
  worker: defineWorker({
    name: "smartldn",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-09-29",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      VISITS: bindings.analyticsEngineDataset({ name: "smartldn_visits" }),
      ...(visitsKv ? { VISIT_COUNTS: bindings.kv({ id: visitsKv }) } : {}),
    },
  }),
});
