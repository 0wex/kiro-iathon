export async function mapWithConcurrency<TItem, TResult>(
	items: TItem[],
	limit: number,
	task: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
	const results: TResult[] = new Array(items.length);
	let nextIndex = 0;
	const workers = Array.from(
		{ length: Math.min(limit, items.length) },
		async () => {
			while (nextIndex < items.length) {
				const index = nextIndex;
				nextIndex += 1;
				const item = items[index];
				if (item !== undefined) {
					results[index] = await task(item);
				}
			}
		},
	);
	await Promise.all(workers);
	return results;
}
