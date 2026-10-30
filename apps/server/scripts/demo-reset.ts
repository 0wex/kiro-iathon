import { DEMO_RESET_SECRET_HEADER } from "../../../packages/business/src/demo-account.ts";

const secret = process.env.DEMO_RESET_SECRET;
if (!secret) throw new Error("DEMO_RESET_SECRET es obligatorio.");
const response = await fetch(
	process.env.DEMO_RESET_URL ?? "http://localhost:3000/api/demo/reset",
	{
		method: "POST",
		headers: { [DEMO_RESET_SECRET_HEADER]: secret },
	},
);
if (!response.ok)
	throw new Error(`No se pudo reiniciar la demo (${response.status}).`);
process.stdout.write(`${await response.text()}\n`);
