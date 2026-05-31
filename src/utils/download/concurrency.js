// @ts-check

/**
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} limit
 * @returns {Promise<T[]>}
 */
export async function batch(tasks, limit) {
	const results = [];
	const executing = [];

	for (const task of tasks) {
		const p = task().then(result => {
			executing.splice(executing.indexOf(p), 1);
			return result;
		});
		results.push(p);
		executing.push(p);

		if (executing.length >= limit) {
			await Promise.race(executing);
		}
	}

	return Promise.all(results);
}
