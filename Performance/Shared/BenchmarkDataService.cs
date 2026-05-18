namespace Performance.Shared;

public sealed class BenchmarkDataService
{
    public SmallPayload GetSmall()
    {
        return new SmallPayload(Random.Shared.Next(1, 101));
    }

    public LargePayload GetLarge(int sizeMb)
    {
        if (sizeMb <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(sizeMb), "Payload size must be greater than zero.");
        }

        var sizeBytes = checked(sizeMb * 1024 * 1024);
        return new LargePayload(new string('x', sizeBytes), sizeBytes);
    }
}
