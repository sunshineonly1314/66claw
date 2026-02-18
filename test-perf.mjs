import { startPerfTrace, recordPerfMeasurement, completePerfTrace } from './dist/infra/perf-tracker.js';

const traceId = 'test-' + Date.now();
console.log('Testing perf tracker...');

// Start a trace
startPerfTrace(traceId, { sessionKey: 'test-session' });
console.log('✓ Trace started');

// Record some measurements
recordPerfMeasurement(traceId, 'request_received');
await new Promise(r => setTimeout(r, 50));

recordPerfMeasurement(traceId, 'dispatch_start');
await new Promise(r => setTimeout(r, 100));

recordPerfMeasurement(traceId, 'agent_run_start');
await new Promise(r => setTimeout(r, 200));

recordPerfMeasurement(traceId, 'agent_run_complete');

// Complete the trace
const result = completePerfTrace(traceId, { status: 'success' });
console.log('✓ Trace completed');
console.log('Total measurements:', result?.measurements.length);
