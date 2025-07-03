import {
  fetchMaybeFusionPool,
  getFusionPoolsConfigAddress,
  getSetClpRewardRateInstruction,
} from "@crypticdot/fusionamm-client";
import { sendTransaction } from "@crypticdot/fusionamm-tx-sender";
import BaseCommand, { addressArg } from "../base";
import { rpc, signer } from "../rpc";
import { Args } from "@oclif/core";

export default class SetClpRewardRate extends BaseCommand {
  static override args = {
    pool: addressArg({
      description: "Fusion pool address",
      required: true,
    }),
    clpRewardRate: Args.integer({
      description:
        "The reward rate for concentrated liquidity providers stored as basis points. The maximum value 10_000 equals to 100%",
      required: true,
      min: 0,
      max: 10_000,
    }),
  };
  static override description =
    "Sets the reward rate for concentrated liquidity providers, generated from limit order swaps.";
  static override examples = ["<%= config.bin %> <%= command.id %> address 5000"];

  public async run() {
    const { args } = await this.parse(SetClpRewardRate);

    const fusionPoolsConfig = (await getFusionPoolsConfigAddress())[0];

    console.log(`Fetching fusion pool at address ${args.pool}...`);
    const fusionPool = await fetchMaybeFusionPool(rpc, args.pool);
    if (fusionPool.exists) {
      console.log("Fusion pool:", fusionPool);
    } else {
      throw new Error(`Fusion pool is not found at address ${args.pool}`);
    }

    const ix = getSetClpRewardRateInstruction({
      fusionPool: args.pool,
      fusionPoolsConfig: fusionPoolsConfig,
      feeAuthority: signer,
      clpRewardRate: args.clpRewardRate,
    });

    console.log("");
    if (fusionPool.data.clpRewardRate != args.clpRewardRate) {
      console.log("Sending a transaction...");
      const signature = await sendTransaction(rpc, [ix], signer);
      console.log("Transaction landed:", signature);
    } else {
      console.log("Nothing to update!");
    }
  }
}
