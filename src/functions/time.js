// @ts-check
export function timeFormat(date = new Date()) {
	try {
		if (!(date instanceof Date) || isNaN(date.getTime())) {
			date = new Date();
		}

		const formatter = new Intl.DateTimeFormat("tr-TR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		});

		return formatter.format(date).replace(",", "");
	} catch {
		const fallbackDate = new Date();
		return `${fallbackDate.getDate().toString().padStart(2, "0")}.${(fallbackDate.getMonth() + 1).toString().padStart(2, "0")}.${fallbackDate.getFullYear()} ${fallbackDate.getHours().toString().padStart(2, "0")}:${fallbackDate.getMinutes().toString().padStart(2, "0")}:${fallbackDate.getSeconds().toString().padStart(2, "0")}`;
	}
}