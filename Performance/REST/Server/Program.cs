using Performance.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5100");
builder.Services.AddSingleton<BenchmarkDataService>();

var app = builder.Build();

app.MapGet("/small", (BenchmarkDataService service) => service.GetSmall());

app.MapGet("/large", (BenchmarkDataService service, int sizeMb = 5) => service.GetLarge(sizeMb));

app.Run();
