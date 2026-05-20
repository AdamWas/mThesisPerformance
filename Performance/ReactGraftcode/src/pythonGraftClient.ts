import { GraftConfig } from "@graft/nuget-performance.graftcode.server";

const defaultPythonGatewayHost = "ws://localhost:5203/ws";
const defaultPythonStateless = false;
const defaultPythonGraftName = "@graft/pypi-performance-python-graftcode-server";
const defaultPythonRuntime = "python";
const defaultPythonModule = "performance_graftcode_server";
const defaultPythonServiceType =
  "performance_graftcode_server.performance_service.PerformanceService";
const defaultSmallMethod = "get_small";
const defaultLargeMethod = "get_large";

let configuredKey: string | undefined;
let serviceInstance: any | undefined;

export function getPythonGatewayHost() {
  return import.meta.env?.VITE_PYTHON_GRAFTCODE_HOST || defaultPythonGatewayHost;
}

export function getPythonGraftStateless() {
  const value = import.meta.env?.VITE_PYTHON_GRAFTCODE_STATELESS;

  if (value == null || value.trim() === "") {
    return defaultPythonStateless;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function getPythonGraftTypeName() {
  return import.meta.env?.VITE_PYTHON_GRAFTCODE_TYPE || defaultPythonServiceType;
}

function getPythonGraftName() {
  return import.meta.env?.VITE_PYTHON_GRAFTCODE_NAME || defaultPythonGraftName;
}

function getPythonGraftRuntime() {
  return import.meta.env?.VITE_PYTHON_GRAFTCODE_RUNTIME || defaultPythonRuntime;
}

function getPythonGraftModule() {
  return import.meta.env?.VITE_PYTHON_GRAFTCODE_MODULE || defaultPythonModule;
}

function getSmallMethodName() {
  return import.meta.env?.VITE_PYTHON_GRAFTCODE_SMALL_METHOD || defaultSmallMethod;
}

function getLargeMethodName() {
  return import.meta.env?.VITE_PYTHON_GRAFTCODE_LARGE_METHOD || defaultLargeMethod;
}

export function configurePythonGraft() {
  const host = getPythonGatewayHost();
  const stateless = getPythonGraftStateless();
  const graftName = getPythonGraftName();
  const runtimeName = getPythonGraftRuntime();
  const moduleName = getPythonGraftModule();
  const typeName = getPythonGraftTypeName();
  const key = [host, stateless, graftName, runtimeName, moduleName, typeName].join("|");

  const alreadyConfigured =
    configuredKey === key &&
    GraftConfig.graftName === graftName &&
    GraftConfig.runtimeName === runtimeName &&
    GraftConfig.module === moduleName &&
    GraftConfig.host === host &&
    GraftConfig.stateless === stateless &&
    GraftConfig.rtmCtx != null;

  if (alreadyConfigured && serviceInstance) {
    return serviceInstance;
  }

  GraftConfig.graftName = graftName;
  GraftConfig.runtimeName = runtimeName;
  GraftConfig.module = moduleName;
  GraftConfig.host = host;
  GraftConfig.stateless = stateless;
  GraftConfig.rtmCtx = null;

  GraftConfig.init();
  serviceInstance = GraftConfig.rtmCtx.getType(typeName).createInstance();
  configuredKey = key;

  return serviceInstance;
}

export async function getPythonGraftSmallValue() {
  const payload = await callPythonServiceMethod(getSmallMethodName());
  return readAnyField<number>(payload, ["value", "Value"]);
}

export async function getPythonGraftLargePayload(sizeMb: number) {
  const payload = await callPythonServiceMethod(getLargeMethodName(), sizeMb);
  const [sizeBytes, body] = await Promise.all([
    readAnyField<number>(payload, ["size_bytes", "sizeBytes", "SizeBytes"]),
    readAnyField<string>(payload, ["payload", "Payload"])
  ]);

  return {
    sizeBytes,
    payloadLength: body.length
  };
}

async function callPythonServiceMethod(methodName: string, ...args: unknown[]) {
  return configurePythonGraft().invokeInstanceMethod(methodName, ...args).execute();
}

async function readAnyField<T>(target: any, fieldNames: string[]): Promise<T> {
  let lastError: unknown;

  for (const fieldName of fieldNames) {
    try {
      const field = await target.getInstanceField(fieldName).execute();
      return field.getValue() as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not read fields: ${fieldNames.join(", ")}`);
}
