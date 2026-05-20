from __future__ import annotations

from dataclasses import asdict

from flask import Flask, jsonify, request
from flask_cors import CORS

from Performance.Python.Common.performance_data import BenchmarkDataService


app = Flask(__name__)
CORS(app)
service = BenchmarkDataService()


@app.get("/small")
def get_small():
    return jsonify(asdict(service.get_small()))


@app.get("/large")
def get_large():
    size_mb = request.args.get("sizeMb", default=5, type=int)
    return jsonify(asdict(service.get_large(size_mb)))
