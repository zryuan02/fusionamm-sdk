import {
  fetchMaybeFusionPoolsConfig,
  getSetDefaultLimitOrderProtocolFeeRateInstruction,
} from "@crypticdot/fusionamm-client";
import { sendTransaction } from "@crypticdot/fusionamm-tx-sender";
import BaseCommand, { addressArg } from "../base";
import { rpc, signer } from "../rpc";
import { Args } from "@oclif/core";

export default class SetDefaultOrderProtocolFeeRate extends BaseCommand {
  static override args = {
    fusionPoolsConfig: addressArg({
      description: "FusionAMM config address",
      required: true,
    }),
    defaultOrderProtocolFeeRate: Args.integer({
      description:
        "Limit order fee rate stored as hundredths of a basis point. The maximum value approximately equals to 6.55%",
      required: true,
      min: 0,
      max: 60000,
    }),
  };
  static override description = "Set the default limit order protocol fee rate";
  static override examples = ["<%= config.bin %> <%= command.id %> address 100"];

  public async run() {
    const { args } = await this.parse(SetDefaultOrderProtocolFeeRate);

    const config = await fetchMaybeFusionPoolsConfig(rpc, args.fusionPoolsConfig);
    if (config.exists) {
      console.log("Config:", config);
    } else {
      throw new Error("FusionAMM config doesn't exists at address " + args.fusionPoolsConfig);
    }

    const ix = getSetDefaultLimitOrderProtocolFeeRateInstruction({
      fusionPoolsConfig: args.fusionPoolsConfig,
      feeAuthority: signer,
      defaultOrderProtocolFeeRate: args.defaultOrderProtocolFeeRate,
    });

    console.log("");
    if (config.data.defaultOrderProtocolFeeRate != args.defaultOrderProtocolFeeRate) {
      console.log("Sending a transaction...");
      const signature = await sendTransaction(rpc, [ix], signer);
      console.log("Transaction landed:", signature);
    } else {
      console.log("Nothing to update!");
    }
  }
}
