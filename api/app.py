"""
Cat Printer API

A simple Flask API that accepts text and prints it to a cat printer via BLE.

Endpoints:
    POST /print   - Print text to the cat printer
    GET  /health  - Health check
"""

import asyncio
import os

from flask import Flask, request, jsonify

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from printer import print_text

app = Flask(__name__)

PRINTER_MAC = os.environ.get("PRINTER_MAC", "48:0F:57:27:B4:B5")
API_AUTH_KEY = os.environ.get("API_AUTH_KEY", "")
FONT_NAME = os.environ.get("FONT_NAME", "Courier New")
FONT_SIZE = int(os.environ.get("FONT_SIZE", "32"))


@app.route("/print", methods=["POST"])
def handle_print():
    # Auth check (if key is configured)
    if API_AUTH_KEY:
        auth = request.headers.get("X-API-Key") or (request.get_json(silent=True) or {}).get("auth")
        if auth != API_AUTH_KEY:
            return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True)
    if not data or not data.get("text"):
        return jsonify({"error": "Missing 'text' in JSON body"}), 400

    text = data["text"]
    mac = data.get("mac", PRINTER_MAC)
    font_name = data.get("font", FONT_NAME)
    font_size = data.get("fontSize", FONT_SIZE)
    alignment = data.get("align", "center")

    # Run the async BLE print on a fresh event loop
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        success, message = loop.run_until_complete(
            print_text(mac, text, font_name, font_size, alignment)
        )
        loop.close()
    except Exception as e:
        return jsonify({"error": f"Print failed: {e}"}), 500

    if success:
        return jsonify({"status": "ok", "message": message}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "printer_mac": PRINTER_MAC}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"Cat Printer API starting on port {port}")
    print(f"Printer MAC: {PRINTER_MAC}")
    app.run(host="0.0.0.0", port=port)
