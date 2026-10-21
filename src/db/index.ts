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
      resolved_outcome TEXT CHECK(resolved_outcome IN ('yes', 'no', 'void')),
      resolution_status TEXT DEFAULT 'open' NOT NULL CHECK(resolution_status IN ('open', 'closed', 'proposed', 'resolved', 'disputed', 'void')),
      proposed_outcome TEXT CHECK(proposed_outcome IN ('yes', 'no', 'void')),
      dispute_until INTEGER,
      evidence_url TEXT,
      evidence_summary TEXT,
      confidence_score REAL,
      dispute_count INTEGER DEFAULT 0 NOT NULL,
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

  // Migrate existing tables gracefully if they already exist
  const alterStatements = [
    "ALTER TABLE markets ADD COLUMN resolution_status TEXT DEFAULT 'open' NOT NULL",
    "ALTER TABLE markets ADD COLUMN proposed_outcome TEXT",
    "ALTER TABLE markets ADD COLUMN dispute_until INTEGER",
    "ALTER TABLE markets ADD COLUMN evidence_url TEXT",
    "ALTER TABLE markets ADD COLUMN evidence_summary TEXT",
    "ALTER TABLE markets ADD COLUMN confidence_score REAL",
    "ALTER TABLE markets ADD COLUMN dispute_count INTEGER DEFAULT 0 NOT NULL",
  ];

  for (const sql of alterStatements) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists or table was freshly initialized
    }
  }

  // Ensure resolved_outcome check constraint allows 'void'
  try {
    await client.execute(
      "INSERT INTO markets (id, title, resolved_outcome) VALUES ('__chk_void__', '__chk__', 'void')"
    );
    await client.execute("DELETE FROM markets WHERE id = '__chk_void__'");
  } catch {
    await client.executeMultiple(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE IF NOT EXISTS markets_migrated (
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
        resolved_outcome TEXT CHECK(resolved_outcome IN ('yes', 'no', 'void')),
        resolution_status TEXT DEFAULT 'open' NOT NULL CHECK(resolution_status IN ('open', 'closed', 'proposed', 'resolved', 'disputed', 'void')),
        proposed_outcome TEXT CHECK(proposed_outcome IN ('yes', 'no', 'void')),
        dispute_until INTEGER,
        evidence_url TEXT,
        evidence_summary TEXT,
        confidence_score REAL,
        dispute_count INTEGER DEFAULT 0 NOT NULL,
        yes_price REAL DEFAULT 0.5 NOT NULL,
        no_price REAL DEFAULT 0.5 NOT NULL,
        volume_usdc REAL DEFAULT 0.0 NOT NULL,
        created_at INTEGER
      );
      INSERT INTO markets_migrated (
        id, title, description, category, creator_wallet, creator_platform_id, platform, chat_id, message_id,
        phase, cutoff_at, resolved_outcome, resolution_status, proposed_outcome, dispute_until, evidence_url,
        evidence_summary, confidence_score, dispute_count, yes_price, no_price, volume_usdc, created_at
      )
      SELECT
        id, title, description, category, creator_wallet, creator_platform_id, platform, chat_id, message_id,
        phase, cutoff_at, resolved_outcome, resolution_status, proposed_outcome, dispute_until, evidence_url,
        evidence_summary, confidence_score, dispute_count, yes_price, no_price, volume_usdc, created_at
      FROM markets;
      DROP TABLE markets;
      ALTER TABLE markets_migrated RENAME TO markets;
      PRAGMA foreign_keys = ON;
    `);
  }
}

export * from "./schema.js";
export * from "./queries.js";
