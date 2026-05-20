from __future__ import annotations

from dataclasses import asdict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Performance.Python.Common.performance_data import BenchmarkDataService


app = FastAPI(title="Performance Python FastAPI REST")
service = BenchmarkDataService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/small")
def get_small() -> dict[str, int]:
    return asdict(service.get_small())


@app.get("/large")
def get_large(sizeMb: int = 5) -> dict[str, int | str]:
    return asdict(service.get_large(sizeMb))
