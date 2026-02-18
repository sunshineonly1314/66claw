import { Command } from "commander";
import { registerProgramCommands } from "./command-registry.js";
import { createProgramContext } from "./context.js";
import { configureProgramHelp } from "./help.js";
import { registerPreActionHooks } from "./preaction.js";
import { setProgramContext } from "./program-context.js";

export function buildProgram() {
  const program = new Command();
  const ctx = createProgramContext();
  const argv = process.argv;

  setProgramContext(program, ctx);
  configureProgramHelp(program, ctx);
  registerPreActionHooks(program, ctx.programVersion);

  registerProgramCommands(program, ctx, argv);

  // CN Enhancement: Friendly error message for common mistakes
  program.exitOverride((err) => {
    if (err.code === "commander.unknownCommand") {
      const attempted = err.message.match(/unknown command '(.+?)'/)?.[1];
      if (attempted === "tool") {
        console.error("\n❌ OpenClawCN 没有 'tool' 子命令");
        console.error("\n💡 工具必须通过 agent 调用，示例：");
        console.error('  openclawcn agent --message "用 desktop_control 截图"');
        console.error("\n查看更多帮助: openclawcn agent --help\n");
        process.exit(1);
      }
    }
    throw err;
  });

  return program;
}
