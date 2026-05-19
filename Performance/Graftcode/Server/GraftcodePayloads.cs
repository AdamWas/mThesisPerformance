namespace Performance.Graftcode.Server;

public class SmallPayload
{
    public SmallPayload()
    {
    }

    public SmallPayload(int value)
    {
        Value = value;
    }

    public int Value { get; set; }
}

public class LargePayload
{
    public LargePayload()
    {
    }

    public LargePayload(string payload, int sizeBytes)
    {
        Payload = payload;
        SizeBytes = sizeBytes;
    }

    public string Payload { get; set; } = string.Empty;

    public int SizeBytes { get; set; }
}
