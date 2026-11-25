import { loadDotEnv, getRuntimeConfig } from "./env.js";
import { buildApp } from "./app.js";

loadDotEnv();
const config = getRuntimeConfig();

const { app } = buildApp();

app.listen({ port: config.port, host: config.host })
  .then(() => {
    console.log(
      `Sahayak Engine API listening on http://${config.host}:${config.port} (llm=${config.llm ? config.llm.provider : "none"}, twilio=${config.twilio ? "configured" : "none"})`,
    );
  })
  .catch((err) => {
    console.error("Failed to start server:", err instanceof Error ? err.message : "unknown_error");
    process.exit(1);
  });
