import tseslint from 'typescript-eslint';
import bullmq from 'eslint-plugin-bullmq';

// eslint-plugin-bullmq flags BullMQ production pitfalls (missing error listeners,
// worker connections without maxRetriesPerRequest: null, broken jobId dedupe).
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  bullmq.configs.recommended,
];
