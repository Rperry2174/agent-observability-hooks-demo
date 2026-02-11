import process from 'node:process';

import { SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter, type SpanExporter } from '@opentelemetry/sdk-trace-base';

type TraceExporterMode = 'console' | 'otlp' | 'none';

let sdk: NodeSDK | undefined;
let activeServiceName = 'haunted-repo-demo';
let telemetryStarted = false;
let shutdownPromise: Promise<void> | undefined;

function resolveTraceExporterMode(): TraceExporterMode {
  const firstExporter = (process.env.OTEL_TRACES_EXPORTER ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .find(Boolean);

  if (!firstExporter) return 'none';
  if (firstExporter === 'none') return 'none';
  if (firstExporter === 'console') return 'console';
  return 'otlp';
}

function buildTraceExporter(mode: TraceExporterMode): SpanExporter | undefined {
  if (mode === 'none') return undefined;
  if (mode === 'otlp') return new OTLPTraceExporter();
  return new ConsoleSpanExporter();
}

export async function initTelemetry(serviceName: string): Promise<void> {
  if (telemetryStarted) return;
  telemetryStarted = true;
  activeServiceName = serviceName;

  if (!process.env.OTEL_SERVICE_NAME) {
    process.env.OTEL_SERVICE_NAME = serviceName;
  }

  const mode = resolveTraceExporterMode();
  const traceExporter = buildTraceExporter(mode);
  if (!traceExporter) return;

  try {
    sdk = new NodeSDK({ traceExporter });
    await sdk.start();
  } catch (error) {
    sdk = undefined;
    console.error('[otel] failed to initialize telemetry:', error);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = sdk.shutdown().catch((error) => {
    console.error('[otel] failed to shut down telemetry:', error);
  });
  await shutdownPromise;
}

export async function withSpan<T>(
  name: string,
  run: (span: Span) => Promise<T> | T,
  attributes: Attributes = {},
): Promise<T> {
  const tracer = trace.getTracer(activeServiceName);
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await run(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      if (error instanceof Error) {
        span.recordException(error);
      } else {
        span.recordException({ message });
      }
      throw error;
    } finally {
      span.end();
    }
  });
}
