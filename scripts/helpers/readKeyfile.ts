import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

export const readKeyfile = (filePath: string): Keypair => {
  if (filePath[0] === "~") {
    filePath = path.join(process.env.HOME as string, filePath.slice(1));
  }

  return Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" })) as number[]
    )
  );
};
