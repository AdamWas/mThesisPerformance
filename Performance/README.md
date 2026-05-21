# Performance Study

This directory contains a small performance playground for the same .NET business methods exposed through:

- REST over HTTP + JSON
- gRPC over HTTP/2 + Protocol Buffers
- Graftcode Gateway + generated Graft package
- React browser client calling REST and Graftcode
- Python backend variants for REST, gRPC, and Graftcode

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
- `gRPC/Server` - ASP.NET Core gRPC service on `http://localhost:5101`.
- `Graftcode/Server` - .NET service hosted through Graftcode Gateway.
- `Python/REST/FastAPI` - Python REST server on `http://localhost:5200`.
- `Python/gRPC` - Python native gRPC server on `localhost:5201`.
- `Python/REST/Flask` - Python REST server on `http://localhost:5202`.
- `Python/Graftcode/Server` - Python service hosted through Graftcode Gateway on `ws://localhost:5203/ws`.
- `Python/Benchmarks` - Python-side benchmark for FastAPI REST, Flask REST, native gRPC, and Graftcode.
- `Benchmarks` - BenchmarkDotNet client-side benchmark for REST, gRPC, and Graftcode.
- `ReactGraftcode` - Vite/React browser client and benchmark for .NET and Python backend sections.

## Start Backends

Run all services from the repository root, where `docker-compose.yml` lives:

```bash
docker compose up --build
```

This starts:

- REST server: `http://localhost:5100`
- gRPC server: `http://localhost:5101`
- Graftcode WebSocket endpoint: `ws://localhost:81/ws`
- Graftcode Vision: `http://localhost:5004/GV`
- Python FastAPI REST: `http://localhost:5200`
- Python native gRPC: `localhost:5201`
- Python Flask REST: `http://localhost:5202`
- Python Graftcode WebSocket endpoint: `ws://localhost:5203/ws`
- Python Graftcode Vision: `http://localhost:5204/GV`

To start only one service:

```bash
docker compose up --build rest-server
docker compose up --build grpc-server
docker compose up --build graftcode-server
docker compose up --build python-fastapi-server
docker compose up --build python-grpc-server
docker compose up --build python-flask-server
docker compose up --build python-graftcode-server
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

Python gRPC:

```bash
source .venv/bin/activate
python -m pip install -r Performance/Python/gRPC/requirements.txt
mkdir -p Performance/Python/gRPC/generated
python -m grpc_tools.protoc \
  -IPerformance/Python/gRPC \
  --python_out=Performance/Python/gRPC/generated \
  --grpc_python_out=Performance/Python/gRPC/generated \
  Performance/Python/gRPC/performance.proto
touch Performance/Python/gRPC/generated/__init__.py
python -m Performance.Python.gRPC.client --target localhost:5201 --calls 5
```

Python Graftcode client:

```bash
source .venv/bin/activate
python -m pip install --extra-index-url https://grft.dev/simple/274021c2-9d69-4c67-9006-053188e20ec0__free graft-nuget-performance.graftcode.server==1.0.1
python -m Performance.Python.Graftcode.Client.client --host ws://localhost:5203/ws --calls 5
```

The Python Graftcode client sets `GraftConfig.stateless = False` in code.

## Run Python Benchmark

Start the Docker services first:

```bash
docker compose up --build python-fastapi-server python-grpc-server python-flask-server python-graftcode-server
```

Then run the Python benchmark from another terminal:

```bash
source .venv/bin/activate
python -m pip install -r Performance/Python/Benchmarks/requirements.txt --extra-index-url https://grft.dev/simple/8ec149dd-e85d-4ee1-b554-25ef86b33351__free
mkdir -p Performance/Python/gRPC/generated
python -m grpc_tools.protoc \
  -IPerformance/Python/gRPC \
  --python_out=Performance/Python/gRPC/generated \
  --grpc_python_out=Performance/Python/gRPC/generated \
  Performance/Python/gRPC/performance.proto
touch Performance/Python/gRPC/generated/__init__.py
python -m Performance.Python.Benchmarks.benchmark
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

- `React to .NET` - one sample or benchmark through REST and Graftcode.
- `React to Python` - one sample or benchmark through FastAPI REST, Flask REST, and Graftcode.

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
VITE_PYTHON_FASTAPI_BASE_URL=http://localhost:5200
VITE_PYTHON_FLASK_BASE_URL=http://localhost:5202
VITE_PYTHON_GRAFTCODE_HOST=ws://localhost:5203/ws
VITE_PYTHON_GRAFTCODE_STATELESS=false
VITE_PYTHON_GRAFTCODE_TYPE=performance_graftcode_server.performance_service.PerformanceService
VITE_PYTHON_GRAFTCODE_SMALL_METHOD=get_small
VITE_PYTHON_GRAFTCODE_LARGE_METHOD=get_large
```

`VITE_GRAFTCODE_STATELESS` accepts values like `true`, `false`, `1`, `0`, `yes`, `no`.
`VITE_PYTHON_GRAFTCODE_STATELESS` accepts the same values and is intentionally a React-side flag.

Restart `npm run dev` after changing `.env.local`.
