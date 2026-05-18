using Performance.Shared;

namespace Performance.Graftcode.Server;

public sealed class PerformanceService
{
    private readonly BenchmarkDataService dataService = new();

    public SmallPayload GetSmall()
    {
        return dataService.GetSmall();
    }

    public LargePayload GetLarge(int sizeMb = 5)
    {
        return dataService.GetLarge(sizeMb);
    }
}
