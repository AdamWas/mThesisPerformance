# Performance Study

This directory contains an isolated .NET-to-.NET performance study scaffold for three communication styles:

- REST over HTTP + JSON
- gRPC over HTTP/2 + Protocol Buffers
- Graftcode placeholder with the same business-method shape

The current implemented scenarios are:

- `small`: returns a small object with an integer value from 1 to 100.
- `large`: returns a payload with configurable size in MB, defaulting to `5`.

## Projects

- `Shared` - common payload records and business logic.
- `REST/Server` - ASP.NET Core Minimal API on `http://localhost:5100`.
- `REST/Client` - simple REST sanity client.
- `gRPC/Server` - ASP.NET Core gRPC service on `http://localhost:5101`.
- `gRPC/Client` - simple gRPC sanity client.
- `Graftcode/Server` - placeholder service class with matching methods.
- `Graftcode/Client` - placeholder local call until remote Graftcode invocation is wired.
- `Benchmarks` - BenchmarkDotNet client-side benchmarks for REST and gRPC.

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

Graftcode placeholder:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/Graftcode/Client/Performance.Graftcode.Client.csproj -c Release -- 5
```

## Benchmarks

Start the REST and gRPC servers first, then run:

```bash
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/Benchmarks/Performance.Benchmarks.csproj -c Release -- --filter '*CommunicationBenchmarks*'
```

The benchmark project uses BenchmarkDotNet warm-up and measurement phases. The `SizeMb` parameter is currently set to `5` in code and can be expanded into multiple values later.
