import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// -----------------------------------------------------------------------------
// Markets Table
// -----------------------------------------------------------------------------
export const markets = sqliteTable("markets", {
  // Panta market ID or local UUID
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  creatorWallet: text("creator_wallet"),
  creatorPlatformId: text("creator_platform_id"),
  platform: text("platform", { enum: ["telegram", "discord"] }),
  chatId: text("chat_id"),
  messageId: text("message_id"),
  phase: text("phase", { enum: ["primary", "secondary", "resolved"] })
    .default("primary")
    .notNull(),
  cutoffAt: integer("cutoff_at"),
  resolvedOutcome: text("resolved_outcome", { enum: ["yes", "no"] }),
  yesPrice: real("yes_price").default(0.5).notNull(),
  noPrice: real("no_price").default(0.5).notNull(),
  volumeUsdc: real("volume_usdc").default(0.0).notNull(),
  createdAt: integer("created_at"),
});

export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;

// -----------------------------------------------------------------------------
// Trades Table
// -----------------------------------------------------------------------------
export const trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  marketId: text("market_id").references(() => markets.id),
  walletAddress: text("wallet_address"),
  platformUserId: text("platform_user_id"),
  platform: text("platform", { enum: ["telegram", "discord"] }),
  chatId: text("chat_id"),
  outcome: text("outcome", { enum: ["yes", "no"] }),
  spendUsdc: real("spend_usdc"),
  shares: real("shares"),
  txSignature: text("tx_signature").unique(),
  reportedToPanta: integer("reported_to_panta").default(0).notNull(),
  createdAt: integer("created_at"),
});

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

// -----------------------------------------------------------------------------
// Sessions Table
// -----------------------------------------------------------------------------
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: ["create", "buy", "claim", "claim_creator"],
  }).notNull(),
  marketId: text("market_id"),
  platformUserId: text("platform_user_id"),
  chatId: text("chat_id"),
  platform: text("platform", { enum: ["telegram", "discord"] }),
  payloadJson: text("payload_json"),
  status: text("status", {
    enum: ["pending", "signed", "confirmed", "failed", "expired"],
  })
    .default("pending")
    .notNull(),
  createdAt: integer("created_at"),
  expiresAt: integer("expires_at"),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
