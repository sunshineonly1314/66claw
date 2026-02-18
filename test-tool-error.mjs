import { buildProgram } from './src/cli/program/build-program.ts';

const program = buildProgram();

try {
  await program.parseAsync(['node', 'openclawcn', 'tool', 'test']);
} catch (err) {
  console.log('Caught error:', err.message);
}
