/** Barrel — preserves import path `../scripts/audit` after god-module split (plan 023).
 * Re-exports validation_receipt + delivery_attempt seams (plans 021, 025) via ./audit/delivery.ts.
 * Web3Forms client delivery (email-only) lives in ./audit/delivery.ts — grep web3forms still hits via barrel.
 */
export { initAudit } from "./audit/index.ts";
export type { AuditConfig } from "./audit/index.ts";
// validation_receipt, delivery_attempt, web3forms: see ./audit/delivery.ts
