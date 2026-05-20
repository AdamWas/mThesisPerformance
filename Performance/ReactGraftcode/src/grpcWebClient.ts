const defaultGrpcBaseUrl = "http://localhost:5101";
const servicePath = "/performance.PerformanceService";

export function getGrpcBaseUrl() {
  return import.meta.env?.VITE_GRPC_BASE_URL || defaultGrpcBaseUrl;
}

export async function getGrpcSmallValue() {
  const response = await callGrpcWeb(`${servicePath}/GetSmall`, new Uint8Array());
  return readInt32(response, 1);
}

export async function getGrpcLargePayload(sizeMb: number) {
  const response = await callGrpcWeb(
    `${servicePath}/GetLarge`,
    encodeLargeRequest(sizeMb)
  );

  const body = readString(response, 1);
  const sizeBytes = readInt32(response, 2);

  return {
    sizeBytes,
    payloadLength: body.length
  };
}

async function callGrpcWeb(methodPath: string, message: Uint8Array) {
  const response = await fetch(`${getGrpcBaseUrl()}${methodPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/grpc-web+proto",
      "x-grpc-web": "1"
    },
    body: frameMessage(message)
  });

  if (!response.ok) {
    throw new Error(`gRPC-Web call failed with HTTP ${response.status}`);
  }

  return readGrpcWebResponse(new Uint8Array(await response.arrayBuffer()));
}

function frameMessage(message: Uint8Array) {
  const framed = new Uint8Array(message.length + 5);
  const view = new DataView(framed.buffer);
  view.setUint8(0, 0);
  view.setUint32(1, message.length, false);
  framed.set(message, 5);
  return framed;
}

function readGrpcWebResponse(response: Uint8Array) {
  let offset = 0;
  let dataFrame: Uint8Array | undefined;
  let trailers = "";

  while (offset < response.length) {
    const flag = response[offset];
    const length =
      (response[offset + 1] << 24) |
      (response[offset + 2] << 16) |
      (response[offset + 3] << 8) |
      response[offset + 4];
    const frameStart = offset + 5;
    const frameEnd = frameStart + length;
    const frame = response.slice(frameStart, frameEnd);

    if ((flag & 0x80) === 0x80) {
      trailers += new TextDecoder().decode(frame);
    } else {
      dataFrame = frame;
    }

    offset = frameEnd;
  }

  if (!trailers.toLowerCase().includes("grpc-status: 0")) {
    throw new Error(`gRPC-Web call failed: ${trailers || "missing trailers"}`);
  }

  return dataFrame ?? new Uint8Array();
}

function encodeLargeRequest(sizeMb: number) {
  return new Uint8Array([0x08, ...encodeVarint(sizeMb)]);
}

function readInt32(message: Uint8Array, fieldNumber: number) {
  let offset = 0;

  while (offset < message.length) {
    const tag = readVarint(message, offset);
    offset = tag.offset;
    const currentField = tag.value >> 3;
    const wireType = tag.value & 0x07;

    if (currentField === fieldNumber && wireType === 0) {
      return readVarint(message, offset).value;
    }

    offset = skipField(message, offset, wireType);
  }

  return 0;
}

function readString(message: Uint8Array, fieldNumber: number) {
  let offset = 0;

  while (offset < message.length) {
    const tag = readVarint(message, offset);
    offset = tag.offset;
    const currentField = tag.value >> 3;
    const wireType = tag.value & 0x07;

    if (currentField === fieldNumber && wireType === 2) {
      const length = readVarint(message, offset);
      const start = length.offset;
      const end = start + length.value;
      return new TextDecoder().decode(message.slice(start, end));
    }

    offset = skipField(message, offset, wireType);
  }

  return "";
}

function skipField(message: Uint8Array, offset: number, wireType: number) {
  if (wireType === 0) {
    return readVarint(message, offset).offset;
  }

  if (wireType === 2) {
    const length = readVarint(message, offset);
    return length.offset + length.value;
  }

  if (wireType === 5) {
    return offset + 4;
  }

  if (wireType === 1) {
    return offset + 8;
  }

  throw new Error(`Unsupported protobuf wire type: ${wireType}`);
}

function readVarint(message: Uint8Array, startOffset: number) {
  let value = 0;
  let shift = 0;
  let offset = startOffset;

  while (offset < message.length) {
    const byte = message[offset];
    value |= (byte & 0x7f) << shift;
    offset += 1;

    if ((byte & 0x80) === 0) {
      return { value, offset };
    }

    shift += 7;
  }

  throw new Error("Invalid protobuf varint");
}

function encodeVarint(value: number) {
  const bytes: number[] = [];
  let current = value >>> 0;

  while (current > 0x7f) {
    bytes.push((current & 0x7f) | 0x80);
    current >>>= 7;
  }

  bytes.push(current);
  return bytes;
}
