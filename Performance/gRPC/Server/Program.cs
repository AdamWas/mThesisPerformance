using Grpc.Core;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Performance.Grpc;
using Performance.Shared;

var builder = WebApplication.CreateBuilder(args);

var grpcPort = int.TryParse(Environment.GetEnvironmentVariable("PERFORMANCE_GRPC_PORT"), out var configuredGrpcPort)
    ? configuredGrpcPort
    : 5101;
var listenAnyIp = bool.TryParse(Environment.GetEnvironmentVariable("PERFORMANCE_GRPC_LISTEN_ANY_IP"), out var configuredListenAnyIp)
    && configuredListenAnyIp;
var http2Only = bool.TryParse(Environment.GetEnvironmentVariable("PERFORMANCE_GRPC_HTTP2_ONLY"), out var configuredHttp2Only)
    && configuredHttp2Only;

builder.WebHost.ConfigureKestrel(options =>
{
    var configureHttp2 = (ListenOptions listenOptions) =>
    {
        listenOptions.Protocols = http2Only ? HttpProtocols.Http2 : HttpProtocols.Http1AndHttp2;
    };

    if (listenAnyIp)
    {
        options.ListenAnyIP(grpcPort, configureHttp2);
        return;
    }

    options.ListenLocalhost(grpcPort, configureHttp2);
});

builder.Services.AddGrpc(options =>
{
    options.MaxReceiveMessageSize = 16 * 1024 * 1024;
    options.MaxSendMessageSize = 16 * 1024 * 1024;
});
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(_ => true)
            .WithExposedHeaders("Grpc-Status", "Grpc-Message", "Grpc-Encoding", "Grpc-Accept-Encoding");
    });
});
builder.Services.AddSingleton<BenchmarkDataService>();

var app = builder.Build();

app.UseCors();
app.UseGrpcWeb();

app.MapGrpcService<GrpcPerformanceService>().EnableGrpcWeb();

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
