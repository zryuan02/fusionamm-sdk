//
// Copyright (c) Cryptic Dot
//
// Modification based on Orca Whirlpools (https://github.com/orca-so/whirlpools),
// originally licensed under the Apache License, Version 2.0, prior to February 26, 2025.
//
// Modifications licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

#![allow(non_snake_case)]

#[cfg(feature = "wasm")]
use fusionamm_macros::wasm_expose;

/// The denominator of the fee rate value.
#[cfg_attr(feature = "wasm", wasm_expose)]
pub const FEE_RATE_DENOMINATOR: u32 = 1_000_000;

// TODO: WASM export (which doesn't work with u128 yet)

/// The minimum sqrt price for a fusion_pool.
pub const MIN_SQRT_PRICE: u128 = 4295048016;

/// The maximum sqrt price for a fusion_pool.
pub const MAX_SQRT_PRICE: u128 = 79226673515401279992447579055;

pub const MAX_CLP_TO_OLP_REWARD_RATIO: u16 = 10_000;

pub const PROTOCOL_FEE_RATE_MUL_VALUE: u128 = 10_000;
