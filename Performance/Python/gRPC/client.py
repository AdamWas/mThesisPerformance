from __future__ import annotations

import argparse
from pathlib import Path
import sys

import grpc

GENERATED_DIR = Path(__file__).with_name("generated")
sys.path.insert(0, str(GENERATED_DIR))

import performance_pb2  # type: ignore  # noqa: E402
import performance_pb2_grpc  # type: ignore  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", default="localhost:5201")
    parser.add_argument("--calls", type=int, default=5)
    parser.add_argument("--size-mb", type=int, default=1)
    args = parser.parse_args()

    with grpc.insecure_channel(
        args.target,
        options=[
            ("grpc.max_send_message_length", 16 * 1024 * 1024),
            ("grpc.max_receive_message_length", 16 * 1024 * 1024),
        ],
    ) as channel:
        client = performance_pb2_grpc.PerformanceServiceStub(channel)
        for _ in range(args.calls):
            small = client.GetSmall(performance_pb2.SmallRequest())
            large = client.GetLarge(performance_pb2.LargeRequest(size_mb=args.size_mb))
            print(
                f"gRPC small={small.value} "
                f"large={len(large.payload)}/{large.size_bytes}"
            )


if __name__ == "__main__":
    main()
