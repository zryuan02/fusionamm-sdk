# FusionAMM Transaction Sender Library

A TypeScript package for building and sending Solana transactions with support for priority fees and Jito
tips.

## Key Features

- Main entry point `sendTransaction()` handles transaction building, signing, and confirmation
- Built-in support for priority fees and Jito MEV tips
- Configurable compute unit margin multiplier to ensure sufficient compute budget

## Example

```ts
import {createKeyPairFromBytes, createSolanaRpc, createSignerFromKeyPair} from "@solana/kit";
import {sendTransaction} from "@crypticdot/fusionamm-tx-sender";

const kp = await createKeyPairFromBytes(new Uint8Array([1, 2, 3, 4, ...]));
const signer = await createSignerFromKeyPair(kp);

// Initialize RPC connection
export const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");

const txHash = await sendTransaction(
  rpc,
  [instruction1, instruction2],
  keypairSigner
);
```

## License

The code in this repository is licensed under the **FusionAMM SDK Source-Available License v1.0**.  
See [`LICENSE`](LICENSE) for full terms.

The repository includes portions of code originally licensed under the Apache License 2.0 by Orca.so
(https://github.com/orca-so/whirlpools,
commit [e528dd2](https://github.com/orca-so/whirlpools/tree/e528dd23bb41571f92cfdb49a2f15d4fa0b01bec)) and used in
compliance with its terms prior to February 26, 2025.
See the Apache License, Version 2.0 for details at: http://www.apache.org/licenses/LICENSE-2.0.

### Commercial Licensing

If you wish to:

- Use this SDK in modified form
- Integrate in a way that falls outside this license
- Build a tool or service around the SDK

Please contact us at **[info@fusionamm.com](mailto:info@fusionamm.com)**.