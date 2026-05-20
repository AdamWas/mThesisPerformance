from __future__ import annotations

from concurrent import futures
import os
from pathlib import Path
import sys

import grpc

from Performance.Python.Common.performance_data import BenchmarkDataService

GENERATED_DIR = Path(__file__).with_name("generated")
sys.path.insert(0, str(GENERATED_DIR))

import performance_pb2  # type: ignore  # noqa: E402
import performance_pb2_grpc  # type: ignore  # noqa: E402


class PerformanceGrpcService(performance_pb2_grpc.PerformanceServiceServicer):
    def __init__(self) -> None:
        self._service = BenchmarkDataService()

    def GetSmall(self, request, context):
        payload = self._service.get_small()
        return performance_pb2.SmallReply(value=payload.value)

    def GetLarge(self, request, context):
        size_mb = request.size_mb if request.size_mb > 0 else 5
        payload = self._service.get_large(size_mb)
        return performance_pb2.LargeReply(
            payload=payload.payload,
            size_bytes=payload.size_bytes,
        )


def serve() -> None:
    port = int(os.environ.get("PERFORMANCE_PYTHON_GRPC_PORT", "5201"))
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_send_message_length", 16 * 1024 * 1024),
            ("grpc.max_receive_message_length", 16 * 1024 * 1024),
        ],
    )
    performance_pb2_grpc.add_PerformanceServiceServicer_to_server(
        PerformanceGrpcService(),
        server,
    )
    server.add_insecure_port(f"0.0.0.0:{port}")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
