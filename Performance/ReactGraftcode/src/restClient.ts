const defaultRestBaseUrl = "http://localhost:5100";

export function getRestBaseUrl() {
  return import.meta.env?.VITE_REST_BASE_URL || defaultRestBaseUrl;
}

export async function getRestSmallValue() {
  const response = await fetch(`${getRestBaseUrl()}/small`);

  if (!response.ok) {
    throw new Error(`REST GetSmall failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { value: number };
  return payload.value;
}

export async function getRestLargePayload(sizeMb: number) {
  const response = await fetch(`${getRestBaseUrl()}/large?sizeMb=${sizeMb}`);

  if (!response.ok) {
    throw new Error(`REST GetLarge failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    payload: string;
    sizeBytes: number;
  };

  return {
    sizeBytes: payload.sizeBytes,
    payloadLength: payload.payload.length
  };
}
