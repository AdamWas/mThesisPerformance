type BenchmarkLogPayload = {
  kind: "sample" | "benchmark";
  panel: string;
  status: "success" | "error";
  timestamp: string;
  endpoints: string[];
  options: {
    smallCalls: number;
    largeCalls: number;
    sizeMb: number;
    warmupCalls: number;
  };
  sample?: string;
  results?: unknown[];
  error?: string;
};

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function safeFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function saveBenchmarkLog(payload: Omit<BenchmarkLogPayload, "timestamp">) {
  const timestamp = formatTimestamp(new Date());
  const fileName = [
    "js-benchmark",
    safeFilePart(payload.panel),
    payload.kind,
    payload.status,
    timestamp
  ].join("-") + ".json";

  const body = JSON.stringify(
    {
      ...payload,
      timestamp
    },
    null,
    2
  );

  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
