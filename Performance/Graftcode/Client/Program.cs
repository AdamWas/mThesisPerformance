using Performance.Graftcode.Server;

var sizeMb = args.Length > 0 ? int.Parse(args[0]) : 5;

// Placeholder until the Graftcode remote invocation layer is wired.
var service = new PerformanceService();
var small = service.GetSmall();
var large = service.GetLarge(sizeMb);

Console.WriteLine("Graftcode remote invocation is not wired yet; this is a local placeholder call.");
Console.WriteLine($"Small value: {small.Value}");
Console.WriteLine($"Large payload bytes: {large.SizeBytes}");
