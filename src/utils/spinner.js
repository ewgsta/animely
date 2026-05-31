// @ts-check
import chalk from "chalk";
import ora from "ora";
import { t } from "../i18n/index.js";

/** @type {import("ora").Ora} */
export const spinner = ora(chalk.gray(t("spinner.loading")));