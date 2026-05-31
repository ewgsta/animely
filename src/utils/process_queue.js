import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { getConfig } from "./storage/config.js";
import { saveQueue } from "./storage/queue.js";
import { batch } from "./download/concurrency.js";
import { dl } from "./download/download.js";
import { spinner } from "./spinner.js";
import { ProgressBar } from "./download/progress.js";
import { EstSpeed, EP_SIZE } from "../constants.js";
import notifier from "node-notifier";
import { t } from "../i18n/index.js";

/**
 * @param {import("./storage/queue.js").QueueItem[]} queue
 */
export async function processQueue(queue) {
    console.clear();
    const totalEpisodes = queue.length;
    const estimatedSizeMB = totalEpisodes * EP_SIZE;
    const estimatedSizeGB = (estimatedSizeMB / 1024).toFixed(2);

    console.log(chalk.green(`\n${t("queue.title")}`));
    console.log(chalk.gray(t("queue.totalEpisodes", { count: totalEpisodes })));
    console.log(chalk.gray(t("queue.estimatedSize", { size: estimatedSizeGB })));

    if (EstSpeed) {
        const estimatedSeconds = estimatedSizeMB / (EstSpeed / 8);
        const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
        console.log(chalk.gray(t("queue.estimatedTime", { minutes: estimatedMinutes, speed: EstSpeed })));
    }

    const { confirm } = await inquirer.prompt([{
        type: "confirm",
        name: "confirm",
        message: t("queue.confirmStart"),
        default: true
    }]);

    if (!confirm) return;

    const config = getConfig();

    const dirs = new Set(queue.map(item => item.dirPath));
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    console.log(chalk.cyan(`\n${t("queue.downloading", { count: totalEpisodes, limit: config.maxConcurrent })}`));

    const progressUI = new ProgressBar();

    queue.forEach((item) => {
        const key = `${item.safeAnimeName}-${item.episode.episode_number}`;
        progressUI.update(key, {
            name: `${item.animeName} - ${item.episode.episode_number}`,
            status: t("progress.waiting"),
            percent: 0
        });
    });

    if (queue.length > 0) {
        console.log("\n".repeat(Math.min(queue.length, config.maxConcurrent)));
    }

    const tasks = queue.map((item) => async () => {
        const key = `${item.safeAnimeName}-${item.episode.episode_number}`;
        const downloadPath = path.join(item.dirPath, `${item.safeAnimeName} - ${item.episode.episode_number}`);

        if (!item.episode.link) {
            progressUI.update(key, { status: t("progress.error"), percent: 0 });
            return;
        }

        try {
            progressUI.update(key, { status: t("progress.downloading"), percent: 0 });

            await dl(item.episode.link, downloadPath, {
                silent: true,
                onProgress: (data) => {
                    progressUI.update(key, {
                        status: t("progress.downloading"),
                        percent: data.percent,
                        speed: data.speed,
                        eta: data.eta,
                        downloaded: data.downloaded,
                        total: data.total
                    });
                }
            }, {
                count: config.retryEnabled ? (config.retryCount || 3) : 0,
                delay: config.retryDelay || 3000
            });

            progressUI.update(key, { status: t("progress.completed"), percent: 100 });

            const index = queue.indexOf(item);
            if (index > -1) {
                queue.splice(index, 1);
                saveQueue(queue);
            }
        } catch (error) {
            progressUI.update(key, { status: t("progress.error"), percent: 0 });
        }
    });

    await batch(tasks, config.maxConcurrent);
    progressUI.clear();
    spinner.succeed(chalk.bold(t("queue.allComplete")));

    notifier.notify({
        title: 'Animely',
        message: t("queue.notificationComplete"),
        sound: true
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
}
