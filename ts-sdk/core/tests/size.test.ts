//
// Copyright (c) Cryptic Dot
//
// Modification based on Orca Whirlpools (https://github.com/orca-so/whirlpools),
// originally licensed under the Apache License, Version 2.0, prior to February 26, 2025.
//
// Modifications licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

import { execSync } from "child_process";
import { describe, it } from "vitest";

// FIXME: Renable this test when we remove stdlib from the wasm binary.

const WASM_SIZE_LIMIT = 25000; // 25KB

describe("Bundle size", () => {
  it.skip("nodejs", () => {
    const output = execSync("gzip -c dist/nodejs/fusionamm_core_js_bindings_bg.wasm | wc -c").toString();
    const size = parseInt(output);
    if (size > WASM_SIZE_LIMIT) {
      throw new Error(`Bundle size ${size} exceeds limit of ${WASM_SIZE_LIMIT}`);
    }
  });

  it.skip("browser", () => {
    const output = execSync("gzip -c dist/browser/fusionamm_core_js_bindings_bg.wasm | wc -c").toString();
    const size = parseInt(output);
    if (size > WASM_SIZE_LIMIT) {
      throw new Error(`Bundle size ${size} exceeds limit of ${WASM_SIZE_LIMIT}`);
    }
  });
});
