//
// Copyright (c) Cryptic Dot
//
// Modification based on Orca Whirlpools (https://github.com/orca-so/whirlpools),
// originally licensed under the Apache License, Version 2.0, prior to February 26, 2025.
//
// Modifications licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

import type { GetProgramAccountsMemcmpFilter, Address, Account, GetProgramAccountsApi, Rpc } from "@solana/kit";
import { getBase58Decoder, getAddressEncoder } from "@solana/kit";
import type { TokenBadge } from "../generated/accounts/tokenBadge";
import { TOKEN_BADGE_DISCRIMINATOR, getTokenBadgeDecoder } from "../generated/accounts/tokenBadge";
import { fetchDecodedProgramAccounts } from "./utils";
import { FUSIONAMM_PROGRAM_ADDRESS } from "../generated/programs/fusionamm";

export type TokenBadgeFilter = GetProgramAccountsMemcmpFilter & {
  readonly __kind: unique symbol;
};

export function tokenBadgeFusionPoolsConfigFilter(address: Address): TokenBadgeFilter {
  return {
    memcmp: {
      offset: 8n,
      bytes: getBase58Decoder().decode(getAddressEncoder().encode(address)),
      encoding: "base58",
    },
  } as TokenBadgeFilter;
}

export function tokenBadgeTokenMintFilter(address: Address): TokenBadgeFilter {
  return {
    memcmp: {
      offset: 40n,
      bytes: getBase58Decoder().decode(getAddressEncoder().encode(address)),
      encoding: "base58",
    },
  } as TokenBadgeFilter;
}

export async function fetchAllTokenBadgeWithFilter(
  rpc: Rpc<GetProgramAccountsApi>,
  ...filters: TokenBadgeFilter[]
): Promise<Account<TokenBadge>[]> {
  const discriminator = getBase58Decoder().decode(TOKEN_BADGE_DISCRIMINATOR);
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
    getTokenBadgeDecoder(),
  );
}
