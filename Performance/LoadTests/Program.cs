using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.RegularExpressions;
using Grpc.Core;
using Grpc.Net.Client;
using Hypertube.Netcore.Sdk;
using Performance.Grpc;
using Performance.Shared;
using DotNetGraft = graft.nuget.Performance.Graftcode.Server;
using PythonGraftConfig = graft.pypi.performance_python_graftcode_server.GraftConfig;

var options = LoadOptions.Parse(args);
var endpoints = EndpointCatalog.Resolve(options.Endpoints);
var allResults = new List<LevelResult>();

foreach (var endpoint in endpoints)
{
    var bestRps = 0.0;
    Console.WriteLine();
    Console.WriteLine($"{endpoint.Name} / {options.Scenario}");

    if (options.Warmup > TimeSpan.Zero)
    {
        using var warmupClient = CreateClientOrReport(endpoint, options);
        if (warmupClient is null)
        {
            continue;
        }

        await LoadRunner.RunLevelAsync(
            warmupClient,
            options.Scenario,
            concurrency: 1,
            duration: options.Warmup,
            options);
    }

    foreach (var concurrency in options.Concurrency)
    {
        using var client = CreateClientOrReport(endpoint, options);
        if (client is null)
        {
            break;
        }

        var result = await LoadRunner.RunLevelAsync(
            client,
            options.Scenario,
            concurrency,
            options.Duration,
            options,
            bestRps);

        allResults.Add(result);
        bestRps = Math.Max(bestRps, result.Rps);
        Console.WriteLine(result.ToDisplayString());

        if (!options.KeepGoing && result.Saturated)
        {
            break;
        }
    }
}

if (!string.IsNullOrWhiteSpace(options.JsonOut))
{
    var json = System.Text.Json.JsonSerializer.Serialize(
        allResults,
        new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(options.JsonOut, json);
}

static ILoadClient? CreateClientOrReport(EndpointDefinition endpoint, LoadOptions options)
{
    try
    {
        return endpoint.CreateClient(options);
    }
    catch (Exception exception)
    {
        Console.WriteLine($"unavailable: {exception.GetType().Name}: {exception.Message}");
        return null;
    }
}

public enum Scenario
{
    Small,
    Large
}

public sealed record LoadOptions(
    string[] Endpoints,
    Scenario Scenario,
    int[] Concurrency,
    TimeSpan Duration,
    TimeSpan Warmup,
    int SizeMb,
    TimeSpan Timeout,
    double MaxErrorRate,
    double MaxP95Ms,
    double RpsDropRatio,
    bool KeepGoing,
    string? JsonOut,
    string DotNetRestUrl,
    string DotNetGrpcUrl,
    string DotNetGraftHost,
    string PythonFastApiUrl,
    string PythonFlaskUrl,
    string PythonGrpcTarget,
    string PythonGraftHost)
{
    public static LoadOptions Parse(string[] args)
    {
        var values = ReadArgs(args);
        return new LoadOptions(
            Endpoints: GetMany(values, "endpoint", "all"),
            Scenario: Enum.Parse<Scenario>(Get(values, "scenario", "small"), ignoreCase: true),
            Concurrency: Get(values, "concurrency", "1,2,4,8,16,32,64")
                .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .Select(ParseInt)
                .ToArray(),
            Duration: TimeSpan.FromSeconds(ParseDouble(Get(values, "duration-s", "15"))),
            Warmup: TimeSpan.FromSeconds(ParseDouble(Get(values, "warmup-s", "2"))),
            SizeMb: ParseInt(Get(values, "size-mb", "1")),
            Timeout: TimeSpan.FromSeconds(ParseDouble(Get(values, "timeout-s", "10"))),
            MaxErrorRate: ParseDouble(Get(values, "max-error-rate", "0.01")),
            MaxP95Ms: ParseDouble(Get(values, "max-p95-ms", "1000")),
            RpsDropRatio: ParseDouble(Get(values, "rps-drop-ratio", "0.85")),
            KeepGoing: values.ContainsKey("keep-going"),
            JsonOut: values.TryGetValue("json-out", out var jsonOut) ? jsonOut.LastOrDefault() : null,
            DotNetRestUrl: Get(values, "dotnet-rest-url", "http://localhost:5100"),
            DotNetGrpcUrl: Get(values, "dotnet-grpc-url", "http://localhost:5101"),
            DotNetGraftHost: Get(values, "dotnet-graft-host", "ws://localhost:81/ws"),
            PythonFastApiUrl: Get(values, "python-fastapi-url", "http://localhost:5200"),
            PythonFlaskUrl: Get(values, "python-flask-url", "http://localhost:5202"),
            PythonGrpcTarget: Get(values, "python-grpc-target", "http://localhost:5201"),
            PythonGraftHost: Get(values, "python-graft-host", "ws://localhost:5203/ws"));
    }

    private static Dictionary<string, List<string>> ReadArgs(string[] args)
    {
        var values = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            if (!arg.StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var name = arg[2..];
            if (i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                Add(values, name, args[++i]);
            }
            else
            {
                Add(values, name, "true");
            }
        }

        return values;
    }

    private static void Add(Dictionary<string, List<string>> values, string name, string value)
    {
        if (!values.TryGetValue(name, out var list))
        {
            list = [];
            values[name] = list;
        }

        list.Add(value);
    }

    private static string Get(Dictionary<string, List<string>> values, string name, string fallback)
    {
        return values.TryGetValue(name, out var list) ? list.Last() : fallback;
    }

    private static string[] GetMany(Dictionary<string, List<string>> values, string name, string fallback)
    {
        return values.TryGetValue(name, out var list) ? list.ToArray() : [fallback];
    }

    private static int ParseInt(string value)
    {
        return int.Parse(value, CultureInfo.InvariantCulture);
    }

    private static double ParseDouble(string value)
    {
        return double.Parse(value, CultureInfo.InvariantCulture);
    }
}

public sealed record EndpointDefinition(string Name, Func<LoadOptions, ILoadClient> CreateClient);

public static class EndpointCatalog
{
    private static readonly Dictionary<string, EndpointDefinition> Endpoints = new(StringComparer.OrdinalIgnoreCase)
    {
        ["dotnet-rest"] = new("dotnet-rest", options => new RestLoadClient(options.DotNetRestUrl, options)),
        ["dotnet-grpc"] = new("dotnet-grpc", options => new GrpcLoadClient("dotnet-grpc", options.DotNetGrpcUrl, options)),
        ["dotnet-graft"] = new("dotnet-graft", options => new DotNetGraftLoadClient(options.DotNetGraftHost, options)),
        ["python-fastapi"] = new("python-fastapi", options => new RestLoadClient(options.PythonFastApiUrl, options, "python-fastapi")),
        ["python-flask"] = new("python-flask", options => new RestLoadClient(options.PythonFlaskUrl, options, "python-flask")),
        ["python-grpc"] = new("python-grpc", options => new GrpcLoadClient("python-grpc", options.PythonGrpcTarget, options)),
        ["python-graft"] = new("python-graft", options => new PythonGraftLoadClient(options.PythonGraftHost, options))
    };

    public static IReadOnlyList<EndpointDefinition> Resolve(IReadOnlyList<string> names)
    {
        if (names.Any(name => name.Equals("all", StringComparison.OrdinalIgnoreCase)))
        {
            return Endpoints.Values.ToArray();
        }

        return names.Select(name =>
        {
            if (!Endpoints.TryGetValue(name, out var endpoint))
            {
                throw new ArgumentException(
                    $"Unknown endpoint '{name}'. Available: all, {string.Join(", ", Endpoints.Keys)}");
            }

            return endpoint;
        }).ToArray();
    }
}

public interface ILoadClient : IDisposable
{
    string Name { get; }
    Task<int> SmallAsync(CancellationToken cancellationToken);
    Task<int> LargeAsync(int sizeMb, CancellationToken cancellationToken);
}

public sealed class RestLoadClient : ILoadClient
{
    private readonly HttpClient httpClient;

    public RestLoadClient(string baseUrl, LoadOptions options, string name = "dotnet-rest")
    {
        Name = name;
        httpClient = new HttpClient
        {
            BaseAddress = new Uri(baseUrl),
            Timeout = options.Timeout
        };
    }

    public string Name { get; }

    public async Task<int> SmallAsync(CancellationToken cancellationToken)
    {
        var payload = await httpClient.GetFromJsonAsync<SmallPayload>("/small", cancellationToken);
        return payload!.Value;
    }

    public async Task<int> LargeAsync(int sizeMb, CancellationToken cancellationToken)
    {
        var payload = await httpClient.GetFromJsonAsync<LargePayload>($"/large?sizeMb={sizeMb}", cancellationToken);
        return payload!.SizeBytes;
    }

    public void Dispose()
    {
        httpClient.Dispose();
    }
}

public sealed class GrpcLoadClient : ILoadClient
{
    private readonly GrpcChannel channel;
    private readonly PerformanceService.PerformanceServiceClient client;

    public GrpcLoadClient(string name, string address, LoadOptions options)
    {
        Name = name;
        channel = GrpcChannel.ForAddress(address, new GrpcChannelOptions
        {
            MaxReceiveMessageSize = 64 * 1024 * 1024,
            MaxSendMessageSize = 64 * 1024 * 1024
        });
        client = new PerformanceService.PerformanceServiceClient(channel);
        Timeout = options.Timeout;
    }

    public string Name { get; }
    private TimeSpan Timeout { get; }

    public async Task<int> SmallAsync(CancellationToken cancellationToken)
    {
        var payload = await client.GetSmallAsync(
            new SmallRequest(),
            deadline: DateTime.UtcNow.Add(Timeout),
            cancellationToken: cancellationToken);
        return payload.Value;
    }

    public async Task<int> LargeAsync(int sizeMb, CancellationToken cancellationToken)
    {
        var payload = await client.GetLargeAsync(
            new LargeRequest { SizeMb = sizeMb },
            deadline: DateTime.UtcNow.Add(Timeout),
            cancellationToken: cancellationToken);
        return payload.SizeBytes;
    }

    public void Dispose()
    {
        channel.Dispose();
    }
}

public sealed class DotNetGraftLoadClient : ILoadClient
{
    private readonly DotNetGraft.PerformanceService client;

    public DotNetGraftLoadClient(string host, LoadOptions options)
    {
        Name = "dotnet-graft";
        DotNetGraft.GraftConfig.Host = host;
        DotNetGraft.GraftConfig.Stateless = false;
        client = new DotNetGraft.PerformanceService();
    }

    public string Name { get; }

    public Task<int> SmallAsync(CancellationToken cancellationToken)
    {
        return Task.Run(() => client.GetSmall().Value, cancellationToken);
    }

    public Task<int> LargeAsync(int sizeMb, CancellationToken cancellationToken)
    {
        return Task.Run(() => client.GetLarge(sizeMb).SizeBytes, cancellationToken);
    }

    public void Dispose()
    {
    }
}

public sealed class PythonGraftLoadClient : ILoadClient
{
    private readonly InvocationContext instanceContext;

    public PythonGraftLoadClient(string host, LoadOptions options)
    {
        Name = "python-graft";
        PythonGraftConfig.Host = host;
        PythonGraftConfig.Stateless = false;
        typeof(PythonGraftConfig)
            .GetMethod("init", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            ?.Invoke(null, null);

        var runtimeContext = GetRuntimeContext();
        instanceContext = runtimeContext
            .GetType("performance_graftcode_server.performance_service.PerformanceService")
            .CreateInstance()
            .Execute();
    }

    public string Name { get; }

    public Task<int> SmallAsync(CancellationToken cancellationToken)
    {
        return Task.Run((Func<int>)(() =>
        {
            object? value = instanceContext
                .InvokeInstanceMethod("get_small", [])
                .Execute()
                .GetInstanceField("value")
                .Execute()
                .GetValue();
            return ResultReader.ReadInt(value, "value", "Value");
        }), cancellationToken);
    }

    public Task<int> LargeAsync(int sizeMb, CancellationToken cancellationToken)
    {
        return Task.Run((Func<int>)(() =>
        {
            object? value = instanceContext
                .InvokeInstanceMethod("get_large", [sizeMb])
                .Execute()
                .GetInstanceField("size_bytes")
                .Execute()
                .GetValue();
            return ResultReader.ReadInt(value, "size_bytes", "SizeBytes");
        }), cancellationToken);
    }

    public void Dispose()
    {
    }

    private static RuntimeContext GetRuntimeContext()
    {
        var field = typeof(PythonGraftConfig).GetField(
            "rtmCtx",
            BindingFlags.Static | BindingFlags.NonPublic);

        return (RuntimeContext)(field?.GetValue(null)
            ?? throw new InvalidOperationException("Python Graftcode runtime context is not initialized."));
    }
}

public static class ResultReader
{
    public static int ReadInt(object? value, params string[] names)
    {
        if (value is null)
        {
            throw new InvalidOperationException("Graftcode returned null.");
        }

        if (value is int intValue)
        {
            return intValue;
        }

        if (value is string text)
        {
            return ReadIntFromString(text, names);
        }

        var type = value.GetType();
        foreach (var name in names)
        {
            var property = type.GetProperty(name);
            if (property?.GetValue(value) is { } propertyValue)
            {
                return Convert.ToInt32(propertyValue);
            }

            var field = type.GetField(name);
            if (field?.GetValue(value) is { } fieldValue)
            {
                return Convert.ToInt32(fieldValue);
            }
        }

        throw new InvalidOperationException($"Cannot read {string.Join("/", names)} from {type.FullName}.");
    }

    private static int ReadIntFromString(string text, params string[] names)
    {
        if (int.TryParse(text, out var intValue))
        {
            return intValue;
        }

        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(text);
            foreach (var name in names)
            {
                if (document.RootElement.TryGetProperty(name, out var property) &&
                    property.TryGetInt32(out var propertyValue))
                {
                    return propertyValue;
                }
            }
        }
        catch (System.Text.Json.JsonException)
        {
        }

        foreach (var name in names)
        {
            var match = Regex.Match(text, $@"\b{Regex.Escape(name)}\b\s*[:=]\s*(\d+)");
            if (match.Success)
            {
                return int.Parse(match.Groups[1].Value);
            }
        }

        throw new InvalidOperationException($"Cannot read {string.Join("/", names)} from string result.");
    }
}

public static class LoadRunner
{
    public static async Task<LevelResult> RunLevelAsync(
        ILoadClient client,
        Scenario scenario,
        int concurrency,
        TimeSpan duration,
        LoadOptions options,
        double bestRps = 0)
    {
        using var cts = new CancellationTokenSource(duration);
        var started = Stopwatch.GetTimestamp();
        var tasks = Enumerable.Range(0, concurrency)
            .Select(_ => RunWorkerAsync(client, scenario, options.SizeMb, cts.Token))
            .ToArray();

        var workerResults = await Task.WhenAll(tasks);
        var elapsed = Stopwatch.GetElapsedTime(started);
        var latencies = workerResults.SelectMany(result => result.LatenciesMs).ToArray();
        var errors = workerResults.Sum(result => result.Errors);
        var errorSample = workerResults.Select(result => result.ErrorSample).FirstOrDefault(error => error is not null);
        var ok = latencies.Length;
        var total = ok + errors;
        var rps = ok / elapsed.TotalSeconds;
        var errorRate = total == 0 ? 0 : (double)errors / total;
        var p95 = Percentile(latencies, 0.95);
        var reasons = new List<string>();

        if (total > 0 && errorRate >= options.MaxErrorRate)
        {
            reasons.Add($"error_rate>={options.MaxErrorRate:P0}");
        }

        if (p95 is not null && p95 >= options.MaxP95Ms)
        {
            reasons.Add($"p95>={options.MaxP95Ms:0}ms");
        }

        if (bestRps > 0 && rps < bestRps * options.RpsDropRatio)
        {
            reasons.Add($"rps_drop>{1 - options.RpsDropRatio:P0}");
        }

        return new LevelResult(
            client.Name,
            scenario.ToString().ToLowerInvariant(),
            concurrency,
            Math.Round(elapsed.TotalSeconds, 3),
            total,
            ok,
            errors,
            Math.Round(errorRate, 4),
            Math.Round(rps, 2),
            RoundOrNull(latencies.Length == 0 ? null : latencies.Average()),
            RoundOrNull(Percentile(latencies, 0.50)),
            RoundOrNull(p95),
            RoundOrNull(Percentile(latencies, 0.99)),
            RoundOrNull(latencies.Length == 0 ? null : latencies.Max()),
            errorSample,
            reasons.Count > 0,
            reasons);
    }

    private static async Task<WorkerResult> RunWorkerAsync(
        ILoadClient client,
        Scenario scenario,
        int sizeMb,
        CancellationToken cancellationToken)
    {
        var latencies = new List<double>();
        var errors = 0;
        string? errorSample = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            var started = Stopwatch.GetTimestamp();
            try
            {
                if (scenario == Scenario.Small)
                {
                    await client.SmallAsync(cancellationToken);
                }
                else
                {
                    await client.LargeAsync(sizeMb, cancellationToken);
                }

                latencies.Add(Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (RpcException exception)
                when (cancellationToken.IsCancellationRequested && exception.StatusCode == StatusCode.Cancelled)
            {
                break;
            }
            catch
            (Exception exception)
            {
                errors++;
                errorSample ??= $"{exception.GetType().Name}: {exception.Message}";
            }
        }

        return new WorkerResult(latencies, errors, errorSample);
    }

    private static double? Percentile(double[] values, double percentile)
    {
        if (values.Length == 0)
        {
            return null;
        }

        Array.Sort(values);
        var rank = (values.Length - 1) * percentile;
        var lower = (int)Math.Floor(rank);
        var upper = Math.Min(lower + 1, values.Length - 1);
        var weight = rank - lower;
        return values[lower] * (1 - weight) + values[upper] * weight;
    }

    private static double? RoundOrNull(double? value)
    {
        return value is null ? null : Math.Round(value.Value, 2);
    }

    private sealed record WorkerResult(List<double> LatenciesMs, int Errors, string? ErrorSample);
}

public sealed record LevelResult(
    string Endpoint,
    string Scenario,
    int Concurrency,
    double ElapsedS,
    int Requests,
    int Ok,
    int Errors,
    double ErrorRate,
    double Rps,
    double? MeanMs,
    double? P50Ms,
    double? P95Ms,
    double? P99Ms,
    double? MaxMs,
    string? ErrorSample,
    bool Saturated,
    IReadOnlyList<string> SaturationReasons)
{
    public string ToDisplayString()
    {
        var reason = SaturationReasons.Count == 0 ? "-" : string.Join(",", SaturationReasons);
        var error = ErrorSample is null ? "" : $" error=\"{ErrorSample}\"";
        return $"c={Concurrency,-3} t={ElapsedS,6:0.00}s ok={Ok,-7} err={Errors,-5} " +
               $"rps={Rps,-9:0.00} p50={Format(P50Ms),9} p95={Format(P95Ms),9} " +
               $"p99={Format(P99Ms),9} saturated={reason}{error}";
    }

    private static string Format(double? value)
    {
        return value is null ? "-" : $"{value:0.00}ms";
    }
}
