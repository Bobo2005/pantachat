import { Keypair, Connection } from "@solana/web3.js";

const STAGING_URL = "https://staging-api.panta.market/api/v1";

async function testWithRealKeypair() {
  const kp = Keypair.generate();
  const walletPubkey = kp.publicKey.toBase58();
  console.log(`Generated fresh Devnet wallet: ${walletPubkey}`);

  const reg = await (await fetch(`${STAGING_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `t_${Date.now()}@ex.com`, password: "Password123!" }),
  })).json();
  const token = reg.access;

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 3700;
  const endTime = startTime + 86400;
  const resolutionTime = endTime + 3600;

  const payload = {
    wallet: walletPubkey,
    question: `Will Alpha ${Math.random().toString(36).slice(2)} reach target in 2027?`,
    resolutionRule: "Resolves to YES if target is reached. NO otherwise.",
    sourcesOfTruth: ["https://coingecko.com"],
    category: "crypto",
    startTime,
    endTime,
    resolutionTime,
    imageUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
  };

  const res = await fetch(`${STAGING_URL}/markets/create/quote/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  console.log(`Status: ${res.status}`);
  console.log(`Data:`, await res.text());
}

testWithRealKeypair();
