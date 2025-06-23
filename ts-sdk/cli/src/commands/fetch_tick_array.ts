import { fetchMaybeFusionPool, fetchMaybeTickArray, getTickArrayAddress } from "@crypticdot/fusionamm-client";
import BaseCommand, { addressArg } from "../base";
import { rpc } from "../rpc";
import { _TICK_ARRAY_SIZE, getTickArrayStartTickIndex } from "@crypticdot/fusionamm-core";
import { Args } from "@oclif/core";

export default class FetchTickArray extends BaseCommand {
  static override args = {
    pool: addressArg({
      description: "Fusion pool address",
      required: true,
    }),
    tickIndex: Args.integer({
      description: "Tick index",
      required: true,
    }),
  };
  static override description = "Fetch a tick array by tick index";
  static override examples = ["<%= config.bin %> <%= command.id %> 3qx1xPHwQopPXQPPjZDNZ4PnKpQvYeC3s8tPHcC5Ux1V 23000"];

  public async run() {
    const { args } = await this.parse(FetchTickArray);

    console.log(`Fetching fusion pool at address ${args.pool}...`);
    const fusionPool = await fetchMaybeFusionPool(rpc, args.pool);
    if (!fusionPool.exists) {
      throw new Error(`Fusion pool is not found at address ${args.pool}`);
    }
    console.log("Fusion pool:", fusionPool);

    const startTickIndex = getTickArrayStartTickIndex(args.tickIndex, fusionPool.data.tickSpacing);
    const tickArrayAddress = (await getTickArrayAddress(args.pool, startTickIndex))[0];

    console.log(`Fetching TickArray at address ${tickArrayAddress}...`);
    const tickArray = await fetchMaybeTickArray(rpc, tickArrayAddress);
    if (tickArray.exists) {
      console.log("TickArray", tickArray);
      console.log("Ticks:");
      for (let i = 0; i < _TICK_ARRAY_SIZE(); i++) {
        console.log(
          `Index ${i}, Tick ${tickArray.data.startTickIndex + i * fusionPool.data.tickSpacing}:`,
          tickArray.data.ticks[i],
        );
      }
    } else {
      console.log("TickArray doesn't exist");
    }
  }
}
