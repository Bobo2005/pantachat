import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { config } from "../config.js";
import * as schema from "./schema.js";

// Ensure URL has file: protocol for local SQLite file
const rawUrl = config.DATABASE_URL || "file:./pantachat.db";
const url = rawUrl.startsWith("file:") ? rawUrl : `file:${rawUrl}`;

export const client: Client = createClient({ url });

export const db = drizzle(client, { schema });

/**
 * Ensures required SQLite tables exist at startup.
 */
export async function initTables(): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      creator_wallet TEXT,
      creator_platform_id TEXT,
      platform TEXT CHECK(platform IN ('telegram', 'discord')),
      chat_id TEXT,
      message_id TEXT,
      phase TEXT DEFAULT 'primary' NOT NULL CHECK(phase IN ('primary', 'secondary', 'resolved')),
      cutoff_at INTEGER,
      resolved_outcome TEXT CHECK(resolved_outcome IN ('yes', 'no')),
      yes_price REAL DEFAULT 0.5 NOT NULL,
      no_price REAL DEFAULT 0.5 NOT NULL,
      volume_usdc REAL DEFAULT 0.0 NOT NULL,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      market_id TEXT REFERENCES markets(id),
      wallet_address TEXT,
      platform_user_id TEXT,
      platform TEXT CHECK(platform IN ('telegram', 'discord')),
      chat_id TEXT,
      outcome TEXT CHECK(outcome IN ('yes', 'no')),
      spend_usdc REAL,
      shares REAL,
      tx_signature TEXT UNIQUE,
      reported_to_panta INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('create', 'buy', 'claim', 'claim_creator')),
      market_id TEXT,
      platform_user_id TEXT,
      chat_id TEXT,
      platform TEXT CHECK(platform IN ('telegram', 'discord')),
      payload_json TEXT,
      status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'signed', 'confirmed', 'failed', 'expired')),
      created_at INTEGER,
      expires_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(platform_user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  `);
}

export * from "./schema.js";
export * from "./queries.js";
