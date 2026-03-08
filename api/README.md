# Cat Printer API

A simple API that accepts text and prints it to your MXW01 cat thermal printer via Bluetooth.

## Setup

```bash
cd api
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your printer's MAC address
```

## Run

```bash
python app.py
```

## Usage

### Print text

```bash
curl -X POST http://localhost:5000/print \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from the cat printer!"}'
```

### With options

```bash
curl -X POST http://localhost:5000/print \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Custom print!",
    "font": "Arial",
    "fontSize": 28,
    "align": "left"
  }'
```

### Health check

```bash
curl http://localhost:5000/health
```

## API Reference

### `POST /print`

| Field      | Type   | Required | Default      | Description                        |
|------------|--------|----------|--------------|------------------------------------|
| `text`     | string | ✅       |              | Text to print                      |
| `mac`      | string |          | from `.env`  | Printer Bluetooth MAC address      |
| `font`     | string |          | Courier New  | Font name                          |
| `fontSize` | int    |          | 32           | Font size                          |
| `align`    | string |          | center       | Text alignment: left/center/right  |
| `auth`     | string |          |              | API key (if `API_AUTH_KEY` is set)  |

Auth can also be sent via `X-API-Key` header.

### `GET /health`

Returns `{"status": "ok", "printer_mac": "..."}`.
