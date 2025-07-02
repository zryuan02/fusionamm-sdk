//
// Copyright (c) Cryptic Dot
//
// Modification based on Orca Whirlpools (https://github.com/orca-so/whirlpools),
// originally licensed under the Apache License, Version 2.0, prior to February 26, 2025.
//
// Modifications licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

import { findAssociatedTokenPda } from "@solana-program/token";
import { describe, it, beforeAll, expect } from "vitest";
import { closeLimitOrderInstructions, openLimitOrderInstructions, swapInstructions } from "../src";
import { rpc, signer, sendTransaction } from "./utils/mockRpc";
import { setupMint, setupAta } from "./utils/token";
import { fetchFusionPool, fetchLimitOrder, getLimitOrderAddress } from "@crypticdot/fusionamm-client";
import { fetchAllMint, fetchMint, fetchToken } from "@solana-program/token-2022";
import type { Address, KeyPairSigner } from "@solana/kit";
import assert from "assert";
import { setupFusionPool } from "./utils/program";
import { setupAtaTE, setupMintTE, setupMintTEFee } from "./utils/tokenExtensions";
import { sqrtPriceToPrice } from "@crypticdot/fusionamm-core";

const mintTypes = new Map([
  ["A", setupMint],
  ["B", setupMint],
  ["TEA", setupMintTE],
  ["TEB", setupMintTE],
  ["TEFee", setupMintTEFee],
]);

const ataTypes = new Map([
  ["A", setupAta],
  ["B", setupAta],
  ["TEA", setupAtaTE],
  ["TEB", setupAtaTE],
  ["TEFee", setupAtaTE],
]);

const poolTypes = ["A-B", "A-TEA", "TEA-TEB", "A-TEFee"];

describe("Limit Orders", () => {
  const tickSpacing = 64;

  beforeAll(async () => {});

  const testOpenLimitOrder = async (args: {
    poolAddress: Address;
    amount: bigint;
    price: number;
    aToB: boolean;
    signer?: KeyPairSigner;
  }) => {
    const { amount, price, aToB, poolAddress } = args;
    const owner = args.signer ?? signer;

    let fusionPool = await fetchFusionPool(rpc, poolAddress);
    const [mintA, mintB] = await fetchAllMint(rpc, [fusionPool.data.tokenMintA, fusionPool.data.tokenMintB]);

    const ataAAddress = (
      await findAssociatedTokenPda({
        mint: fusionPool.data.tokenMintA,
        owner: owner.address,
        tokenProgram: mintA.programAddress,
      })
    )[0];
    const ataBAddress = (
      await findAssociatedTokenPda({
        mint: fusionPool.data.tokenMintB,
        owner: owner.address,
        tokenProgram: mintB.programAddress,
      })
    )[0];

    const { limitOrderMint, instructions, amountWithFee } = await openLimitOrderInstructions(
      rpc,
      poolAddress,
      amount,
      { price },
      aToB,
    );

    const tokenBeforeA = ataAAddress ? await fetchToken(rpc, ataAAddress) : undefined;
    const tokenBeforeB = ataBAddress ? await fetchToken(rpc, ataBAddress) : undefined;

    await sendTransaction(instructions);

    const limitOrderAddress = await getLimitOrderAddress(limitOrderMint);
    const limitOrder = await fetchLimitOrder(rpc, limitOrderAddress[0]);

    if (ataAAddress && ataBAddress) {
      const tokenAfterA = await fetchToken(rpc, ataAAddress);
      const tokenAfterB = await fetchToken(rpc, ataBAddress);
      const balanceChangeTokenA = tokenBeforeA!.data.amount - tokenAfterA.data.amount;
      const balanceChangeTokenB = tokenBeforeB!.data.amount - tokenAfterB.data.amount;

      assert.strictEqual(aToB ? balanceChangeTokenA : balanceChangeTokenB, amountWithFee);
      assert.strictEqual(aToB ? balanceChangeTokenB : balanceChangeTokenA, 0n);
      assert.strictEqual(limitOrder.data.amount, amount);
      assert.strictEqual(limitOrder.data.aToB, aToB);
    }

    return limitOrder;
  };

  const testCloseLimitOrder = async (args: { limitOrderMint: Address }) => {
    const { limitOrderMint } = args;

    const { instructions } = await closeLimitOrderInstructions(rpc, limitOrderMint);

    await sendTransaction(instructions);
  };

  const testSwapExactInput = async (args: { poolAddress: Address; mint: Address; inputAmount: bigint }) => {
    let { instructions } = await swapInstructions(
      rpc,
      { inputAmount: args.inputAmount, mint: args.mint },
      args.poolAddress,
    );
    await sendTransaction(instructions);
  };

  for (const poolName of poolTypes) {
    it(`Open limit orders, swap and close orders for ${poolName}`, async () => {
      const [mintAName, mintBName] = poolName.split("-");

      const setupMintA = mintTypes.get(mintAName)!;
      const setupMintB = mintTypes.get(mintBName)!;
      const setupAtaA = ataTypes.get(mintAName)!;
      const setupAtaB = ataTypes.get(mintBName)!;

      const mintAAddress = await setupMintA();
      const mintBAddress = await setupMintB();
      const mintA = await fetchMint(rpc, mintAAddress);
      const mintB = await fetchMint(rpc, mintBAddress);
      const ataAAddress = await setupAtaA(mintAAddress, { amount: 100_000_000n });
      const ataBAddress = await setupAtaB(mintBAddress, { amount: 100_000_000n });
      const poolAddress = await setupFusionPool(mintAAddress, mintBAddress, tickSpacing);

      const limitOrdersArgs = [
        { amount: 500_000n, priceOffset: -0.06, aToB: false }, // 1st
        { amount: 500_000n, priceOffset: -0.06, aToB: false }, // 1st
        { amount: 500_000n, priceOffset: -0.1, aToB: false }, // 2nd
        { amount: 500_000n, priceOffset: -0.1, aToB: false }, // 2nd
        { amount: 500_000n, priceOffset: -0.15, aToB: false }, // 3rd
        { amount: 500_000n, priceOffset: -0.15, aToB: false }, // 3rd
        { amount: 500_000n, priceOffset: -0.2, aToB: false }, // 4th
        { amount: 500_000n, priceOffset: -0.2, aToB: false }, // 4th

        { amount: 500_000n, priceOffset: 0.06, aToB: true },
        { amount: 500_000n, priceOffset: 0.06, aToB: true },
        { amount: 500_000n, priceOffset: 0.1, aToB: true },
        { amount: 500_000n, priceOffset: 0.1, aToB: true },
        { amount: 500_000n, priceOffset: 0.15, aToB: true },
        { amount: 500_000n, priceOffset: 0.15, aToB: true },
        { amount: 500_000n, priceOffset: 0.2, aToB: true },
        { amount: 500_000n, priceOffset: 0.2, aToB: true },
      ];

      const orders = [];

      let fusionPool = await fetchFusionPool(rpc, poolAddress);
      let currentPrice = sqrtPriceToPrice(fusionPool.data.sqrtPrice, mintA.data.decimals, mintB.data.decimals);

      for (const args of limitOrdersArgs) {
        orders.push(
          await testOpenLimitOrder({
            ...args,
            price: currentPrice + args.priceOffset,
            poolAddress,
            signer,
          }),
        );
      }

      // The 1st order will be fulfilled, the 2nd - partially filled, the 3rd - not filled.
      await testSwapExactInput({ poolAddress, inputAmount: 1_500_000n, mint: mintAAddress });
      await testSwapExactInput({ poolAddress, inputAmount: 1_500_000n, mint: mintBAddress });

      // Fill 2nd, and partially fill 3rd
      await testSwapExactInput({ poolAddress, inputAmount: 1_000_000n, mint: mintAAddress });
      await testSwapExactInput({ poolAddress, inputAmount: 1_000_000n, mint: mintBAddress });

      fusionPool = await fetchFusionPool(rpc, poolAddress);
      currentPrice = sqrtPriceToPrice(fusionPool.data.sqrtPrice, mintA.data.decimals, mintB.data.decimals);
      //console.log("PRICE =", currentPrice);

      /*
      fusionPool = await fetchFusionPool(rpc, poolAddress);
      poolVaultA = await fetchToken(rpc, fusionPool.data.tokenVaultA);
      poolVaultB = await fetchToken(rpc, fusionPool.data.tokenVaultB);
      console.log(`Pool balance after B->A swap: [${poolVaultA.data.amount}, ${poolVaultB.data.amount}]`);
      console.log("Pool tick after B->A swap", fusionPool.data.tickCurrentIndex);

      for (let i = 0; i < limitOrders.length; i++) {
        const tickArrayStartIndex = getTickArrayStartTickIndex(
          limitOrders[i].data.tickIndex,
          fusionPool.data.tickSpacing,
        );
        const tickArrayAddress = (await getTickArrayAddress(fusionPool.address, tickArrayStartIndex))[0];
        const tickArray = await fetchTickArray(rpc, tickArrayAddress);
        console.log(
          `TICK ${limitOrders[i].data.tickIndex}: `,
          tickArray.data.ticks[(limitOrders[i].data.tickIndex - tickArrayStartIndex) / fusionPool.data.tickSpacing],
        );
      }*/

      for (const args of limitOrdersArgs) {
        orders.push(
          await testOpenLimitOrder({
            ...args,
            price: currentPrice + args.priceOffset,
            poolAddress,
            signer,
          }),
        );
      }

      // The 1st order will be fulfilled, the 2nd - partially filled, the 3rd - not filled.
      await testSwapExactInput({ poolAddress, inputAmount: 1_500_000n, mint: mintAAddress });
      await testSwapExactInput({ poolAddress, inputAmount: 1_500_000n, mint: mintBAddress });

      // Fill 2nd, and partially fill 3rd
      await testSwapExactInput({ poolAddress, inputAmount: 1_000_000n, mint: mintAAddress });
      await testSwapExactInput({ poolAddress, inputAmount: 1_000_000n, mint: mintBAddress });

      fusionPool = await fetchFusionPool(rpc, poolAddress);
      expect(fusionPool.data.protocolFeeOwedA).toEqual(750n);
      expect(fusionPool.data.protocolFeeOwedB).toEqual(poolName == "A-TEFee" ? 741n : 750n);
      expect(fusionPool.data.ordersTotalAmountA).toEqual(8000000n);
      expect(fusionPool.data.ordersTotalAmountB).toEqual(8000000n);

      expect(fusionPool.data.ordersFilledAmountA).toEqual(poolName == "A-TEFee" ? 4380691n : 4422475n);
      expect(fusionPool.data.ordersFilledAmountB).toEqual(4876390n);
      expect(fusionPool.data.olpFeeOwedA).toEqual(754n);
      expect(fusionPool.data.olpFeeOwedB).toEqual(poolName == "A-TEFee" ? 746n : 753n);

      for (const order of orders) {
        await testCloseLimitOrder({
          limitOrderMint: order.data.limitOrderMint,
        });
      }

      fusionPool = await fetchFusionPool(rpc, poolAddress);
      expect(fusionPool.data.protocolFeeOwedA).toEqual(750n);
      expect(fusionPool.data.protocolFeeOwedB).toEqual(poolName == "A-TEFee" ? 741n : 750n);
      expect(fusionPool.data.ordersTotalAmountA).toEqual(0n);
      expect(fusionPool.data.ordersTotalAmountB).toEqual(0n);
      expect(fusionPool.data.ordersFilledAmountA).toEqual(0n);
      expect(fusionPool.data.ordersFilledAmountB).toEqual(0n);
      expect(fusionPool.data.olpFeeOwedA).toEqual(0n);
      expect(fusionPool.data.olpFeeOwedB).toEqual(0n);

      const poolVaultA = await fetchToken(rpc, fusionPool.data.tokenVaultA);
      const poolVaultB = await fetchToken(rpc, fusionPool.data.tokenVaultB);
      expect(poolVaultA.data.amount - fusionPool.data.protocolFeeOwedA).toEqual(6n);
      expect(poolVaultB.data.amount - fusionPool.data.protocolFeeOwedB).toEqual(6n);
    });
  }
});
