from __future__ import annotations

import argparse
import importlib
import json
from pathlib import Path
import statistics
import sys
import time
from typing import Any, Callable
from urllib.request import urlopen

import grpc


ROOT = Path(__file__).resolve().parents[3]
GENERATED_DIR = ROOT / "Performance" / "Python" / "gRPC" / "generated"
sys.path.insert(0, str(GENERATED_DIR))

import performance_pb2  # type: ignore  # noqa: E402
import performance_pb2_grpc  # type: ignore  # noqa: E402


INSTALL_COMMAND = (
    "python -m pip install --extra-index-url "
    "https://grft.dev/simple/274021c2-9d69-4c67-9006-053188e20ec0__free "
    "graft-nuget-performance.graftcode.server==1.0.1"
)


def import_graft_module() -> Any:
    candidates = [
        "graft_nuget_performance_graftcode_server",
        "graft_nuget_performance.graftcode.server",
        "graft.nuget.performance.graftcode.server",
    ]

    for candidate in candidates:
        try:
            return importlib.import_module(candidate)
        except ModuleNotFoundError:
            continue

    raise ModuleNotFoundError(
        "Could not import the generated Graft package. Install it first with:\n"
        f"{INSTALL_COMMAND}"
    )


def read_attr_or_call(obj: Any, field_name: str) -> Any:
    snake_name = field_name[0].lower() + field_name[1:]
    field_candidates = (field_name, snake_name, "size_bytes" if field_name == "SizeBytes" else "")
    for name in field_candidates:
        if not name:
            continue
        if hasattr(obj, name):
            value = getattr(obj, name)
            return value() if callable(value) else value

    getter = f"get_{field_name}"
    if hasattr(obj, getter):
        return getattr(obj, getter)()

    raise AttributeError(f"Could not read field {field_name!r} from {type(obj)!r}")


def call_method(obj: Any, *method_names: str) -> Any:
    for method_name in method_names:
        if hasattr(obj, method_name):
            return getattr(obj, method_name)

    raise AttributeError(
        f"Could not find any method {method_names!r} on {type(obj)!r}"
    )


def timed(name: str, calls: int, invoke: Callable[[], str]) -> dict[str, Any]:
    samples: list[float] = []
    last_value = ""

    for _ in range(calls):
        started = time.perf_counter()
        last_value = invoke()
        samples.append((time.perf_counter() - started) * 1000)

    total_ms = sum(samples)
    return {
        "name": name,
        "calls": calls,
        "total_ms": round(total_ms, 2),
        "mean_ms": round(statistics.mean(samples), 2),
        "min_ms": round(min(samples), 2),
        "max_ms": round(max(samples), 2),
        "throughput": round((calls / total_ms) * 1000, 2),
        "last_value": last_value,
    }


def rest_json(base_url: str, path: str) -> dict[str, Any]:
    with urlopen(f"{base_url}{path}") as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fastapi-url", default="http://localhost:5200")
    parser.add_argument("--flask-url", default="http://localhost:5202")
    parser.add_argument("--grpc-target", default="localhost:5201")
    parser.add_argument("--graft-host", default="ws://localhost:5203/ws")
    parser.add_argument("--small-calls", type=int, default=100)
    parser.add_argument("--large-calls", type=int, default=10)
    parser.add_argument("--size-mb", type=int, default=1)
    args = parser.parse_args()

    with grpc.insecure_channel(
        args.grpc_target,
        options=[
            ("grpc.max_send_message_length", 16 * 1024 * 1024),
            ("grpc.max_receive_message_length", 16 * 1024 * 1024),
        ],
    ) as channel:
        grpc_client = performance_pb2_grpc.PerformanceServiceStub(channel)
        graft = import_graft_module()
        graft.GraftConfig.host = args.graft_host
        graft.GraftConfig.stateless = False
        graft_client = graft.PerformanceService()
        graft_get_small = call_method(graft_client, "GetSmall", "get_small")
        graft_get_large = call_method(graft_client, "GetLarge", "get_large")

        results = [
            timed(
                "FastAPI REST GetSmall",
                args.small_calls,
                lambda: str(rest_json(args.fastapi_url, "/small")["value"]),
            ),
            timed(
                "Flask REST GetSmall",
                args.small_calls,
                lambda: str(rest_json(args.flask_url, "/small")["value"]),
            ),
            timed(
                "gRPC GetSmall",
                args.small_calls,
                lambda: str(grpc_client.GetSmall(performance_pb2.SmallRequest()).value),
            ),
            timed(
                "Graftcode GetSmall",
                args.small_calls,
                lambda: str(read_attr_or_call(graft_get_small(), "Value")),
            ),
            timed(
                f"FastAPI REST GetLarge {args.size_mb} MB",
                args.large_calls,
                lambda: _format_rest_large(rest_json(args.fastapi_url, f"/large?sizeMb={args.size_mb}")),
            ),
            timed(
                f"Flask REST GetLarge {args.size_mb} MB",
                args.large_calls,
                lambda: _format_rest_large(rest_json(args.flask_url, f"/large?sizeMb={args.size_mb}")),
            ),
            timed(
                f"gRPC GetLarge {args.size_mb} MB",
                args.large_calls,
                lambda: _format_grpc_large(
                    grpc_client.GetLarge(performance_pb2.LargeRequest(size_mb=args.size_mb))
                ),
            ),
            timed(
                f"Graftcode GetLarge {args.size_mb} MB",
                args.large_calls,
                lambda: _format_graft_large(graft_get_large(args.size_mb)),
            ),
        ]

    print(json.dumps(results, indent=2))


def _format_rest_large(payload: dict[str, Any]) -> str:
    size_bytes = payload.get("size_bytes", payload.get("sizeBytes", 0))
    return f"{len(payload['payload'])}/{size_bytes} bytes"


def _format_grpc_large(payload: Any) -> str:
    return f"{len(payload.payload)}/{payload.size_bytes} bytes"


def _format_graft_large(payload: Any) -> str:
    body = read_attr_or_call(payload, "Payload")
    size_bytes = read_attr_or_call(payload, "SizeBytes")
    return f"{len(body)}/{size_bytes} bytes"


if __name__ == "__main__":
    main()
