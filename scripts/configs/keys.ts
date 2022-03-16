import { PublicKey } from "@solana/web3.js";

const DEFAULT_KEYFILE = "~/.config/solana/id.json";
export const PAYER_KEYPAIR_PATH = process.env.PAYER_KEYFILE ?? DEFAULT_KEYFILE;
export const BUFFER_AUTHORITY_KEYPAIR_PATH =
  process.env.BUFFER_AUTHORITY_KEYFILE ?? DEFAULT_KEYFILE;
export const BUFFER_EXECUTOR_KEYPAIR_PATH =
  process.env.BUFFER_EXECUTOR_KEYFILE ?? DEFAULT_KEYFILE;

export const SMART_WALLET = PublicKey.default;
export const POOL_MANAGER = PublicKey.default;
export const BUFFER_ACCOUNT = PublicKey.default;
