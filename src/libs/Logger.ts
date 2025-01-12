import chalk from "chalk";

export default class Logger {
    public static debug(text: any) {
        console.log(chalk.blueBright('[DEBUG]'), text);
    }

    public static info(text: any) {
        console.log(chalk.blue('[INFO]'), text);
    }

    public static warn(text: any) {
        console.log(chalk.yellow('[WARN]'), text);
    }

    public static error(text: any) {
        console.log(chalk.red('[ERROR]'), text);
    }
}