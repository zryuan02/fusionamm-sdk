import { fetchMaybeFusionPoolsConfig, getSetDefaultProtocolFeeRateInstruction } from "@crypticdot/fusionamm-client";
import { sendTransaction } from "@crypticdot/fusionamm-tx-sender";
import BaseCommand, { addressArg } from "../base";
import { rpc, signer } from "../rpc";
import { Args } from "@oclif/core";

export default class SetDefaultProtocolFeeRate extends BaseCommand {
  static override args = {
    fusionPoolsConfig: addressArg({
      description: "FusionAMM config address",
      required: true,
    }),
    defaultProtocolFeeRate: Args.integer({
      description: "Portion of fee rate taken stored as basis points. The maximum value equals to 100%",
      required: true,
      min: 0,
      max: 2500,
    }),
  };
  static override description = "Set the default protocol fee rate";
  static override examples = ["<%= config.bin %> <%= command.id %> address 100"];

  public async run() {
    const { args } = await this.parse(SetDefaultProtocolFeeRate);

    const config = await fetchMaybeFusionPoolsConfig(rpc, args.fusionPoolsConfig);
    if (config.exists) {
      console.log("Config:", config);
    } else {
      throw new Error("FusionAMM config doesn't exists at address " + args.fusionPoolsConfig);
    }

    const ix = getSetDefaultProtocolFeeRateInstruction({
      fusionPoolsConfig: args.fusionPoolsConfig,
      feeAuthority: signer,
      defaultProtocolFeeRate: args.defaultProtocolFeeRate,
    });

    console.log("");
    if (config.data.defaultProtocolFeeRate != args.defaultProtocolFeeRate) {
      console.log("Sending a transaction...");
      const signature = await sendTransaction(rpc, [ix], signer);
      console.log("Transaction landed:", signature);
    } else {
      console.log("Nothing to update!");
    }
  }
}
