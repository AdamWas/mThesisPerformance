using System.Net.Http.Json;
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Running;
using Grpc.Net.Client;
using Performance.Grpc;
using Performance.Shared;
using GraftServer = graft.nuget.Performance.Graftcode.Server;

BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);

[MemoryDiagnoser]
public class CommunicationBenchmarks
{
    private HttpClient restClient = null!;
    private GrpcChannel grpcChannel = null!;
    private PerformanceService.PerformanceServiceClient grpcClient = null!;
    private GraftServer.PerformanceService graftClient = null!;

    [Params("http://localhost:5100")]
    public string RestBaseAddress { get; set; } = "http://localhost:5100";

    [Params("http://localhost:5101")]
    public string GrpcAddress { get; set; } = "http://localhost:5101";

    [Params(5)]
    public int SizeMb { get; set; }

    [GlobalSetup]
    public void Setup()
    {
        restClient = new HttpClient
        {
            BaseAddress = new Uri(RestBaseAddress)
        };

        grpcChannel = GrpcChannel.ForAddress(GrpcAddress, new GrpcChannelOptions
        {
            MaxReceiveMessageSize = 16 * 1024 * 1024,
            MaxSendMessageSize = 16 * 1024 * 1024
        });

        grpcClient = new PerformanceService.PerformanceServiceClient(grpcChannel);

        GraftServer.GraftConfig.Host = "ws://localhost:81/ws";
    }

    [GlobalCleanup]
    public void Cleanup()
    {
        restClient.Dispose();
        grpcChannel.Dispose();
    }

    [Benchmark(Baseline = true)]
    public async Task<int> RestSmall()
    {
        var payload = await restClient.GetFromJsonAsync<SmallPayload>("/small");
        return payload!.Value;
    }

    [Benchmark]
    public async Task<int> GrpcSmall()
    {
        var payload = await grpcClient.GetSmallAsync(new SmallRequest());
        return payload.Value;
    }

    [Benchmark]
    public int GraftSmall()
    {
        var payload = GetGraftClient().GetSmall();
        return payload.Value;
    }

    [Benchmark]
    public async Task<int> RestLarge()
    {
        var payload = await restClient.GetFromJsonAsync<LargePayload>($"/large?sizeMb={SizeMb}");
        return payload!.SizeBytes;
    }

    [Benchmark]
    public async Task<int> GrpcLarge()
    {
        var payload = await grpcClient.GetLargeAsync(new LargeRequest { SizeMb = SizeMb });
        return payload.SizeBytes;
    }

    [Benchmark]
    public int GraftLarge()
    {
        var payload = GetGraftClient().GetLarge(SizeMb);
        return payload.SizeBytes;
    }

    private GraftServer.PerformanceService GetGraftClient()
    {
        return graftClient ??= new GraftServer.PerformanceService();
    }
}
