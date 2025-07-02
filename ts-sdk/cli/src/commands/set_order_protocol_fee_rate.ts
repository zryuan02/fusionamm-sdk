import {
  fetchMaybeFusionPool,
  getFusionPoolsConfigAddress,
  getSetOrderProtocolFeeRateInstruction,
} from "@crypticdot/fusionamm-client";
import { sendTransaction } from "@crypticdot/fusionamm-tx-sender";
import BaseCommand, { addressArg } from "../base";
import { rpc, signer } from "../rpc";
import { Args } from "@oclif/core";

export default class SetOrderProtocolFeeRate extends BaseCommand {
  static override args = {
    pool: addressArg({
      description: "Fusion pool address",
      required: true,
    }),
    orderProtocolFeeRate: Args.integer({
      description: "Limit order protocol fee rate stored as basis points. The maximum value 10_000 equals to 100%",
      required: true,
      min: 0,
      max: 10_000,
    }),
  };
  static override description = "Set the limit order protocol fee rate of a pool";
  static override examples = ["<%= config.bin %> <%= command.id %> address 5000"];

  public async run() {
    const { args } = await this.parse(SetOrderProtocolFeeRate);

    const fusionPoolsConfig = (await getFusionPoolsConfigAddress())[0];

    console.log(`Fetching fusion pool at address ${args.pool}...`);
    const fusionPool = await fetchMaybeFusionPool(rpc, args.pool);
    if (fusionPool.exists) {
      console.log("Fusion pool:", fusionPool);
    } else {
      throw new Error(`Fusion pool is not found at address ${args.pool}`);
    }

    const ix = getSetOrderProtocolFeeRateInstruction({
      fusionPool: args.pool,
      fusionPoolsConfig: fusionPoolsConfig,
      feeAuthority: signer,
      orderProtocolFeeRate: args.orderProtocolFeeRate,
    });

    console.log("");
    if (fusionPool.data.orderProtocolFeeRate != args.orderProtocolFeeRate) {
      console.log("Sending a transaction...");
      const signature = await sendTransaction(rpc, [ix], signer);
      console.log("Transaction landed:", signature);
    } else {
      console.log("Nothing to update!");
    }
  }
}
