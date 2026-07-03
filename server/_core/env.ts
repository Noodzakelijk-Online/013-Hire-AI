const isProduction = process.env.NODE_ENV === "production";
const readEnv = (name: string) => process.env[name] ?? "";
const readEnvWithLocalFallback = (name: string, fallback: string) => {
  const value = readEnv(name);
  if (value.trim()) return value;
  return isProduction ? "" : fallback;
};

export const ENV = {
  appId: readEnvWithLocalFallback("VITE_APP_ID", "hire-ai-local-dev"),
  cookieSecret: readEnvWithLocalFallback("JWT_SECRET", "hire-ai-local-dev-cookie-secret"),
  databaseUrl: readEnv("DATABASE_URL"),
  oAuthServerUrl: readEnv("OAUTH_SERVER_URL"),
  ownerOpenId: readEnv("OWNER_OPEN_ID"),
  isProduction,
  forgeApiUrl: readEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: readEnv("BUILT_IN_FORGE_API_KEY"),
  autonomousSchedulerEnabled: readEnv("AUTONOMOUS_SCHEDULER_ENABLED").toLowerCase() === "true",
};

export function assertRequiredEnv(names: string[]) {
  const missing = names.filter((name) => !readEnv(name).trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

export function validateProductionEnv() {
  if (!isProduction) return;

  assertRequiredEnv([
    "DATABASE_URL",
    "JWT_SECRET",
    "VITE_APP_ID",
    "OAUTH_SERVER_URL",
    "OWNER_OPEN_ID",
    "BUILT_IN_FORGE_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]);
}
