import { Command } from "commander";
import { orderGetCommand } from "./get.js";
import { orderListFilesCommand } from "./list-files.js";
import { orderDownloadCommand } from "./download.js";
import { orderRetryCommand } from "./retry.js";
import { orderResendCommand } from "./resend.js";
import { orderEditCommand } from "./edit.js";
import { orderFillCommand } from "./fill.js";
import { orderReadjustInfoCommand } from "./readjust-info.js";
import { orderReadjustCommand } from "./readjust.js";
import { orderRegeneratePhotoCommand } from "./regenerate-photo.js";

export const orderCommand = new Command("order")
  .description("Operações sobre pedidos existentes")
  .addCommand(orderGetCommand)
  .addCommand(orderListFilesCommand)
  .addCommand(orderDownloadCommand)
  .addCommand(orderRetryCommand)
  .addCommand(orderResendCommand)
  .addCommand(orderEditCommand)
  .addCommand(orderFillCommand)
  .addCommand(orderReadjustInfoCommand)
  .addCommand(orderReadjustCommand)
  .addCommand(orderRegeneratePhotoCommand)
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta order get 683abc...
  $ ajusta order download 683abc... --type improved -o cv.pdf
  $ ajusta order edit 683abc... -i
  $ ajusta order readjust 683abc... --job "Nova vaga de Tech Lead"
  $ ajusta order regenerate-photo 683abc... --style creative -o nova.png
  $ ajusta order retry 683abc... --follow
`,
  );
