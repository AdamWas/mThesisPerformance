import { useMemo, useState } from "react";
import {
  getGatewayHost,
  getGraftStateless,
  getLargePayload,
  getSmallValue
} from "./graftClient";
import {
  getRestBaseUrl,
  getRestLargePayload,
  getRestSmallValue
} from "./restClient";
import {
  getPythonGatewayHost,
  getPythonGraftLargePayload,
  getPythonGraftSmallValue,
  getPythonGraftStateless,
  getPythonGraftTypeName
} from "./pythonGraftClient";
import {
  getPythonFastApiBaseUrl,
  getPythonFlaskBaseUrl,
  getPythonRestLargePayload,
  getPythonRestSmallValue
} from "./pythonRestClient";
import {
  BenchmarkClient,
  BenchmarkOptions,
  BenchmarkResult,
  runTransportBenchmark
} from "./benchmark";
import { saveBenchmarkLog } from "./logging";
import "./styles.css";

type RunState = "idle" | "running" | "done" | "error";

const defaultOptions: BenchmarkOptions = {
  smallCalls: 100,
  largeCalls: 10,
  sizeMb: 1,
  warmupCalls: 5
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function ResultTable({ results }: { results: BenchmarkResult[] }) {
  if (results.length === 0) {
    return null;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Case</th>
          <th>Transport</th>
          <th>Calls</th>
          <th>Mean</th>
          <th>Min</th>
          <th>Max</th>
          <th>Throughput</th>
          <th>Last value</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result) => (
          <tr key={result.name}>
            <td>{result.name}</td>
            <td>{result.transport}</td>
            <td>{result.calls}</td>
            <td>{formatNumber(result.meanMs)} ms</td>
            <td>{formatNumber(result.minMs)} ms</td>
            <td>{formatNumber(result.maxMs)} ms</td>
            <td>{formatNumber(result.throughput)} calls/s</td>
            <td>{result.lastValue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type BenchmarkPanelProps = {
  title: string;
  eyebrow: string;
  endpoints: string[];
  samplePrefix: string;
  clients: BenchmarkClient[];
};

function BenchmarkPanel({
  title,
  eyebrow,
  endpoints,
  samplePrefix,
  clients
}: BenchmarkPanelProps) {
  const [state, setState] = useState<RunState>("idle");
  const [smallCalls, setSmallCalls] = useState(defaultOptions.smallCalls);
  const [largeCalls, setLargeCalls] = useState(defaultOptions.largeCalls);
  const [sizeMb, setSizeMb] = useState(defaultOptions.sizeMb);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [sample, setSample] = useState("No sample yet");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const isRunning = state === "running";
  const logOptions = {
    smallCalls,
    largeCalls,
    sizeMb,
    warmupCalls: defaultOptions.warmupCalls
  };

  async function runSample() {
    setState("running");
    setError("");
    setProgress("Calling backend");

    try {
      const values = await Promise.all(
        clients.map(async (client) => {
          const [small, large] = await Promise.all([
            client.getSmallValue(),
            client.getLargePayload(sizeMb)
          ]);
          return `${client.label}=${small} ${large.payloadLength}/${large.sizeBytes}`;
        })
      );

      const sampleResult = `${samplePrefix}: ${values.join(" | ")}`;
      setSample(sampleResult);
      saveBenchmarkLog({
        kind: "sample",
        panel: title,
        status: "success",
        endpoints,
        options: logOptions,
        sample: sampleResult
      });
      setState("done");
      setProgress("");
    } catch (ex) {
      const message = ex instanceof Error ? ex.message : String(ex);
      setError(message);
      saveBenchmarkLog({
        kind: "sample",
        panel: title,
        status: "error",
        endpoints,
        options: logOptions,
        error: message
      });
      setState("error");
      setProgress("");
    }
  }

  async function runBenchmark() {
    setState("running");
    setError("");
    setResults([]);

    try {
      const benchmarkResults = await runTransportBenchmark(
        {
          smallCalls,
          largeCalls,
          sizeMb,
          warmupCalls: defaultOptions.warmupCalls,
          onProgress: (completed, total, label) => {
            setProgress(`${label}: ${completed}/${total}`);
          }
        },
        clients
      );

      setResults(benchmarkResults);
      saveBenchmarkLog({
        kind: "benchmark",
        panel: title,
        status: "success",
        endpoints,
        options: logOptions,
        results: benchmarkResults
      });
      setState("done");
      setProgress("");
    } catch (ex) {
      const message = ex instanceof Error ? ex.message : String(ex);
      setError(message);
      saveBenchmarkLog({
        kind: "benchmark",
        panel: title,
        status: "error",
        endpoints,
        options: logOptions,
        error: message
      });
      setState("error");
      setProgress("");
    }
  }

  return (
    <section className="benchmark-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <div className="endpoints">
            {endpoints.map((endpoint) => (
              <p className="endpoint" key={endpoint}>
                {endpoint}
              </p>
            ))}
          </div>
        </div>
        <div className={`status status-${state}`}>
          {isRunning ? progress || "Running" : state}
        </div>
      </div>

      <div className="workspace">
        <aside className="controls">
          <label>
            <span>Small calls</span>
            <input
              type="number"
              min="1"
              max="10000"
              value={smallCalls}
              disabled={isRunning}
              onChange={(event) => setSmallCalls(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Large calls</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={largeCalls}
              disabled={isRunning}
              onChange={(event) => setLargeCalls(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Large size MB</span>
            <input
              type="number"
              min="1"
              max="10"
              value={sizeMb}
              disabled={isRunning}
              onChange={(event) => setSizeMb(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={isRunning} onClick={runSample}>
            Call sample
          </button>
          <button type="button" disabled={isRunning} onClick={runBenchmark}>
            Run benchmark
          </button>
        </aside>

        <section className="results">
          <div className="sample">{sample}</div>
          {error && <pre className="error">{error}</pre>}
          <ResultTable results={results} />
        </section>
      </div>
    </section>
  );
}

export default function App() {
  const dotNetClients = useMemo<BenchmarkClient[]>(
    () => [
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
    ],
    []
  );

  const pythonClients = useMemo<BenchmarkClient[]>(
    () => [
      {
        label: "FastAPI REST",
        transport: "REST",
        getSmallValue: () => getPythonRestSmallValue("fastapi"),
        getLargePayload: (sizeMb) => getPythonRestLargePayload("fastapi", sizeMb)
      },
      {
        label: "Flask REST",
        transport: "REST",
        getSmallValue: () => getPythonRestSmallValue("flask"),
        getLargePayload: (sizeMb) => getPythonRestLargePayload("flask", sizeMb)
      },
      {
        label: "Graftcode",
        transport: "Graftcode",
        getSmallValue: getPythonGraftSmallValue,
        getLargePayload: getPythonGraftLargePayload
      }
    ],
    []
  );

  const gatewayHost = useMemo(() => getGatewayHost(), []);
  const graftStateless = useMemo(() => getGraftStateless(), []);
  const restBaseUrl = useMemo(() => getRestBaseUrl(), []);
  const pythonGatewayHost = useMemo(() => getPythonGatewayHost(), []);
  const pythonGraftStateless = useMemo(() => getPythonGraftStateless(), []);
  const pythonGraftType = useMemo(() => getPythonGraftTypeName(), []);
  const pythonFastApiBaseUrl = useMemo(() => getPythonFastApiBaseUrl(), []);
  const pythonFlaskBaseUrl = useMemo(() => getPythonFlaskBaseUrl(), []);

  return (
    <main>
      <section className="summary">
        <div>
          <p className="eyebrow">Transport benchmark</p>
          <h1>Performance Service</h1>
        </div>
      </section>

      <BenchmarkPanel
        title="React to .NET"
        eyebrow="Existing backend"
        samplePrefix=".NET"
        clients={dotNetClients}
        endpoints={[
          `REST ${restBaseUrl}`,
          `Graftcode ${gatewayHost} stateless=${String(graftStateless)}`
        ]}
      />

      <BenchmarkPanel
        title="React to Python"
        eyebrow="Python backend"
        samplePrefix="Python"
        clients={pythonClients}
        endpoints={[
          `FastAPI REST ${pythonFastApiBaseUrl}`,
          `Flask REST ${pythonFlaskBaseUrl}`,
          `Graftcode ${pythonGatewayHost} stateless=${String(pythonGraftStateless)}`,
          `Graftcode type ${pythonGraftType}`
        ]}
      />
    </main>
  );
}
