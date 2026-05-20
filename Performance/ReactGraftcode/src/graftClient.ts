import {
  GraftConfig,
  PerformanceService
} from "@graft/nuget-performance.graftcode.server";

const defaultGatewayHost = "ws://localhost:81/ws";

let configuredHost: string | undefined;
let service: PerformanceService | undefined;

export function getGatewayHost() {
  return import.meta.env?.VITE_GRAFTCODE_HOST || defaultGatewayHost;
}

export function configureGraft(host = getGatewayHost()) {
  if (configuredHost === host && service) {
    return service;
  }

  GraftConfig.host = host;
  GraftConfig.rtmCtx = null;
  configuredHost = host;
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
