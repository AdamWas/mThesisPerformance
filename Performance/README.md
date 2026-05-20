# Performance Study

This directory contains a small performance playground for the same .NET business methods exposed through:

- REST over HTTP + JSON
- gRPC over HTTP/2 + Protocol Buffers
- Graftcode Gateway + generated Graft package
- React browser client calling REST, gRPC-Web, and Graftcode

The implemented scenarios are:

- `small` - returns a small object with an integer value from 1 to 100.
- `large` - returns a payload with configurable size in MB.

## Prerequisites

- Docker with Docker Compose
- .NET SDK 10
- Node.js and npm for the React client

## Projects

- `Shared` - common payload records and business logic.
- `REST/Server` - ASP.NET Core Minimal API on `http://localhost:5100`.
- `gRPC/Server` - ASP.NET Core gRPC and gRPC-Web service on `http://localhost:5101`.
- `Graftcode/Server` - .NET service hosted through Graftcode Gateway.
- `Benchmarks` - BenchmarkDotNet client-side benchmark for REST, gRPC, and Graftcode.
- `ReactGraftcode` - Vite/React browser client and benchmark for REST, gRPC-Web, and Graftcode.

## Start Backends

Run all services from the repository root, where `docker-compose.yml` lives:

```bash
docker compose up --build
```

This starts:

- REST server: `http://localhost:5100`
- gRPC and gRPC-Web server: `http://localhost:5101`
- Graftcode WebSocket endpoint: `ws://localhost:81/ws`
- Graftcode Vision: `http://localhost:5004/GV`

To start only one service:

```bash
docker compose up --build rest-server
docker compose up --build grpc-server
docker compose up --build graftcode-server
```

Stop everything with:

```bash
docker compose down
```

## Build .NET

From the repository root:

```bash
DOTNET_CLI_HOME=/tmp dotnet build Performance/Performance.slnx -c Release
```

## Run .NET Benchmark

Start the Docker services first:

```bash
docker compose up --build
```

Then run BenchmarkDotNet from another terminal:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/Benchmarks/Performance.Benchmarks.csproj -c Release -- --filter '*CommunicationBenchmarks*'
```

BenchmarkDotNet writes its generated reports under `Performance/Benchmarks/BenchmarkDotNet.Artifacts/` by default.

## Optional Sanity Clients

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

## Run React Client

Start the Docker services first:

```bash
docker compose up --build
```

Then install and start React from another terminal:

```bash
cd Performance/ReactGraftcode
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173/
```

The React page has:

- `Call sample` - one sample call through REST, gRPC-Web, and Graftcode.
- `Run benchmark` - browser-side timing for `GetSmall` and `GetLarge` through all three transports.

## React Configuration

Create or edit:

```text
Performance/ReactGraftcode/.env.local
```

Example:

```env
VITE_GRAFTCODE_HOST=ws://localhost:81/ws
VITE_GRAFTCODE_STATELESS=false
VITE_REST_BASE_URL=http://localhost:5100
VITE_GRPC_BASE_URL=http://localhost:5101
```

`VITE_GRAFTCODE_STATELESS` accepts values like `true`, `false`, `1`, `0`, `yes`, `no`.

Restart `npm run dev` after changing `.env.local`.
