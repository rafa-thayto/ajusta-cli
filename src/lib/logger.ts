import chalk from "chalk";
import { isTTY } from "./tty.js";

interface LogConfig {
  json: boolean;
  verbose: boolean;
}

const config: LogConfig = { json: false, verbose: false };

export function configureLogger(opts: Partial<LogConfig>) {
  Object.assign(config, opts);
}

function write(stream: NodeJS.WriteStream, msg: string) {
  stream.write(msg + "\n");
}

export const log = {
  /** Neutral info → stderr. Suppressed in JSON mode. */
  info(msg: string) {
    if (config.json) return;
    write(process.stderr, `  ${chalk.cyan("\u2139")} ${msg}`);
  },

  /** Success → stderr. Suppressed in JSON mode. */
  success(msg: string) {
    if (config.json) return;
    write(process.stderr, `  ${chalk.green("\u2714")} ${msg}`);
  },

  /** Warning → stderr. Always shown. */
  warn(msg: string) {
    write(process.stderr, `  ${chalk.yellow("\u26A0")} ${msg}`);
  },

  /** Error → stderr. Always shown. */
  error(msg: string) {
    write(process.stderr, `  ${chalk.red("\u2718")} ${msg}`);
  },

  /** Debug → stderr. Only with --verbose. */
  debug(msg: string) {
    if (!config.verbose) return;
    write(process.stderr, `  ${chalk.dim("[debug]")} ${chalk.dim(msg)}`);
  },

  /** Data → stdout. The ONLY method that writes to stdout. */
  data(obj: unknown) {
    process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  },
};
