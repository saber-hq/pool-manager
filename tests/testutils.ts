import * as anchor from "@project-serum/anchor";
import { makeSaberProvider } from "@saberhq/anchor-contrib";
import { chaiSolana, expectTX } from "@saberhq/chai-solana";
import type { Provider } from "@saberhq/solana-contrib";
import {
  DEFAULT_TOKEN_DECIMALS,
  findSwapAuthorityKey,
} from "@saberhq/stableswap-sdk";
import {
  createMint,
  createTokenAccount,
  SPLToken,
  TOKEN_PROGRAM_ID,
  u64,
} from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import * as chai from "chai";

import { PoolManagerSDK } from "../src/poolManagerSdk";
import type { PoolManagerWrapper } from "../src/wrappers/poolManager";

chai.use(chaiSolana);

function loadProvider(): Provider {
  const ANCHOR_PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL;
  if (!ANCHOR_PROVIDER_URL) {
    throw new Error("no anchor provider URL");
  }
  const anchorProvider = anchor.getProvider();
  const provider = makeSaberProvider(anchorProvider);
  return provider;
}

export const makePoolManagerSDK = (): PoolManagerSDK => {
  const provider = loadProvider();
  return PoolManagerSDK.load({ provider });
};

export const createPool = async (
  provider: Provider,
  minter: Keypair,
  poolManagerWrapper: PoolManagerWrapper,
  initialAmpFactor: u64
): Promise<{
  mintA: PublicKey;
  mintB: PublicKey;
  mintLP: PublicKey;
  pool: PublicKey;
  swapAccount: PublicKey;
}> => {
  const mintA = await createMint(
    provider,
    minter.publicKey,
    DEFAULT_TOKEN_DECIMALS
  );
  const mintB = await createMint(
    provider,
    minter.publicKey,
    DEFAULT_TOKEN_DECIMALS
  );

  const swapAccountSigner = Keypair.generate();
  const [swapAuthority] = await findSwapAuthorityKey(
    swapAccountSigner.publicKey
  );
  const { key: reserveA, tx: tx1 } = await createTokenAccount({
    provider,
    mint: mintA,
    owner: swapAuthority,
  });
  const { key: reserveB, tx: tx2 } = await createTokenAccount({
    provider,
    mint: mintB,
    owner: swapAuthority,
  });
  const setupReservesTx = tx1.combine(tx2);
  setupReservesTx.instructions.push(
    SPLToken.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mintA,
      reserveA,
      minter.publicKey,
      [],
      new u64(DEFAULT_TOKEN_DECIMALS * 1_000)
    )
  );
  setupReservesTx.instructions.push(
    SPLToken.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mintB,
      reserveB,
      minter.publicKey,
      [],
      new u64(DEFAULT_TOKEN_DECIMALS * 1_000)
    )
  );
  setupReservesTx.addSigners(minter);
  await expectTX(setupReservesTx, "set up swap reserves").to.be.fulfilled;

  const mintLP = await createMint(
    provider,
    swapAuthority,
    DEFAULT_TOKEN_DECIMALS
  );

  const {
    poolKey,
    tx: newSwapTx,
    swapAccount,
  } = await poolManagerWrapper.newStableSwap({
    ampFactor: initialAmpFactor,
    swapAccountSigner,
    mintA,
    reserveA,
    mintB,
    reserveB,
    mintLP,
  });
  await expectTX(newSwapTx, "Create new stable swap").to.be.fulfilled;

  return { mintA, mintB, mintLP, pool: poolKey, swapAccount };
};
