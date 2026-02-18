import { buildProgram } from './src/cli/program/build-program.ts';

const program = buildProgram();

try {
  await program.parseAsync(['node', 'openclawcn', 'agent', '--help']);
} catch (err) {
  // Ignore help output
}
