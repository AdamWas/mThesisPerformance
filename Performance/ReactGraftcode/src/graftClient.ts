import {
  GraftConfig,
  PerformanceService
} from "@graft/nuget-performance.graftcode.server";

const defaultGatewayHost = "ws://localhost:81/ws";
const defaultStateless = false;

let configuredHost: string | undefined;
let configuredStateless: boolean | undefined;
let service: PerformanceService | undefined;

export function getGatewayHost() {
  return import.meta.env?.VITE_GRAFTCODE_HOST || defaultGatewayHost;
}

export function getGraftStateless() {
  const value = import.meta.env?.VITE_GRAFTCODE_STATELESS;

  if (value == null || value.trim() === "") {
    return defaultStateless;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function configureGraft(
  host = getGatewayHost(),
  stateless = getGraftStateless()
) {
  if (configuredHost === host && configuredStateless === stateless && service) {
    return service;
  }

  GraftConfig.host = host;
  GraftConfig.stateless = stateless;
  GraftConfig.rtmCtx = null;
  configuredHost = host;
  configuredStateless = stateless;
  service = new PerformanceService();

  return service;
}

export async function getSmallValue() {
  const payload = await callServiceMethod("GetSmall");
  return readField<number>(payload, "Value");
}

export async function getLargePayload(sizeMb: number) {
  const payload = await callServiceMethod("GetLarge", sizeMb);
  const [sizeBytes, body] = await Promise.all([
    readField<number>(payload, "SizeBytes"),
    readField<string>(payload, "Payload")
  ]);

  return {
    sizeBytes,
    payloadLength: body.length
  };
}

async function callServiceMethod(methodName: string, ...args: unknown[]) {
  const serviceInstance = configureGraft().instance;
  return serviceInstance.invokeInstanceMethod(methodName, ...args).execute();
}

async function readField<T>(target: any, fieldName: string): Promise<T> {
  const field = await target.getInstanceField(fieldName).execute();
  return field.getValue() as T;
}
