using Performance.Graftcode.Client;

var sizeMb = args.Length > 0 ? int.Parse(args[0]) : 5;

var small = GraftClient.GetSmall();
var large = GraftClient.GetLarge(sizeMb);

Console.WriteLine($"Small value: {small.Value}");
Console.WriteLine($"Large payload bytes: {large.SizeBytes}");
