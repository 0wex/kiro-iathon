const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	aacute: "á",
	eacute: "é",
	iacute: "í",
	oacute: "ó",
	uacute: "ú",
	ntilde: "ñ",
	Aacute: "Á",
	Eacute: "É",
	Iacute: "Í",
	Oacute: "Ó",
	Uacute: "Ú",
	Ntilde: "Ñ",
	uuml: "ü",
	Uuml: "Ü",
};

export function decodeHtmlEntities(value: string): string {
	return value.replace(
		/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
		(entity: string, body: string) => {
			if (body.startsWith("#x") || body.startsWith("#X")) {
				return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
			}
			if (body.startsWith("#")) {
				return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
			}
			return NAMED_ENTITIES[body] ?? entity;
		},
	);
}

export function stripHtml(value: string): string {
	return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}
