using GraftServer = graft.nuget.Performance.Graftcode.Server;

namespace Performance.Graftcode.Client;

public static class GraftClient
{
    private const string Host = "ws://localhost/ws";
    private static readonly GraftServer.PerformanceService Service = CreateService();

    public static GraftServer.SmallPayload GetSmall()
    {
        return Service.GetSmall();
    }

    public static GraftServer.LargePayload GetLarge(int sizeMb)
    {
        return Service.GetLarge(sizeMb);
    }

    private static GraftServer.PerformanceService CreateService()
    {
        GraftServer.GraftConfig.Host = Host;
        return new GraftServer.PerformanceService();
    }
}
