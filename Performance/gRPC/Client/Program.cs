using Grpc.Net.Client;
using Performance.Grpc;

var address = args.Length > 0 ? args[0] : "http://localhost:5101";
var sizeMb = args.Length > 1 ? int.Parse(args[1]) : 5;

using var channel = GrpcChannel.ForAddress(address, new GrpcChannelOptions
{
    MaxReceiveMessageSize = 16 * 1024 * 1024,
    MaxSendMessageSize = 16 * 1024 * 1024
});
var client = new PerformanceService.PerformanceServiceClient(channel);

var small = await client.GetSmallAsync(new SmallRequest());
var large = await client.GetLargeAsync(new LargeRequest { SizeMb = sizeMb });

Console.WriteLine($"Small value: {small.Value}");
Console.WriteLine($"Large payload bytes: {large.SizeBytes}");
