//
// Copyright (c) Cryptic Dot
//
// Modification based on Orca Whirlpools (https://github.com/orca-so/whirlpools),
// originally licensed under the Apache License, Version 2.0, prior to February 26, 2025.
//
// Modifications licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

import {
  getInitializePoolInstruction,
  getInitializeTickArrayInstruction,
  getTickArrayAddress,
  getTickArraySize,
  getTokenBadgeAddress,
  getFusionPoolAddress,
  getFusionPoolSize,
  getFusionPoolsConfigAddress,
} from "@crypticdot/fusionamm-client";
import type {
  Address,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  IInstruction,
  Lamports,
  Rpc,
  TransactionSigner,
} from "@solana/kit";
import {generateKeyPairSigner, lamports} from "@solana/kit";
import {fetchSysvarRent} from "@solana/sysvars";
import {DEFAULT_ADDRESS, FUNDER} from "./config";
import {
  getFullRangeTickIndexes,
  getTickArrayStartTickIndex,
  priceToSqrtPrice,
  sqrtPriceToTickIndex,
} from "@crypticdot/fusionamm-core";
import {fetchAllMint} from "@solana-program/token-2022";
import assert from "assert";
import {getTokenSizeForMint, orderMints} from "./token";
import {calculateMinimumBalanceForRentExemption} from "./sysvar";

/**
 * Represents the instructions and metadata for creating a pool.
 */
export type CreatePoolInstructions = {
  /** The list of instructions needed to create the pool. */
  instructions: IInstruction[];

  /** The estimated rent exemption cost for initializing the pool, in lamports. */
  initializationCost: Lamports;

  /** The address of the newly created pool. */
  poolAddress: Address;
};

/**
 * Creates the necessary instructions to initialize a Concentrated Liquidity Pool (CLMM) on FusionAMM.
 *
 * @param {SolanaRpc} rpc - A Solana RPC client for communicating with the blockchain.
 * @param {Address} tokenMintA - The first token mint address to include in the pool.
 * @param {Address} tokenMintB - The second token mint address to include in the pool.
 * @param {number} tickSpacing - The spacing between price ticks for the pool.
 * @param {number} feeRate - The fee rate for the pool.
 * @param {number} [initialPrice=1] - The initial price of token 1 in terms of token 2.
 * @param {TransactionSigner} [funder=FUNDER] - The account that will fund the initialization process.
 *
 * @returns {Promise<CreatePoolInstructions>} A promise that resolves to an object containing the pool creation instructions, the estimated initialization cost, and the pool address.
 *
 * @example
 * import { createConcentratedLiquidityPoolInstructions, setFusionPoolsConfig } from '@crypticdot/fusionamm';
 * import { generateKeyPairSigner, createSolanaRpc, devnet, address } from '@solana/kit';
 *
 * await setFusionPoolsConfig('solanaDevnet');
 * const devnetRpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));
 * const wallet = await generateKeyPairSigner(); // CAUTION: This wallet is not persistent.
 *
 * const tokenMintOne = address("So11111111111111111111111111111111111111112");
 * const tokenMintTwo = address("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"); // devUSDC
 * const tickSpacing = 64;
 * const feeRate = 300;
 * const initialPrice = 0.01;
 *
 * const { poolAddress, instructions, initializationCost } = await createFusionPoolInstructions(
 *     devnetRpc,
 *     tokenMintOne,
 *     tokenMintTwo,
 *     tickSpacing,
 *     feeRate,
 *     initialPrice,
 *     wallet
 * );
 *
 * console.log(`Pool Address: ${poolAddress}`);
 * console.log(`Initialization Cost: ${initializationCost} lamports`);
 */
export async function createFusionPoolInstructions(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>,
  tokenMintA: Address,
  tokenMintB: Address,
  tickSpacing: number,
  feeRate: number,
  initialPrice: number = 1,
  funder: TransactionSigner = FUNDER,
): Promise<CreatePoolInstructions> {
  assert(funder.address !== DEFAULT_ADDRESS, "Either supply a funder or set the default funder");
  assert(
    orderMints(tokenMintA, tokenMintB)[0] === tokenMintA,
    "Token order needs to be flipped to match the canonical ordering (i.e. sorted on the byte repr. of the mint pubkeys)",
  );
  const instructions: IInstruction[] = [];

  const rent = await fetchSysvarRent(rpc);
  let nonRefundableRent: bigint = 0n;

  // Since TE mint data is an extension of T mint data, we can use the same fetch function
  const [mintA, mintB] = await fetchAllMint(rpc, [tokenMintA, tokenMintB]);
  const decimalsA = mintA.data.decimals;
  const decimalsB = mintB.data.decimals;
  const tokenProgramA = mintA.programAddress;
  const tokenProgramB = mintB.programAddress;

  const initialSqrtPrice = priceToSqrtPrice(initialPrice, decimalsA, decimalsB);

  const [fusionPoolsConfig, poolAddress, tokenBadgeA, tokenBadgeB, tokenVaultA, tokenVaultB] = await Promise.all([
    getFusionPoolsConfigAddress().then(x => x[0]),
    getFusionPoolAddress(tokenMintA, tokenMintB, tickSpacing).then(x => x[0]),
    getTokenBadgeAddress(tokenMintA).then(x => x[0]),
    getTokenBadgeAddress(tokenMintB).then(x => x[0]),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);

  instructions.push(
    getInitializePoolInstruction({
      fusionPoolsConfig,
      tokenMintA,
      tokenMintB,
      tokenBadgeA,
      tokenBadgeB,
      funder,
      fusionPool: poolAddress,
      tokenVaultA,
      tokenVaultB,
      tokenProgramA,
      tokenProgramB,
      feeRate,
      tickSpacing,
      initialSqrtPrice,
    }),
  );

  nonRefundableRent += calculateMinimumBalanceForRentExemption(rent, getTokenSizeForMint(mintA));
  nonRefundableRent += calculateMinimumBalanceForRentExemption(rent, getTokenSizeForMint(mintB));
  nonRefundableRent += calculateMinimumBalanceForRentExemption(rent, getFusionPoolSize());

  const fullRange = getFullRangeTickIndexes(tickSpacing);
  const lowerTickIndex = getTickArrayStartTickIndex(fullRange.tickLowerIndex, tickSpacing);
  const upperTickIndex = getTickArrayStartTickIndex(fullRange.tickUpperIndex, tickSpacing);
  const initialTickIndex = sqrtPriceToTickIndex(initialSqrtPrice);
  const currentTickIndex = getTickArrayStartTickIndex(initialTickIndex, tickSpacing);

  const tickArrayIndexes = Array.from(new Set([lowerTickIndex, upperTickIndex, currentTickIndex]));

  const tickArrayAddresses = await Promise.all(
    tickArrayIndexes.map(x => getTickArrayAddress(poolAddress, x).then(x => x[0])),
  );

  for (let i = 0; i < tickArrayIndexes.length; i++) {
    instructions.push(
      getInitializeTickArrayInstruction({
        fusionPool: poolAddress,
        funder,
        tickArray: tickArrayAddresses[i],
        startTickIndex: tickArrayIndexes[i],
      }),
    );
    nonRefundableRent += calculateMinimumBalanceForRentExemption(rent, getTickArraySize());
  }

  return {
    instructions,
    poolAddress,
    initializationCost: lamports(nonRefundableRent),
  };
}
