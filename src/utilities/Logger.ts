import chalk from 'chalk';

class Logger {
  info(message, sequenceId) {
    console.log(chalk.blue(this.formatMessage(message, sequenceId)));
  }

  warning(message, sequenceId) {
    console.log(chalk.yellow(this.formatMessage(message, sequenceId)));
  }

  error(message, sequenceId) {
    console.log(chalk.red(this.formatMessage(message, sequenceId)));
  }

  private formatMessage(message, sequenceId): string {
    return `[${this.formatTimestamp()} | sequenceId: ${sequenceId}]: ${message}`;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }
}

export default new Logger();
