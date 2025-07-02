import {
  fetchMaybeFusionPoolsConfig,
  getFusionPoolsConfigAddress,
  getSetDefaultClpToOlpRewardRatioInstruction,
} from "@crypticdot/fusionamm-client";
import { sendTransaction } from "@crypticdot/fusionamm-tx-sender";
import BaseCommand from "../base";
import { rpc, signer } from "../rpc";
import { Args } from "@oclif/core";

export default class SetDefaultClpToOlpRewardRatio extends BaseCommand {
  static override args = {
    defaultClpToOlpRewardRatio: Args.integer({
      description: "The default CLP to OLP reward ratio. The maximum value of 10000 equals to 100%",
      required: true,
      min: 0,
      max: 10000,
    }),
  };
  static override description =
    "Set the default reward ratio of concentrated liquidity providers to limit orders' liquidity providers";
  static override examples = ["<%= config.bin %> <%= command.id %> address 5000"];

  public async run() {
    const { args } = await this.parse(SetDefaultClpToOlpRewardRatio);

    const fusionPoolsConfig = (await getFusionPoolsConfigAddress())[0];

    const config = await fetchMaybeFusionPoolsConfig(rpc, fusionPoolsConfig);
    if (config.exists) {
      console.log("Config:", config);
    } else {
      throw new Error("FusionAMM config doesn't exists at address " + fusionPoolsConfig);
    }

    const ix = getSetDefaultClpToOlpRewardRatioInstruction({
      fusionPoolsConfig,
      feeAuthority: signer,
      defaultClpToOlpRewardRatio: args.defaultClpToOlpRewardRatio,
    });

    console.log("");
    if (config.data.defaultClpToOlpRewardRatio != args.defaultClpToOlpRewardRatio) {
      console.log("Sending a transaction...");
      const signature = await sendTransaction(rpc, [ix], signer);
      console.log("Transaction landed:", signature);
    } else {
      console.log("Nothing to update!");
    }
  }
}
