import type { ZodType } from "zod";

import {
	CIPHERTEXT_SEPARATOR,
	ENCRYPTION_ALGORITHM,
	ENCRYPTION_IV_LENGTH_BYTES,
	ENCRYPTION_KEY_LENGTH_BYTES,
} from "./constants";

function bytesToBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string, label: string): Uint8Array<ArrayBuffer> {
	try {
		return Uint8Array.from(atob(base64), (character) =>
			character.charCodeAt(0),
		);
	} catch {
		throw new Error(`${label} is not valid base64`);
	}
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
	const keyBytes = base64ToBytes(keyBase64, "Encryption key");
	if (keyBytes.length !== ENCRYPTION_KEY_LENGTH_BYTES) {
		throw new Error(
			`Encryption key must be ${ENCRYPTION_KEY_LENGTH_BYTES} bytes (AES-256), got ${keyBytes.length}`,
		);
	}
	return crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: ENCRYPTION_ALGORITHM },
		false,
		["encrypt", "decrypt"],
	);
}

export function generateEncryptionKeyBase64(): string {
	return bytesToBase64(
		crypto.getRandomValues(new Uint8Array(ENCRYPTION_KEY_LENGTH_BYTES)),
	);
}

export async function encryptJson(
	keyBase64: string,
	value: unknown,
): Promise<string> {
	const key = await importKey(keyBase64);
	const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_IV_LENGTH_BYTES));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: ENCRYPTION_ALGORITHM, iv },
		key,
		new TextEncoder().encode(JSON.stringify(value)),
	);
	return `${bytesToBase64(iv)}${CIPHERTEXT_SEPARATOR}${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptJson<T>(
	keyBase64: string,
	ciphertext: string,
	schema: ZodType<T>,
): Promise<T> {
	const key = await importKey(keyBase64);
	const [ivBase64, payloadBase64, ...extraParts] =
		ciphertext.split(CIPHERTEXT_SEPARATOR);
	if (!ivBase64 || !payloadBase64 || extraParts.length > 0) {
		throw new Error("Ciphertext must have the form base64(iv).base64(data)");
	}
	const iv = base64ToBytes(ivBase64, "Ciphertext IV");
	if (iv.length !== ENCRYPTION_IV_LENGTH_BYTES) {
		throw new Error(
			`Ciphertext IV must be ${ENCRYPTION_IV_LENGTH_BYTES} bytes, got ${iv.length}`,
		);
	}
	let plaintext: ArrayBuffer;
	try {
		plaintext = await crypto.subtle.decrypt(
			{ name: ENCRYPTION_ALGORITHM, iv },
			key,
			base64ToBytes(payloadBase64, "Ciphertext payload"),
		);
	} catch {
		throw new Error("Failed to decrypt ciphertext: wrong key or tampered data");
	}
	return schema.parse(JSON.parse(new TextDecoder().decode(plaintext)));
}
