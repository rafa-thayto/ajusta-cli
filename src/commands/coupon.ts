import { Command } from "commander";
import { validateCoupon } from "../lib/api.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { displayCouponInfo } from "../lib/display.js";
import { PRODUCT_KEYS, type Product } from "../lib/constants.js";
import { CliError, EXIT_USAGE } from "../lib/errors.js";

export const couponCommand = new Command("coupon")
  .description("Utilitários de cupons (validação)")
  .addCommand(
    new Command("validate")
      .description("Valida um cupom de desconto")
      .argument("<code>", "Código do cupom (case-insensitive)")
      .option(
        "--product <produto>",
        `Produto: ${PRODUCT_KEYS.join(" | ")}`,
        "improve_curriculum",
      )
      .addHelpText(
        "after",
        `
Exemplos:
  $ ajusta coupon validate PROMO10
  $ ajusta coupon validate BLACKFRIDAY --product create_curriculum
  $ ajusta coupon validate WELCOME --json
`,
      )
      .action(async (code: string, opts) => {
        try {
          const product = opts.product as Product;
          if (!PRODUCT_KEYS.includes(product)) {
            throw new CliError(
              `Produto inválido: ${product}. Opções: ${PRODUCT_KEYS.join(", ")}`,
              "invalid_argument",
              EXIT_USAGE,
            );
          }

          const result = await withSpinner("Validando cupom...", () =>
            validateCoupon(code, product),
          );

          if (isJsonMode()) {
            outputResult({ product, ...result });
          } else {
            displayCouponInfo(result, product);
          }
        } catch (err) {
          outputError(err);
        }
      }),
  );
