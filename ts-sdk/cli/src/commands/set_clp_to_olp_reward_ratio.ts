import {
  fetchMaybeFusionPool,
  getFusionPoolsConfigAddress,
  getSetClpToOlpRewardRatioInstruction,
} from "@crypticdot/fusionamm-client";
import { sendTransaction } from "@crypticdot/fusionamm-tx-sender";
import BaseCommand, { addressArg } from "../base";
import { rpc, signer } from "../rpc";
import { Args } from "@oclif/core";

export default class SetClpToOlpRewardRatio extends BaseCommand {
  static override args = {
    pool: addressArg({
      description: "Fusion pool address",
      required: true,
    }),
    clpToOlpRewardRatio: Args.integer({
      description:
        "The reward ratio of concentrated liquidity providers to limit orders' liquidity providers. The maximum value 10_000 equals to 100%",
      required: true,
      min: 0,
      max: 10_000,
    }),
  };
  static override description =
    "Set the reward ratio of concentrated liquidity providers to limit orders' liquidity providers";
  static override examples = ["<%= config.bin %> <%= command.id %> address 5000"];

  public async run() {
    const { args } = await this.parse(SetClpToOlpRewardRatio);

    const fusionPoolsConfig = (await getFusionPoolsConfigAddress())[0];

    console.log(`Fetching fusion pool at address ${args.pool}...`);
    const fusionPool = await fetchMaybeFusionPool(rpc, args.pool);
    if (fusionPool.exists) {
      console.log("Fusion pool:", fusionPool);
    } else {
      throw new Error(`Fusion pool is not found at address ${args.pool}`);
    }

    const ix = getSetClpToOlpRewardRatioInstruction({
      fusionPool: args.pool,
      fusionPoolsConfig: fusionPoolsConfig,
      feeAuthority: signer,
      clpToOlpRewardRatio: args.clpToOlpRewardRatio,
    });

    console.log("");
    if (fusionPool.data.clpToOlpRewardRatio != args.clpToOlpRewardRatio) {
      console.log("Sending a transaction...");
      const signature = await sendTransaction(rpc, [ix], signer);
      console.log("Transaction landed:", signature);
    } else {
      console.log("Nothing to update!");
    }
  }
}
