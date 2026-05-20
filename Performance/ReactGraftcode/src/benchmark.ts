import { getLargePayload, getSmallValue } from "./graftClient";
import { getGrpcLargePayload, getGrpcSmallValue } from "./grpcWebClient";
import { getRestLargePayload, getRestSmallValue } from "./restClient";

export type BenchmarkResult = {
  name: string;
  transport: string;
  scenario: string;
  calls: number;
  totalMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  throughput: number;
  lastValue: string;
};

export type BenchmarkOptions = {
  smallCalls: number;
  largeCalls: number;
  sizeMb: number;
  warmupCalls: number;
  onProgress?: (completed: number, total: number, label: string) => void;
};

const round = (value: number) => Math.round(value * 100) / 100;

async function runTimed(
  transport: string,
  scenario: string,
  name: string,
  calls: number,
  invoke: () => Promise<string>,
  onProgress?: BenchmarkOptions["onProgress"]
): Promise<BenchmarkResult> {
  const samples: number[] = [];
  let lastValue = "";

  for (let index = 0; index < calls; index += 1) {
    const started = performance.now();
    lastValue = await invoke();
    samples.push(performance.now() - started);
    onProgress?.(index + 1, calls, name);
  }

  const totalMs = samples.reduce((sum, value) => sum + value, 0);

  return {
    name,
    transport,
    scenario,
    calls,
    totalMs: round(totalMs),
    meanMs: round(totalMs / calls),
    minMs: round(Math.min(...samples)),
    maxMs: round(Math.max(...samples)),
    throughput: round((calls / totalMs) * 1000),
    lastValue
  };
}

async function warmup(calls: number, sizeMb: number) {
  for (let index = 0; index < calls; index += 1) {
    await getRestSmallValue();
    await getGrpcSmallValue();
    await getSmallValue();
  }

  if (calls > 0) {
    await getRestLargePayload(sizeMb);
    await getGrpcLargePayload(sizeMb);
    await getLargePayload(sizeMb);
  }
}

export async function runReactGraftBenchmark(options: BenchmarkOptions) {
  await warmup(options.warmupCalls, options.sizeMb);

  const results: BenchmarkResult[] = [];

  results.push(await runTimed(
    "REST",
    "small",
    "REST GetSmall",
    options.smallCalls,
    async () => String(await getRestSmallValue()),
    options.onProgress
  ));

  results.push(await runTimed(
    "gRPC-Web",
    "small",
    "gRPC-Web GetSmall",
    options.smallCalls,
    async () => String(await getGrpcSmallValue()),
    options.onProgress
  ));

  results.push(await runTimed(
    "Graftcode",
    "small",
    "Graftcode GetSmall",
    options.smallCalls,
    async () => String(await getSmallValue()),
    options.onProgress
  ));

  results.push(await runTimed(
    "REST",
    "large",
    `REST GetLarge ${options.sizeMb} MB`,
    options.largeCalls,
    async () => {
      const payload = await getRestLargePayload(options.sizeMb);
      return `${payload.payloadLength}/${payload.sizeBytes} bytes`;
    },
    options.onProgress
  ));

  results.push(await runTimed(
    "gRPC-Web",
    "large",
    `gRPC-Web GetLarge ${options.sizeMb} MB`,
    options.largeCalls,
    async () => {
      const payload = await getGrpcLargePayload(options.sizeMb);
      return `${payload.payloadLength}/${payload.sizeBytes} bytes`;
    },
    options.onProgress
  ));

  results.push(await runTimed(
    "Graftcode",
    "large",
    `Graftcode GetLarge ${options.sizeMb} MB`,
    options.largeCalls,
    async () => {
      const payload = await getLargePayload(options.sizeMb);
      return `${payload.payloadLength}/${payload.sizeBytes} bytes`;
    },
    options.onProgress
  ));

  return results;
}
