# Performance Study

This directory contains an isolated performance study scaffold for three communication styles and a browser client:

- REST over HTTP + JSON
- gRPC over HTTP/2 + Protocol Buffers
- Graftcode with the same business-method shape
- React frontend calling the .NET Graftcode service through the generated Graft package

The current implemented scenarios are:

- `small`: returns a small object with an integer value from 1 to 100.
- `large`: returns a payload with configurable size in MB, defaulting to `5`.

## Projects

- `Shared` - common payload records and business logic.
- `REST/Server` - ASP.NET Core Minimal API on `http://localhost:5100`.
- `REST/Client` - simple REST sanity client.
- `gRPC/Server` - ASP.NET Core gRPC service on `http://localhost:5101`.
- `gRPC/Client` - simple gRPC sanity client.
- `Graftcode/Server` - .NET service class hosted through Graftcode Gateway.
- `Graftcode/Client` - .NET sanity client using the generated Graft package.
- `ReactGraftcode` - Vite/React browser client and benchmark for React -> .NET calls.
- `Benchmarks` - BenchmarkDotNet client-side benchmarks for REST, gRPC, and Graftcode.

## Build

```bash
DOTNET_CLI_HOME=/tmp dotnet build Performance/Performance.slnx -c Release
```

## Run Services

Run REST server:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/REST/Server/Performance.Rest.Server.csproj -c Release
```

Run gRPC server:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/gRPC/Server/Performance.Grpc.Server.csproj -c Release
```

## Sanity Clients

REST:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/REST/Client/Performance.Rest.Client.csproj -c Release -- http://localhost:5100 5
```

gRPC:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/gRPC/Client/Performance.Grpc.Client.csproj -c Release -- http://localhost:5101 5
```

Graftcode:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/Graftcode/Client/Performance.Graftcode.Client.csproj -c Release -- 5
```

## React -> .NET Graftcode Client

Start the Graftcode gateway first:

```bash
docker compose up --build graftcode-server
```

Install the generated Graft package and run the React client:

```bash
cd Performance/ReactGraftcode
npm install
npm run dev
```

The React client defaults to:

- REST: `http://localhost:5100`
- gRPC-Web: `http://localhost:5101`
- Graftcode: `ws://localhost:81/ws`

Override them with `VITE_REST_BASE_URL`, `VITE_GRPC_BASE_URL`, or `VITE_GRAFTCODE_HOST` when needed:

```bash
VITE_REST_BASE_URL=http://localhost:5100 VITE_GRPC_BASE_URL=http://localhost:5101 VITE_GRAFTCODE_HOST=ws://localhost:81/ws npm run dev
```

The page includes a sample call and a browser-side benchmark for REST, gRPC-Web, and Graftcode. The large-payload cases read `Payload` in addition to `SizeBytes`, so the measurement forces the full payload through the React client.

## Benchmarks

Start the REST, gRPC, and Graftcode servers first, then run:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/Benchmarks/Performance.Benchmarks.csproj -c Release -- --filter '*CommunicationBenchmarks*'
```

The benchmark project uses BenchmarkDotNet warm-up and measurement phases. The `SizeMb` parameter is currently set to `5` in code and can be expanded into multiple values later.
