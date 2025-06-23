//
// Copyright (c) Cryptic Dot
//
// Modification based on Orca Whirlpools (https://github.com/orca-so/whirlpools),
// originally licensed under the Apache License, Version 2.0, prior to February 26, 2025.
//
// Modifications licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

import { describe, it, beforeAll } from "vitest";
import { rpc } from "./utils/mockRpc";
import assert from "assert";
import {
  fetchFusionPoolByTokenPairAndTickSpacing,
  fetchFusionPoolsByTokenPair,
  FUSIONPOOLS_CONFIG_ADDRESS,
} from "../src";
import type { Address } from "@solana/kit";
import { setupMint } from "./utils/token";
import { setupFusionPool } from "./utils/program";

describe("Fetch Pool", () => {
  let mintA: Address;
  let mintB: Address;
  let concentratedPool: Address;

  beforeAll(async () => {
    mintA = await setupMint();
    mintB = await setupMint();
    concentratedPool = await setupFusionPool(mintA, mintB, 64);
  });

  it("Should be able to fetch a concentrated liquidity pool", async () => {
    const pool = await fetchFusionPoolByTokenPairAndTickSpacing(rpc, mintA, mintB, 64);
    assert.strictEqual(pool.data.liquidity, 0n);
    assert.strictEqual(pool.data.tickSpacing, 64);
    assert.strictEqual(pool.address, concentratedPool);
    assert.strictEqual(pool.data.tokenMintA, mintA);
    assert.strictEqual(pool.data.tokenMintB, mintB);
    assert.strictEqual(pool.data.feeRate, 300);
    assert.strictEqual(pool.data.protocolFeeRate, 100);
  });

  it.skip("Should be able to fetch all pools for a pair", async () => {
    const pools = await fetchFusionPoolsByTokenPair(rpc, mintA, mintB);
    assert.strictEqual(pools.length, 1);
    assert.strictEqual(pools[0].data.tickSpacing, 64);
  });
});
