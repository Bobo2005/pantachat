import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

// =============================================================================
// Environment Presets (Single-Toggle Multi-Property Environment Architecture)
// =============================================================================

export interface EnvironmentPreset {
  name: "staging" | "production";
  apiBaseUrl: string;
  solanaNetwork: "devnet" | "mainnet";
  solanaRpcUrl: string;
  usdcMint: string;
  explorerUrlPrefix: string;
  isTest: boolean;
  label: string;
}

export const ENV_PRESETS: Record<"staging" | "production", EnvironmentPreset> = {
  staging: {
    name: "staging",
    apiBaseUrl: "https://live-api.panta.market/api/v1",
    solanaNetwork: "devnet",
    solanaRpcUrl: "https://api.devnet.solana.com",
    usdcMint: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    explorerUrlPrefix: "https://explorer.solana.com/?cluster=devnet",
    isTest: true,
    label: "🧪 Test Mode (Sandbox / Devnet)",
  },
  production: {
    name: "production",
    apiBaseUrl: "https://live-api.panta.market/api/v1",
    solanaNetwork: "mainnet",
    solanaRpcUrl: "https://api.mainnet-beta.solana.com",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    explorerUrlPrefix: "https://solscan.io",
    isTest: false,
    label: "Live Mainnet",
  },
};

export const envSchema = z.object({
  // Master Environment Switch: "staging" (Test/Sandbox) or "production" (Live Mainnet)
  PANTA_ENV: z
    .enum(["staging", "production"])
    .default("staging"),

  // Optional overrides (fallback to preset if omitted)
  PANTA_API_BASE_URL: z
    .string()
    .url("PANTA_API_BASE_URL must be a valid URL")
    .optional(),
  PANTA_API_KEY: z
    .string()
    .min(1, "PANTA_API_KEY is required"),
  SOLANA_RPC_URL: z
    .string()
    .url("SOLANA_RPC_URL must be a valid URL")
    .optional(),
  SOLANA_NETWORK: z
    .enum(["devnet", "mainnet"])
    .optional(),

  // Bot Credentials
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .min(1, "TELEGRAM_BOT_USERNAME is required"),
  DISCORD_BOT_TOKEN: z
    .string()
    .min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_CLIENT_ID: z
    .string()
    .min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_GUILD_ID: z
    .string()
    .optional(),

  // AI Key & Model
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z
    .string()
    .default("claude-sonnet-5-5"),

  // Server & Data Layer
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3001),
  WEBAPP_URL: z
    .string()
    .url("WEBAPP_URL must be a valid URL")
    .default("https://pantachat.market"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default("file:./pantachat.db"),
});

export type RawConfig = z.infer<typeof envSchema>;

export interface Config extends RawConfig {
  PANTA_API_BASE_URL: string;
  SOLANA_RPC_URL: string;
  SOLANA_NETWORK: "devnet" | "mainnet";
  USDC_MINT: string;
  EXPLORER_URL_PREFIX: string;
  IS_TEST: boolean;
  ENV_LABEL: string;
}

function parseConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formattedErrors = Object.entries(result.error.flatten().fieldErrors)
      .map(([key, errors]) => `  - ${key}: ${errors?.join(", ")}`)
      .join("\n");
    console.error(`❌ Invalid environment variables:\n${formattedErrors}`);
    throw new Error(`Environment validation failed. Please check your .env file.\n${formattedErrors}`);
  }

  const raw = result.data;
  const preset = ENV_PRESETS[raw.PANTA_ENV];

  // Telegram Bot API strictly requires a valid public HTTPS URL (rejects localhost and http://)
  let webappUrl = raw.WEBAPP_URL;
  if (webappUrl.includes("localhost") || webappUrl.includes("127.0.0.1")) {
    webappUrl = "https://pantachat.market";
  } else if (webappUrl.startsWith("http://")) {
    webappUrl = webappUrl.replace(/^http:\/\//, "https://");
  }

  return {
    ...raw,
    WEBAPP_URL: webappUrl,
    PANTA_API_BASE_URL: raw.PANTA_API_BASE_URL || preset.apiBaseUrl,
    SOLANA_RPC_URL: raw.SOLANA_RPC_URL || preset.solanaRpcUrl,
    SOLANA_NETWORK: raw.SOLANA_NETWORK || preset.solanaNetwork,
    USDC_MINT: preset.usdcMint,
    EXPLORER_URL_PREFIX: preset.explorerUrlPrefix,
    IS_TEST: preset.isTest,
    ENV_LABEL: preset.label,
  };
}

export const config: Config = parseConfig();
