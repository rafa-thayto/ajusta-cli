import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { submitCv, pollOrderStatus, downloadResult } from "./api.js";
import { displayPaymentInfo, statusLabel } from "./display.js";

const program = new Command();

program
  .name("ajusta")
  .description("Otimize seu currículo com IA — by AjustaCV")
  .version("1.0.0");

program
  .command("cv")
  .description("Envia seu currículo para otimização ATS com IA")
  .argument("<input>", "Caminho para o arquivo (PDF/DOCX) ou conteúdo em base64")
  .option("-o, --output <caminho>", "Caminho para salvar o resultado", "curriculo-ajustado.pdf")
  .action(async (input: string, opts: { output: string }) => {
    // 1. Submit CV
    const submitSpinner = ora("Enviando currículo...").start();

    let order;
    try {
      order = await submitCv(input);
      submitSpinner.succeed("Currículo enviado!");
    } catch (err: unknown) {
      submitSpinner.fail(chalk.red((err as Error).message));
      process.exit(1);
    }

    // 2. Show payment info
    displayPaymentInfo(order);

    // 3. Poll for payment + processing
    const pollSpinner = ora(statusLabel("pending_payment")).start();

    try {
      let lastStatus = "";
      while (true) {
        const status = await pollOrderStatus(order.orderId);

        if (status.status !== lastStatus) {
          pollSpinner.text = statusLabel(status.status, status.processingStep);
          lastStatus = status.status;
        }

        if (status.status === "completed") {
          pollSpinner.succeed(chalk.green("Currículo otimizado com sucesso!"));

          // 4. Download result
          const dlSpinner = ora("Baixando resultado...").start();
          await downloadResult(order.orderId, opts.output);
          dlSpinner.succeed(chalk.green(`Salvo em: ${opts.output}`));
          break;
        }

        if (status.status === "failed") {
          pollSpinner.fail(chalk.red("Processamento falhou. Tente novamente ou acesse ajustacv.com"));
          process.exit(1);
        }

        if (status.status === "expired") {
          pollSpinner.fail(chalk.red("Pagamento expirado."));
          process.exit(1);
        }

        // Wait 3s between polls
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err: unknown) {
      pollSpinner.fail(chalk.red((err as Error).message));
      process.exit(1);
    }

    console.log();
    console.log(chalk.cyan("  Obrigado por usar AjustaCV! 🚀"));
    console.log(chalk.dim("  https://ajustacv.com"));
    console.log();
  });

program.parse();
