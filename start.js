// @ts-check
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

if (!fs.existsSync(path.join(process.cwd(), "node_modules"))) {
	console.log("gerekli moduller eksik, yukleniyor...");
	try {
		execSync("npm install", { stdio: "inherit" });
		console.log("moduller basariyla yuklendi.");
	} catch (error) {
		console.error("modul yukleme hatasi:", error.message);
		process.exit(1);
	}
}

try {
	import("./src/index.js");
} catch (error) {
	console.error("uygulama baslatilamadi:", error);
}
