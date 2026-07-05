import { randomBytes } from "node:crypto";

const ID_RANDOM_BYTES = 12;
const SECRET_RANDOM_BYTES = 24;

export function generateId(prefix: string): string {
  return `${prefix}${randomBytes(ID_RANDOM_BYTES).toString("hex")}`;
}

export function generateWebhookSecret(prefix: string): string {
  return `${prefix}${randomBytes(SECRET_RANDOM_BYTES).toString("hex")}`;
}
