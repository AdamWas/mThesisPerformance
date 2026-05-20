import { getLargePayload, getSmallValue } from "./graftClient";
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

export type BenchmarkClient = {
  label: string;
  transport: string;
  getSmallValue: () => Promise<number>;
  getLargePayload: (sizeMb: number) => Promise<{
    payloadLength: number;
    sizeBytes: number;
  }>;
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

async function warmup(calls: number, sizeMb: number, clients: BenchmarkClient[]) {
  for (let index = 0; index < calls; index += 1) {
    for (const client of clients) {
      await client.getSmallValue();
    }
  }

  if (calls > 0) {
    for (const client of clients) {
      await client.getLargePayload(sizeMb);
    }
  }
}

export async function runTransportBenchmark(
  options: BenchmarkOptions,
  clients: BenchmarkClient[]
) {
  await warmup(options.warmupCalls, options.sizeMb, clients);

  const results: BenchmarkResult[] = [];

  for (const client of clients) {
    results.push(await runTimed(
      client.transport,
      "small",
      `${client.label} GetSmall`,
      options.smallCalls,
      async () => String(await client.getSmallValue()),
      options.onProgress
    ));
  }

  for (const client of clients) {
    results.push(await runTimed(
      client.transport,
      "large",
      `${client.label} GetLarge ${options.sizeMb} MB`,
      options.largeCalls,
      async () => {
        const payload = await client.getLargePayload(options.sizeMb);
        return `${payload.payloadLength}/${payload.sizeBytes} bytes`;
      },
      options.onProgress
    ));
  }

  return results;
}

export function getDotNetBenchmarkClients(): BenchmarkClient[] {
  return [
    {
      label: "REST",
      transport: "REST",
      getSmallValue: getRestSmallValue,
      getLargePayload: getRestLargePayload
    },
    {
      label: "Graftcode",
      transport: "Graftcode",
      getSmallValue,
      getLargePayload
    }
  ];
}

export async function runReactGraftBenchmark(options: BenchmarkOptions) {
  return runTransportBenchmark(options, getDotNetBenchmarkClients());
}
