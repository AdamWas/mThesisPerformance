using System.Net.Http.Json;
using Performance.Shared;

var baseAddress = args.Length > 0 ? args[0] : "http://localhost:5100";
var sizeMb = args.Length > 1 ? int.Parse(args[1]) : 5;

using var httpClient = new HttpClient
{
    BaseAddress = new Uri(baseAddress)
};

var small = await httpClient.GetFromJsonAsync<SmallPayload>("/small");
var large = await httpClient.GetFromJsonAsync<LargePayload>($"/large?sizeMb={sizeMb}");

Console.WriteLine($"Small value: {small?.Value}");
Console.WriteLine($"Large payload bytes: {large?.SizeBytes}");
