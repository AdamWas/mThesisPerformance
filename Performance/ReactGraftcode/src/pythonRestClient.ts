const defaultFastApiBaseUrl = "http://localhost:5200";
const defaultFlaskBaseUrl = "http://localhost:5202";

export type PythonRestTarget = "fastapi" | "flask";

export function getPythonFastApiBaseUrl() {
  return import.meta.env?.VITE_PYTHON_FASTAPI_BASE_URL || defaultFastApiBaseUrl;
}

export function getPythonFlaskBaseUrl() {
  return import.meta.env?.VITE_PYTHON_FLASK_BASE_URL || defaultFlaskBaseUrl;
}

function getPythonRestBaseUrl(target: PythonRestTarget) {
  return target === "fastapi" ? getPythonFastApiBaseUrl() : getPythonFlaskBaseUrl();
}

function getTargetLabel(target: PythonRestTarget) {
  return target === "fastapi" ? "FastAPI" : "Flask";
}

export async function getPythonRestSmallValue(target: PythonRestTarget) {
  const response = await fetch(`${getPythonRestBaseUrl(target)}/small`);

  if (!response.ok) {
    throw new Error(
      `${getTargetLabel(target)} REST GetSmall failed with HTTP ${response.status}`
    );
  }

  const payload = (await response.json()) as { value: number };
  return payload.value;
}

export async function getPythonRestLargePayload(
  target: PythonRestTarget,
  sizeMb: number
) {
  const response = await fetch(`${getPythonRestBaseUrl(target)}/large?sizeMb=${sizeMb}`);

  if (!response.ok) {
    throw new Error(
      `${getTargetLabel(target)} REST GetLarge failed with HTTP ${response.status}`
    );
  }

  const payload = (await response.json()) as {
    payload: string;
    size_bytes?: number;
    sizeBytes?: number;
  };

  return {
    sizeBytes: payload.size_bytes ?? payload.sizeBytes ?? 0,
    payloadLength: payload.payload.length
  };
}
