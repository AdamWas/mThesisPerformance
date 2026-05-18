namespace Performance.Shared;

public sealed record SmallPayload(int Value);

public sealed record LargePayload(string Payload, int SizeBytes);
