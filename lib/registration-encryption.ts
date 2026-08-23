// This server-only helper encrypts optional medical and coach information
// before it is stored. AES-256-GCM provides both confidentiality and tamper
// detection, so altered ciphertext will fail instead of producing bad data.

import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const encryptionVersion = "v1";
const initializationVectorLength = 12;
const authenticationTagLength = 16;
const encryptionContext = Buffer.from(
  "artis-registration-sensitive-data:v1",
  "utf8",
);

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.REGISTRATION_DATA_ENCRYPTION_KEY;

  if (!configuredKey) {
    throw new TypeError(
      "REGISTRATION_DATA_ENCRYPTION_KEY is required to protect registration data.",
    );
  }

  const encryptionKey = Buffer.from(configuredKey, "base64");

  if (encryptionKey.length !== 32) {
    throw new TypeError(
      "REGISTRATION_DATA_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.",
    );
  }

  return encryptionKey;
}

export function encryptRegistrationText(value: string | null): string | null {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  const initializationVector = randomBytes(initializationVectorLength);
  const cipher = createCipheriv(
    algorithm,
    getEncryptionKey(),
    initializationVector,
  );

  cipher.setAAD(encryptionContext);

  const encryptedValue = Buffer.concat([
    cipher.update(normalizedValue, "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    encryptionVersion,
    initializationVector.toString("base64url"),
    authenticationTag.toString("base64url"),
    encryptedValue.toString("base64url"),
  ].join(":");
}

export function decryptRegistrationText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const [version, initializationVectorValue, authenticationTagValue, data] =
    value.split(":");

  if (
    version !== encryptionVersion ||
    !initializationVectorValue ||
    !authenticationTagValue ||
    data === undefined
  ) {
    throw new Error("The encrypted registration data has an invalid format.");
  }

  const initializationVector = Buffer.from(
    initializationVectorValue,
    "base64url",
  );
  const authenticationTag = Buffer.from(authenticationTagValue, "base64url");

  if (
    initializationVector.length !== initializationVectorLength ||
    authenticationTag.length !== authenticationTagLength
  ) {
    throw new Error("The encrypted registration data has an invalid format.");
  }

  try {
    const decipher = createDecipheriv(
      algorithm,
      getEncryptionKey(),
      initializationVector,
    );

    decipher.setAAD(encryptionContext);
    decipher.setAuthTag(authenticationTag);

    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("The encrypted registration data could not be verified.");
  }
}
