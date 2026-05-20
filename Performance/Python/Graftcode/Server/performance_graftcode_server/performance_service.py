from __future__ import annotations

from dataclasses import dataclass
from random import randint


@dataclass
class SmallPayload:
    value: int


@dataclass
class LargePayload:
    payload: str
    size_bytes: int


class PerformanceService:
    def get_small(self) -> SmallPayload:
        return SmallPayload(randint(1, 100))

    def get_large(self, size_mb: int = 5) -> LargePayload:
        if size_mb <= 0:
            raise ValueError("Payload size must be greater than zero.")

        size_bytes = size_mb * 1024 * 1024
        return LargePayload("x" * size_bytes, size_bytes)
