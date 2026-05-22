# Benchmark Commands

Komendy sa do uruchamiania z katalogu glownego repo:

```bash
cd /home/adam/Coding/mgr2/mThesisPerformance
```

## 1. Docker Compose

Terminal 1, uruchom wszystkie backendy i zostaw ten terminal wlaczony:

```bash
docker compose up --build
```

Po zakonczonych testach zatrzymaj backendy:

```bash
docker compose down
```

## 2. Benchmark .NET

Terminal 2, przy wlaczonym `docker compose up --build`:

```bash
cd /home/adam/Coding/mgr2/mThesisPerformance
DOTNET_CLI_HOME=/tmp dotnet run --project Performance/Benchmarks/Performance.Benchmarks.csproj -c Release -- --filter '*CommunicationBenchmarks*'
```

Raporty BenchmarkDotNet trafia do:

```text
Performance/Benchmarks/BenchmarkDotNet.Artifacts/
```

## 3. Benchmark Python

Terminal 2, przy wlaczonym `docker compose up --build`:

```bash
cd /home/adam/Coding/mgr2/mThesisPerformance
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

## 4. Frontend Do Benchmarku JS

Terminal 2, przy wlaczonym `docker compose up --build`:

```bash
cd /home/adam/Coding/mgr2/mThesisPerformance/Performance/ReactGraftcode
npm install
npm run dev
```

Vite zwykle wystartuje tutaj:

```text
http://localhost:5173/
```

