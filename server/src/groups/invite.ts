import { randomInt } from "node:crypto";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "@tsili/shared";

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
