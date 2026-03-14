import { defineCommand, runMain } from "citty";
import { installCommand } from "./commands/install.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { listCommand } from "./commands/list.js";
import { checkCommand } from "./commands/check.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";

const main = defineCommand({
  meta: {
    name: "lspforge",
    version: "0.1.1",
    description:
      "Mason.nvim-style LSP server manager for AI coding tools",
  },
  subCommands: {
    init: initCommand,
    install: installCommand,
    uninstall: uninstallCommand,
    list: listCommand,
    check: checkCommand,
    doctor: doctorCommand,
  },
});

runMain(main);
