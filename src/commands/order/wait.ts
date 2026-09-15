import { Command } from "commander";
import { fillResume, getOrder } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputEvent, outputResult, outputError, setJsonMode } from "../../lib/output.js";
import { displayOrderStatus } from "../../lib/display.js";
import { clearPendingCreate, getLastOrderId, readPendingCreate } from "../../lib/config.js";
import { CliError, EXIT_USAGE } from "../../lib/errors.js";
import { log } from "../../lib/logger.js";
import { assertCompleted, timeoutMinutesToMs, waitForOrder } from "../../lib/wait.js";

export const orderWaitCommand = new Command("wait")
  .description("Aguarda um pedido até concluir (pagamento + processamento)")
  .argument("[orderId]", "ID do pedido (usa o último pedido se omitido)")
  .option("--timeout <minutos>", "Timeout em minutos", "30")
  .option("--stream", "Emite um JSON por linha a cada mudança de status (NDJSON; implica --json)")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta improve cv.pdf --no-wait --json | jq -r .orderId   # cria
  $ ajusta order wait <orderId> --json                         # aguarda
  $ ajusta order download <orderId> -o cv.pdf                  # baixa
  $ ajusta order wait <orderId> --stream --json                # NDJSON

Observações:
  - Um pedido create_curriculum criado com --no-wait tem o formulário
    enviado automaticamente assim que o pagamento é confirmado.
  - Sai com código 3 se o pedido falhar ou o PIX expirar; o campo
    error.hint diz o que fazer.
`,
  )
  .action(async (orderIdArg: string | undefined, opts) => {
    try {
      const orderId = orderIdArg || getLastOrderId();
      if (!orderId) {
        throw new CliError(
          "Nenhum ID de pedido fornecido.",
          "missing_order_id",
          { exitCode: EXIT_USAGE, hint: "ajusta order wait <orderId>" },
        );
      }

      const timeoutMs = timeoutMinutesToMs(opts.timeout, 30);
      const stream = !!opts.stream;
      if (stream) setJsonMode(true);

      const initial = await withSpinner("Consultando pedido...", () => getOrder(orderId));
      const pendingFill = readPendingCreate(orderId);

      const result = await waitForOrder(orderId, {
        timeoutMs,
        initialStatus: initial.status,
        onChange: stream ? (snapshot) => outputEvent({ orderId, ...snapshot }) : undefined,
        afterPayment: async () => {
          if (initial.product !== "create_curriculum") return;
          const fresh = await getOrder(orderId);
          if (!fresh.needsFormFill) return;
          if (!pendingFill || typeof pendingFill !== "object") {
            throw new CliError(
              "Pedido pago, mas o formulário do currículo ainda não foi enviado e não há dados salvos neste computador.",
              "needs_form_fill",
              { hint: `ajusta order fill ${orderId} --from resume.json` },
            );
          }
          await fillResume(orderId, pendingFill as Record<string, unknown>);
          clearPendingCreate(orderId);
          if (!isJsonMode()) log.info("Formulário do currículo enviado.");
        },
      });

      const order = assertCompleted(result, orderId);
      const payload = {
        orderId,
        status: order.status,
        product: order.product,
        atsScoreOriginal: order.atsScoreOriginal,
        atsScoreImproved: order.atsScoreImproved,
        next: `ajusta order download ${orderId}`,
      };

      if (isJsonMode()) outputResult(payload);
      else displayOrderStatus({ orderId, status: order.status, product: order.product });
    } catch (err) {
      outputError(err);
    }
  });
