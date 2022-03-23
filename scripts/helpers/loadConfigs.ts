import type { Network } from "@saberhq/solana-contrib";
import type { Keypair } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import * as keysRaw from "../../.configs/keys.json";
import * as rpcRaw from "../../.configs/rpc.json";
import { readKeyfile } from "./readKeyfile";
interface KeysRaw {
  smartWallet: string;
  poolManager: string;
  payerKeyfile: string;
  bufferAuthorityKeyfile: string;
  executorAuthorityKeyfile: string;
}

export interface KeysConfig {
  smartWallet: PublicKey;
  poolManager: PublicKey;
  payerKP: Keypair;
  bufferAuthorityKP: Keypair;
  executorAuthorityKP: Keypair;
}

export interface RpcUrls {
  localnet: string;
  devnet: string;
  testnet: string;
  ["mainnet-beta"]: string;
}

export const loadKeyConfigs = (): KeysConfig => {
  const keys = keysRaw as KeysRaw;
  return {
    smartWallet: new PublicKey(keys.smartWallet),
    poolManager: new PublicKey(keys.poolManager),
    payerKP: readKeyfile(keys.payerKeyfile),
    bufferAuthorityKP: readKeyfile(keys.bufferAuthorityKeyfile),
    executorAuthorityKP: readKeyfile(keys.executorAuthorityKeyfile),
  };
};

export const loadRpcURL = (network: Network): string => {
  const rpcUrls = rpcRaw as RpcUrls;
  return rpcUrls[network];
};

export const getRpcUrl = (): string => {
  const network = (process.env.NETWORK as Network) ?? "devnet";
  return loadRpcURL(network);
};
