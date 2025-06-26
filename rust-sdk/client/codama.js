import { createFromRoot } from "codama";
import { renderRustVisitor } from "@codama/renderers";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { readFileSync } from "fs";

const idl = JSON.parse(readFileSync("../../target/idl/fusionamm.json", "utf8"));
// IDL generated with anchor 0.29 does not have the metadata field so we have to add it manually
const node = rootNodeFromAnchor(idl);
const visitor = renderRustVisitor("./src/generated");
const codama = createFromRoot(node);
codama.accept(visitor);
