/** Barrel — preserves the `../scripts/audit` import path after the module split.
 * Web3Forms browser delivery (the only delivery boundary) lives in
 * ./audit/delivery.ts; the journey state machine lives in ./audit/index.ts.
 */
export { initAudit } from "./audit/index.ts";
export type { AuditConfig } from "./audit/index.ts";
// validation_receipt, delivery_attempt, web3forms: see ./audit/delivery.ts
