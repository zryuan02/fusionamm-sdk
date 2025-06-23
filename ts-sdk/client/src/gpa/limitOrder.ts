//
// Copyright (c) Cryptic Dot
//
// Licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

import type { GetProgramAccountsMemcmpFilter, Account, GetProgramAccountsApi, Rpc, Address } from "@solana/kit";
import { getBase58Decoder, getAddressEncoder } from "@solana/kit";
import { LIMIT_ORDER_DISCRIMINATOR, getLimitOrderDecoder, LimitOrder, FUSIONAMM_PROGRAM_ADDRESS } from "../generated";
import { fetchDecodedProgramAccounts } from "./utils";

type LimitOrderFilter = GetProgramAccountsMemcmpFilter & {
  readonly __kind: unique symbol;
};

export function limitOrderFusionPoolFilter(address: Address): LimitOrderFilter {
  return {
    memcmp: {
      offset: 10n,
      bytes: getBase58Decoder().decode(getAddressEncoder().encode(address)),
      encoding: "base58",
    },
  } as LimitOrderFilter;
}

export function limitOrderMintFilter(address: Address): LimitOrderFilter {
  return {
    memcmp: {
      offset: 42n,
      bytes: getBase58Decoder().decode(getAddressEncoder().encode(address)),
      encoding: "base58",
    },
  } as LimitOrderFilter;
}

export async function fetchAllLimitOrderWithFilter(
  rpc: Rpc<GetProgramAccountsApi>,
  ...filters: LimitOrderFilter[]
): Promise<Account<LimitOrder>[]> {
  const discriminator = getBase58Decoder().decode(LIMIT_ORDER_DISCRIMINATOR);
  const discriminatorFilter: GetProgramAccountsMemcmpFilter = {
    memcmp: {
      offset: 0n,
      bytes: discriminator,
      encoding: "base58",
    },
  };
  return fetchDecodedProgramAccounts(
    rpc,
    FUSIONAMM_PROGRAM_ADDRESS,
    [discriminatorFilter, ...filters],
    getLimitOrderDecoder(),
  );
}
