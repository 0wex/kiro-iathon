import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	decryptJson,
	encryptJson,
	generateEncryptionKeyBase64,
} from "./credentials";

const secretSchema = z.object({ apiToken: z.string() });

describe("credential encryption", () => {
	it("roundtrips a JSON value", async () => {
		const key = generateEncryptionKeyBase64();
		const ciphertext = await encryptJson(key, { apiToken: "secret" });
		expect(ciphertext).not.toContain("secret");
		expect(ciphertext.split(".")).toHaveLength(2);
		await expect(decryptJson(key, ciphertext, secretSchema)).resolves.toEqual({
			apiToken: "secret",
		});
	});

	it("uses a fresh IV for every encryption", async () => {
		const key = generateEncryptionKeyBase64();
		const first = await encryptJson(key, { apiToken: "secret" });
		const second = await encryptJson(key, { apiToken: "secret" });
		expect(first).not.toBe(second);
	});

	it("fails with the wrong key", async () => {
		const ciphertext = await encryptJson(generateEncryptionKeyBase64(), {
			apiToken: "secret",
		});
		await expect(
			decryptJson(generateEncryptionKeyBase64(), ciphertext, secretSchema),
		).rejects.toThrow(/wrong key or tampered/);
	});

	it("fails with tampered ciphertext", async () => {
		const key = generateEncryptionKeyBase64();
		const ciphertext = await encryptJson(key, { apiToken: "secret" });
		const [ivBase64, payloadBase64 = ""] = ciphertext.split(".");
		const payload = Uint8Array.from(atob(payloadBase64), (character) =>
			character.charCodeAt(0),
		);
		payload[0] = (payload[0] ?? 0) ^ 1;
		const tampered = `${ivBase64}.${btoa(String.fromCharCode(...payload))}`;
		await expect(decryptJson(key, tampered, secretSchema)).rejects.toThrow(
			/wrong key or tampered/,
		);
	});

	it("rejects keys that are not 32 bytes", async () => {
		await expect(encryptJson(btoa("short"), {})).rejects.toThrow(
			/must be 32 bytes/,
		);
	});

	it("rejects malformed ciphertext", async () => {
		await expect(
			decryptJson(generateEncryptionKeyBase64(), "nodot", secretSchema),
		).rejects.toThrow(/form base64/);
	});
});
