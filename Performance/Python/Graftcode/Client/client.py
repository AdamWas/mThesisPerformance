from __future__ import annotations

import argparse
import importlib
from typing import Any


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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="ws://localhost:5203/ws")
    parser.add_argument("--calls", type=int, default=5)
    parser.add_argument("--size-mb", type=int, default=1)
    args = parser.parse_args()

    graft = import_graft_module()
    graft.GraftConfig.host = args.host
    graft.GraftConfig.stateless = False

    service = graft.PerformanceService()
    get_small = call_method(service, "GetSmall", "get_small")
    get_large = call_method(service, "GetLarge", "get_large")

    for _ in range(args.calls):
        small = get_small()
        large = get_large(args.size_mb)
        print(
            f"Graftcode small={read_attr_or_call(small, 'Value')} "
            f"large={len(read_attr_or_call(large, 'Payload'))}/"
            f"{read_attr_or_call(large, 'SizeBytes')}"
        )


if __name__ == "__main__":
    main()
