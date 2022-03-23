import { PublicKey } from "@solana/web3.js";

import * as buffersRaw from "../../.configs/buffers.json";

interface BuffersRaw {
  buffers: string[];
}

export const loadBuffers = (): PublicKey[] => {
  const { buffers } = buffersRaw as BuffersRaw;
  if (buffers.length === 0) {
    throw new Error("No buffer found");
  }
  return buffers.map((b) => new PublicKey(b));
};
