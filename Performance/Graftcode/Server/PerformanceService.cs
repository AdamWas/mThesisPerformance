using Performance.Shared;

namespace Performance.Graftcode.Server;

public sealed class PerformanceService
{
    private readonly BenchmarkDataService dataService = new();

    public SmallPayload GetSmall()
    {
        var payload = dataService.GetSmall();
        return new SmallPayload(payload.Value);
    }

    public LargePayload GetLarge(int sizeMb = 5)
    {
        var payload = dataService.GetLarge(sizeMb);
        return new LargePayload(payload.Payload, payload.SizeBytes);
    }
}
