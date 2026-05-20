import { useMemo, useState } from "react";
import {
  getGatewayHost,
  getGraftStateless,
  getLargePayload,
  getSmallValue
} from "./graftClient";
import {
  getGrpcBaseUrl,
  getGrpcLargePayload,
  getGrpcSmallValue
} from "./grpcWebClient";
import {
  getRestBaseUrl,
  getRestLargePayload,
  getRestSmallValue
} from "./restClient";
import {
  BenchmarkOptions,
  BenchmarkResult,
  runReactGraftBenchmark
} from "./benchmark";
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

export default function App() {
  const [state, setState] = useState<RunState>("idle");
  const [smallCalls, setSmallCalls] = useState(defaultOptions.smallCalls);
  const [largeCalls, setLargeCalls] = useState(defaultOptions.largeCalls);
  const [sizeMb, setSizeMb] = useState(defaultOptions.sizeMb);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [sample, setSample] = useState("No sample yet");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const gatewayHost = useMemo(() => getGatewayHost(), []);
  const graftStateless = useMemo(() => getGraftStateless(), []);
  const restBaseUrl = useMemo(() => getRestBaseUrl(), []);
  const grpcBaseUrl = useMemo(() => getGrpcBaseUrl(), []);
  const isRunning = state === "running";

  async function runSample() {
    setState("running");
    setError("");
    setProgress("Calling backend");

    try {
      const [rest, grpc, graftcode] = await Promise.all([
        Promise.all([getRestSmallValue(), getRestLargePayload(sizeMb)]),
        Promise.all([getGrpcSmallValue(), getGrpcLargePayload(sizeMb)]),
        Promise.all([getSmallValue(), getLargePayload(sizeMb)])
      ]);

      setSample(
        [
          `REST=${rest[0]} ${rest[1].payloadLength}/${rest[1].sizeBytes}`,
          `gRPC-Web=${grpc[0]} ${grpc[1].payloadLength}/${grpc[1].sizeBytes}`,
          `Graftcode=${graftcode[0]} ${graftcode[1].payloadLength}/${graftcode[1].sizeBytes}`
        ].join(" | ")
      );
      setState("done");
      setProgress("");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : String(ex));
      setState("error");
      setProgress("");
    }
  }

  async function runBenchmark() {
    setState("running");
    setError("");
    setResults([]);

    try {
      const benchmarkResults = await runReactGraftBenchmark({
        smallCalls,
        largeCalls,
        sizeMb,
        warmupCalls: defaultOptions.warmupCalls,
        onProgress: (completed, total, label) => {
          setProgress(`${label}: ${completed}/${total}`);
        }
      });

      setResults(benchmarkResults);
      setState("done");
      setProgress("");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : String(ex));
      setState("error");
      setProgress("");
    }
  }

  return (
    <main>
      <section className="summary">
        <div>
          <p className="eyebrow">React to .NET transport benchmark</p>
          <h1>Performance Service</h1>
          <div className="endpoints">
            <p className="endpoint">REST {restBaseUrl}</p>
            <p className="endpoint">gRPC-Web {grpcBaseUrl}</p>
            <p className="endpoint">
              Graftcode {gatewayHost} stateless={String(graftStateless)}
            </p>
          </div>
        </div>
        <div className={`status status-${state}`}>
          {isRunning ? progress || "Running" : state}
        </div>
      </section>

      <section className="workspace">
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
      </section>
    </main>
  );
}
