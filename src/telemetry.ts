/**
 * OpenTelemetry SDK initialization for the Haunted Repo demo.
 *
 * Configures traces, metrics, and logs to be exported via OTLP HTTP
 * to a local Grafana LGTM stack (or any OTLP-compatible backend).
 *
 * Usage:
 *   import { initTelemetry, getTracer, getMeter, getLogEmitter } from './telemetry.js';
 *   const shutdown = initTelemetry();
 *   // ... use getTracer(), getMeter(), getLogEmitter() ...
 *   await shutdown();
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs as logsApi } from '@opentelemetry/api-logs';
import { trace, metrics, type Tracer, type Meter } from '@opentelemetry/api';

const SERVICE_NAME = 'haunted-repo-demo';
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

let sdk: NodeSDK | null = null;
let loggerProvider: LoggerProvider | null = null;

/**
 * Initialize the OpenTelemetry SDK with OTLP HTTP exporters for
 * traces, metrics, and logs. Returns an async shutdown function.
 */
export function initTelemetry(): () => Promise<void> {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: '1.0.0',
  });

  // --- Traces ---
  const traceExporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
  });

  // --- Metrics ---
  const metricExporter = new OTLPMetricExporter({
    url: `${OTLP_ENDPOINT}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 5000,
  });

  // --- Logs ---
  const logExporter = new OTLPLogExporter({
    url: `${OTLP_ENDPOINT}/v1/logs`,
  });

  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(logExporter)],
  });
  logsApi.setGlobalLoggerProvider(loggerProvider);

  // --- SDK ---
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    // Logs are handled by the separate LoggerProvider above
  });

  sdk.start();

  const shutdown = async () => {
    try {
      if (loggerProvider) {
        await loggerProvider.forceFlush();
        await loggerProvider.shutdown();
      }
      if (sdk) {
        await sdk.shutdown();
      }
    } catch {
      // Swallow shutdown errors in demo
    }
  };

  // Graceful shutdown on signals
  const onSignal = () => {
    shutdown().finally(() => process.exit(0));
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);

  return shutdown;
}

/** Get the global tracer for the demo. */
export function getTracer(): Tracer {
  return trace.getTracer(SERVICE_NAME, '1.0.0');
}

/** Get the global meter for the demo. */
export function getMeter(): Meter {
  return metrics.getMeter(SERVICE_NAME, '1.0.0');
}

/** Get the global log emitter for the demo. */
export function getLogEmitter() {
  return logsApi.getLogger(SERVICE_NAME, '1.0.0');
}
