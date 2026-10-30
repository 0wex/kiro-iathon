import {
	PBKDF2_ALGORITHM_TAG,
	PBKDF2_ITERATIONS,
	PBKDF2_KEY_LENGTH_BYTES,
	PBKDF2_SALT_LENGTH_BYTES,
} from "./constants";

// Replaces better-auth's default scrypt (N=16384, r=16), which blows past the
// Workers per-request CPU budget so sign-in/sign-up intermittently fail on
// workerd. PBKDF2 goes through Web Crypto, which workerd accelerates.
//
// Hash format: `pbkdf2-sha256:<iterations>:<salt-hex>:<key-hex>` —
// self-describing so the verifier honors the iteration count baked into each
// row and the count can change later without invalidating old rows.

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

async function deriveKey(
	password: string,
	salt: Uint8Array,
	iterations: number,
) {
	const passwordKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password.normalize("NFKC")),
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations },
		passwordKey,
		PBKDF2_KEY_LENGTH_BYTES * 8,
	);
	return new Uint8Array(derivedBits);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LENGTH_BYTES));
	const derivedKey = await deriveKey(password, salt, PBKDF2_ITERATIONS);
	return `${PBKDF2_ALGORITHM_TAG}:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(derivedKey)}`;
}

interface VerifyPasswordInput {
	hash: string;
	password: string;
}

export async function verifyPassword({
	hash,
	password,
}: VerifyPasswordInput): Promise<boolean> {
	const [algorithm, iterationsText, saltHex, keyHex] = hash.split(":");
	if (
		algorithm !== PBKDF2_ALGORITHM_TAG ||
		!iterationsText ||
		!saltHex ||
		!keyHex
	) {
		return false;
	}
	const iterations = Number.parseInt(iterationsText, 10);
	if (!Number.isFinite(iterations) || iterations <= 0) {
		return false;
	}
	const expectedKey = fromHex(keyHex);
	const actualKey = await deriveKey(password, fromHex(saltHex), iterations);
	if (actualKey.length !== expectedKey.length) {
		return false;
	}
	// Constant-time comparison so a mismatch's timing doesn't leak how much of
	// the derived key matched. Lengths are equal, so the `?? 0` fallbacks never
	// trigger — they only satisfy noUncheckedIndexedAccess.
	let difference = 0;
	for (let index = 0; index < actualKey.length; index++) {
		difference |= (actualKey[index] ?? 0) ^ (expectedKey[index] ?? 0);
	}
	return difference === 0;
}
