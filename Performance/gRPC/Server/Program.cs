using Grpc.Core;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Performance.Grpc;
using Performance.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenLocalhost(5101, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http2;
    });
});

builder.Services.AddGrpc(options =>
{
    options.MaxReceiveMessageSize = 16 * 1024 * 1024;
    options.MaxSendMessageSize = 16 * 1024 * 1024;
});
builder.Services.AddSingleton<BenchmarkDataService>();

var app = builder.Build();

app.MapGrpcService<GrpcPerformanceService>();

app.Run();

public sealed class GrpcPerformanceService(BenchmarkDataService dataService) : PerformanceService.PerformanceServiceBase
{
    public override Task<SmallReply> GetSmall(SmallRequest request, ServerCallContext context)
    {
        var payload = dataService.GetSmall();
        return Task.FromResult(new SmallReply { Value = payload.Value });
    }

    public override Task<LargeReply> GetLarge(LargeRequest request, ServerCallContext context)
    {
        var sizeMb = request.SizeMb > 0 ? request.SizeMb : 5;
        var payload = dataService.GetLarge(sizeMb);

        return Task.FromResult(new LargeReply
        {
            Payload = payload.Payload,
            SizeBytes = payload.SizeBytes
        });
    }
}
