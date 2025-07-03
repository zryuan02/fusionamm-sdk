import {
  fetchMaybeFusionPoolsConfig,
  getFusionPoolsConfigAddress,
  getSetDefaultClpRewardRateInstruction,
} from "@crypticdot/fusionamm-client";
import { sendTransaction } from "@crypticdot/fusionamm-tx-sender";
import BaseCommand from "../base";
import { rpc, signer } from "../rpc";
import { Args } from "@oclif/core";

export default class SetDefaultClpRewardRate extends BaseCommand {
  static override args = {
    defaultClpRewardRate: Args.integer({
      description:
        "The default reward rate for concentrated liquidity providers stored as basis points. The maximum value of 10000 equals to 100%",
      required: true,
      min: 0,
      max: 10000,
    }),
  };
  static override description =
    "Sets the default reward rate for concentrated liquidity providers, generated from limit order swaps.";
  static override examples = ["<%= config.bin %> <%= command.id %> address 5000"];

  public async run() {
    const { args } = await this.parse(SetDefaultClpRewardRate);

    const fusionPoolsConfig = (await getFusionPoolsConfigAddress())[0];

    const config = await fetchMaybeFusionPoolsConfig(rpc, fusionPoolsConfig);
    if (config.exists) {
      console.log("Config:", config);
    } else {
      throw new Error("FusionAMM config doesn't exists at address " + fusionPoolsConfig);
    }

    const ix = getSetDefaultClpRewardRateInstruction({
      fusionPoolsConfig,
      feeAuthority: signer,
      defaultClpRewardRate: args.defaultClpRewardRate,
    });

    console.log("");
    if (config.data.defaultClpRewardRate != args.defaultClpRewardRate) {
      console.log("Sending a transaction...");
      const signature = await sendTransaction(rpc, [ix], signer);
      console.log("Transaction landed:", signature);
    } else {
      console.log("Nothing to update!");
    }
  }
}
