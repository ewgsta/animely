// @ts-check
import chalk from "chalk";

/**
 * @returns {number}
 */
export function getTerminalWidth() {
    return process.stdout.columns || 80;
}

/**
 * @param {string} title 
 * @param {object} [options]
 * @param {"cyan"|"green"|"yellow"|"red"|"magenta"|"blue"} [options.color="cyan"]
 */
export function boxTitle(title, options = {}) {
    const { color = "cyan" } = options;
    
    const bgColors = {
        cyan: chalk.bgCyan.black,
        green: chalk.bgGreen.black,
        yellow: chalk.bgYellow.black,
        red: chalk.bgRed.white,
        magenta: chalk.bgMagenta.black,
        blue: chalk.bgBlue.white
    };
    
    const bgFn = bgColors[color] || bgColors.cyan;
    console.log(bgFn(` ${title} `));
}

/**
 * @param {string[]} lines 
 */
export function boxInfo(lines) {
    for (const line of lines) {
        console.log(`  ${line}`);
    }
}

/**
 * @param {string} title
 * @param {string[]} content
 * @param {object} [options]
 * @param {"cyan"|"green"|"yellow"|"red"|"magenta"|"blue"} [options.titleColor="cyan"]
 */
export function boxWithTitle(title, content, options = {}) {
    const { titleColor = "cyan" } = options;
    
    const bgColors = {
        cyan: chalk.bgCyan.black,
        green: chalk.bgGreen.black,
        yellow: chalk.bgYellow.black,
        red: chalk.bgRed.white,
        magenta: chalk.bgMagenta.black,
        blue: chalk.bgBlue.white,
        gray: chalk.bgGray.white
    };
    
    const bgFn = bgColors[titleColor] || bgColors.cyan;
    console.log(bgFn(` ${title} `));
    
    for (const line of content) {
        console.log(`  ${line}`);
    }
}

/**
 * @param {number} [width]
 * @param {"gray"|"cyan"|"yellow"} [color="gray"]
 */
export function divider(width, color = "gray") {
    const w = width || Math.min(50, getTerminalWidth() - 4);
    const colorFn = chalk[color] || chalk.gray;
    console.log(colorFn("─".repeat(w)));
}

/**
 * @param {string} title
 * @param {string} [subtitle]
 * @param {"cyan"|"green"|"yellow"|"magenta"} [color="cyan"]
 */
export function banner(title, subtitle, color = "cyan") {
    const bgColors = {
        cyan: chalk.bgCyan.black,
        green: chalk.bgGreen.black,
        yellow: chalk.bgYellow.black,
        magenta: chalk.bgMagenta.black
    };
    
    const bgFn = bgColors[color] || bgColors.cyan;
    const colorFn = chalk[color] || chalk.cyan;
    
    console.log("");
    console.log(bgFn(` ${title} `));
    if (subtitle) {
        console.log(colorFn(subtitle));
    }
}

/**
 * @param {string} animeName
 * @param {number} currentEp
 * @param {number} totalEp
 * @param {string} [resolution]
 */
export function menuHeader(animeName, currentEp, totalEp, resolution) {
    const resText = resolution ? ` (${resolution})` : "";
    const epText = currentEp > 0 ? ` | ${currentEp}/${totalEp}` : ` | ${totalEp} bölüm`;
    console.log(chalk.bgYellow.black(` Oynatılıyor `) + ` ${chalk.bold(animeName)}${chalk.gray(resText)}${chalk.yellow(epText)}`);
}

/**
 * @param {string} message
 */
export function errorBox(message) {
    console.log(chalk.red(`✗  ${message}`));
}

/**
 * @param {string} message
 */
export function successBox(message) {
    console.log(chalk.green(`✓  ${message}`));
}

/**
 * @param {string} message
 */
export function infoBox(message) {
    console.log(chalk.cyan(`●  ${message}`));
}

/**
 * @param {string} message
 */
export function warnBox(message) {
    console.log(chalk.yellow(`!  ${message}`));
}
