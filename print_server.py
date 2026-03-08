"""
Flask server that accepts markdown text and prints it on the MX01W thermal printer.

Usage:
    python print_server.py

Runs on localhost:2221. Send POST /print with JSON body:
    { "text": "# Hello\\n\\n- bullet one\\n- bullet two\\n\\nSome **bold** text" }

Markdown features supported:
    - Headers (#, ##, ###) rendered at larger font sizes
    - Bullet points (- or *) rendered with bullet character
    - Numbered lists (1. 2. etc.)
    - Blank lines as spacing
    - Regular paragraphs with word wrapping
"""

import asyncio
import logging
import os
import re
import math
import sys
import time

from flask import Flask, request, jsonify
from bleak import BleakClient
from bleak.exc import BleakError
from PIL import Image, ImageDraw, ImageFont

# --- Logging Setup ---
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger('print_server')

try:
    from matplotlib import font_manager
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    font_manager = None

# --- Printer Constants ---
DEFAULT_ADDRESS = "48:0F:57:27:B4:B5"
CONTROL_WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000ae02-0000-1000-8000-00805f9b34fb"
DATA_WRITE_UUID = "0000ae03-0000-1000-8000-00805f9b34fb"

PRINTER_WIDTH_PIXELS = 384
PRINTER_WIDTH_BYTES = PRINTER_WIDTH_PIXELS // 8

# --- Font Settings ---
DEFAULT_FONT_NAME = "Arial"
FONT_SIZES = {
    "h1": 36,
    "h2": 30,
    "h3": 26,
    "body": 20,
    "bullet": 20,
}
LINE_SPACING = 6  # pixels between rendered blocks
PARAGRAPH_SPACING = 14  # pixels for blank lines


# --- Globals for BLE notification handling ---
received_responses = {}
notification_condition = asyncio.Condition()


# --- Font Handling (from provided code) ---
def load_font(font_name, font_size):
    log.debug(f"Loading font: name='{font_name}', size={font_size}")
    font_path = None
    if MATPLOTLIB_AVAILABLE:
        matching_fonts = []
        try:
            for f in font_manager.fontManager.ttflist:
                if f.name == font_name:
                    matching_fonts.append(f)
        except Exception:
            matching_fonts = []

        log.debug(f"  Found {len(matching_fonts)} matching fonts for '{font_name}'")

        style_indicators = ['bd', 'bold', 'bld', 'i', 'italic', 'obl', 'oblique', 'blk', 'black', 'narrow', 'n']
        plain_font_path = None
        first_match_path = None
        if matching_fonts:
            first_match_path = matching_fonts[0].fname
            for f in matching_fonts:
                base_name = os.path.basename(f.fname).lower()
                name_part, _ = os.path.splitext(base_name)
                is_plain = True
                if name_part == font_name.lower() + 'n':
                    is_plain = False
                elif any(ind in name_part.replace(font_name.lower(), '') for ind in style_indicators if ind != 'n'):
                    is_plain = False
                if is_plain:
                    plain_font_path = f.fname
                    break
            font_path = plain_font_path or first_match_path

        if not font_path:
            try:
                font_path = font_manager.findfont(font_name, fallback_to_default=False)
            except Exception:
                font_path = None

    if font_path:
        log.debug(f"  Using font path: {font_path}")
        try:
            return ImageFont.truetype(font_path, font_size)
        except IOError as e:
            log.warning(f"  Failed to load font file '{font_path}': {e}")

    # Fallback
    log.debug(f"  Falling back to default font '{DEFAULT_FONT_NAME}'")
    if MATPLOTLIB_AVAILABLE:
        try:
            default_path = font_manager.findfont(DEFAULT_FONT_NAME, fallback_to_default=True)
            if default_path:
                return ImageFont.truetype(default_path, font_size)
        except Exception:
            pass

    log.warning("  Using PIL built-in default font")
    try:
        return ImageFont.load_default()
    except IOError:
        log.error("  CRITICAL: Could not load ANY font!")
        return None


def load_bold_font(font_name, font_size):
    """Attempt to load a bold variant of the given font."""
    log.debug(f"Loading BOLD font: name='{font_name}', size={font_size}")
    if not MATPLOTLIB_AVAILABLE:
        log.debug("  matplotlib unavailable, falling back to regular font")
        return load_font(font_name, font_size)
    bold_indicators = ['bd', 'bold', 'bld']
    try:
        for f in font_manager.fontManager.ttflist:
            if f.name == font_name:
                base = os.path.basename(f.fname).lower()
                name_part, _ = os.path.splitext(base)
                suffix = name_part.replace(font_name.lower(), '')
                if any(ind in suffix for ind in bold_indicators):
                    log.debug(f"  Found bold variant: {f.fname}")
                    try:
                        return ImageFont.truetype(f.fname, font_size)
                    except IOError:
                        pass
    except Exception:
        pass
    log.debug("  No bold variant found, using regular font")
    return load_font(font_name, font_size)


# --- CRC / Command helpers (from provided code) ---
def crc8_update(crc, data_byte):
    crc ^= data_byte
    for _ in range(8):
        if crc & 0x80:
            crc = (crc << 1) ^ 0x07
        else:
            crc <<= 1
        crc &= 0xFF
    return crc


def calculate_crc8(data):
    crc = 0x00
    for byte in data:
        crc = crc8_update(crc, byte)
    return crc


def create_command_with_crc(command_id, data):
    data_length_le = len(data).to_bytes(2, byteorder='little')
    crc = calculate_crc8(data)
    return bytes([0x22, 0x21, command_id, 0x00]) + data_length_le + data + bytes([crc, 0xFF])


def create_command_simple(command_id, data):
    data_length_le = len(data).to_bytes(2, byteorder='little')
    return bytes([0x22, 0x21, command_id, 0x00]) + data_length_le + data + bytes([0x00, 0x00])


# --- Image processing (from provided code) ---
def process_image(img):
    pixels = list(img.getdata())
    width, height = img.size
    processed_data = bytearray()
    for y in range(height):
        byte = 0
        for x in range(width):
            pixel_index = y * width + x
            pixel_value = pixels[pixel_index]
            if pixel_value == 0:
                byte |= (1 << (x % 8))
            if (x + 1) % 8 == 0 or (x + 1) == width:
                processed_data.append(byte)
                byte = 0
    return bytes(processed_data)


# --- BLE communication (from provided code) ---
async def notification_handler(sender, data):
    global received_responses
    cmd_id, payload = parse_response(data)
    if cmd_id is not None:
        log.debug(f"  BLE NOTIFY: cmd=0x{cmd_id:02X}, payload={payload.hex() if payload else 'None'}")
        async with notification_condition:
            received_responses[cmd_id] = payload
            notification_condition.notify_all()


def parse_response(data):
    if not data or len(data) < 8 or data[0] != 0x22 or data[1] != 0x21:
        return None, None
    command_id = data[2]
    payload_len = int.from_bytes(data[4:6], 'little')
    if len(data) < 6 + payload_len:
        return command_id, None
    payload = data[6:6 + payload_len]
    return command_id, payload


def check_a1_status(payload):
    if not payload or len(payload) < 8:
        log.warning("  A1 status: payload too short or missing")
        return False
    ok = payload[6] == 0
    log.info(f"  A1 status check: {'OK' if ok else 'FAILED'} (byte={payload[6]})")
    return ok


def check_a9_status(payload):
    if not payload or len(payload) < 1:
        log.warning("  A9 status: payload too short or missing")
        return False
    ok = payload[0] == 0
    log.info(f"  A9 print request: {'ACCEPTED' if ok else 'REJECTED'} (byte={payload[0]})")
    return ok


async def run_print_job(client, img_final, job_description):
    global received_responses
    log.info(f"=== PRINT JOB START: '{job_description}' ===")
    if img_final is None:
        log.error("  No image data provided!")
        return False

    printer_data = process_image(img_final)
    image_height = img_final.height
    log.info(f"  Image: {img_final.width}x{image_height}px, data={len(printer_data)} bytes")

    try:
        ae01_char = client.services.get_characteristic(CONTROL_WRITE_UUID)
        ae02_char = client.services.get_characteristic(NOTIFY_UUID)
        ae03_char = client.services.get_characteristic(DATA_WRITE_UUID)
        if not all([ae01_char, ae02_char, ae03_char]):
            raise ValueError("Missing GATT characteristic")
        log.debug("  GATT characteristics resolved OK")
    except Exception as e:
        log.error(f"  Error getting GATT characteristics: {e}")
        return False

    cmd_setup_b1 = create_command_with_crc(0xB1, bytes([0x00]))
    cmd_setup_a2_1 = create_command_with_crc(0xA2, bytes([0x5D]))
    cmd_setup_a1_1 = create_command_with_crc(0xA1, bytes([0x00]))
    cmd_setup_a2_2 = create_command_with_crc(0xA2, bytes([0x5D]))
    image_height_le = image_height.to_bytes(2, 'little')
    width_bytes_le = PRINTER_WIDTH_BYTES.to_bytes(2, 'little')
    cmd_print_request_a9 = create_command_simple(0xA9, image_height_le + width_bytes_le)
    cmd_end_print_ad = create_command_simple(0xAD, bytes([0x00]))

    try:
        # Step 1: Setup sequence (B1, A2, A1) → wait for A1 response
        log.info("  Step 1/4: Sending setup commands (B1, A2, A1)...")
        async with notification_condition:
            received_responses.pop(0xA1, None)
        for cmd in [cmd_setup_b1, cmd_setup_a2_1, cmd_setup_a1_1]:
            await client.write_gatt_char(ae01_char.uuid, cmd, response=False)
            await asyncio.sleep(0.01)
        log.debug("  Waiting for A1 response...")
        async with notification_condition:
            try:
                await asyncio.wait_for(
                    notification_condition.wait_for(lambda: 0xA1 in received_responses), timeout=7.0)
            except asyncio.TimeoutError:
                raise ValueError("Timeout waiting for A1")
            if not check_a1_status(received_responses.pop(0xA1)):
                raise ValueError("A1 status check failed")

        # Step 2: Print request (A2, A9) → wait for A9 response
        log.info(f"  Step 2/4: Sending print request (height={image_height}, width_bytes={PRINTER_WIDTH_BYTES})...")
        async with notification_condition:
            received_responses.pop(0xA9, None)
        for cmd in [cmd_setup_a2_2, cmd_print_request_a9]:
            await client.write_gatt_char(ae01_char.uuid, cmd, response=False)
            await asyncio.sleep(0.01)
        log.debug("  Waiting for A9 response...")
        async with notification_condition:
            try:
                await asyncio.wait_for(
                    notification_condition.wait_for(lambda: 0xA9 in received_responses), timeout=7.0)
            except asyncio.TimeoutError:
                raise ValueError("Timeout waiting for A9")
            if not check_a9_status(received_responses.pop(0xA9)):
                raise ValueError("A9 status check failed")

        # Step 3: Send image data in 20-byte chunks
        max_chunk = 20
        total_chunks = math.ceil(len(printer_data) / max_chunk)
        log.info(f"  Step 3/4: Sending image data ({len(printer_data)} bytes in {total_chunks} chunks)...")
        for j in range(0, len(printer_data), max_chunk):
            chunk = printer_data[j:j + max_chunk]
            await client.write_gatt_char(ae03_char.uuid, chunk, response=False)
        log.info("  Image data sent successfully")

        # Step 4: End print (AD) → wait for AA (print complete)
        log.info("  Step 4/4: Sending end-print command (AD), waiting for AA...")
        async with notification_condition:
            received_responses.pop(0xAA, None)
        await client.write_gatt_char(ae01_char.uuid, cmd_end_print_ad, response=False)
        await asyncio.sleep(0.01)

        async with notification_condition:
            try:
                timeout_print = max(15.0, image_height / 20.0)
                log.debug(f"  AA timeout set to {timeout_print:.1f}s")
                await asyncio.wait_for(
                    notification_condition.wait_for(lambda: 0xAA in received_responses), timeout=timeout_print)
                received_responses.pop(0xAA)
                log.info("  AA received — print complete!")
            except asyncio.TimeoutError:
                log.warning("  AA not received within timeout (print may still have succeeded)")
        await asyncio.sleep(0.5)
        log.info(f"=== PRINT JOB DONE: '{job_description}' ===")
        return True
    except Exception as e:
        log.error(f"  PRINT JOB FAILED: '{job_description}' — {e}")
        return False


async def connect_and_print(target_address, jobs):
    log.info(f"Connecting to printer at {target_address} (timeout=20s)...")
    try:
        async with BleakClient(target_address, timeout=20.0) as client:
            if not client.is_connected:
                log.error("Failed to connect to printer")
                return False
            log.info(f"Connected to {client.address}")
            await client.start_notify(NOTIFY_UUID, notification_handler)
            log.debug("BLE notifications enabled")
            all_ok = True
            for i, (img, desc) in enumerate(jobs):
                log.info(f"--- Job {i+1}/{len(jobs)} ---")
                ok = await run_print_job(client, img, desc)
                if not ok:
                    all_ok = False
                if i < len(jobs) - 1:
                    log.debug("Pausing 1s between jobs...")
                    await asyncio.sleep(1.0)
            await asyncio.sleep(1.0)
            try:
                await client.stop_notify(NOTIFY_UUID)
            except Exception:
                pass
            log.info(f"Disconnected. Overall result: {'SUCCESS' if all_ok else 'SOME JOBS FAILED'}")
            return all_ok
    except BleakError as e:
        log.error(f"Bluetooth error: {e}")
        return False
    except asyncio.TimeoutError:
        log.error("Connection timed out after 20s")
        return False
    except Exception as e:
        log.error(f"Unexpected BLE error: {e}")
        return False


# --- Markdown Parsing ---
def strip_inline_markup(text):
    """Remove bold/italic markdown markers for clean rendering."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'_(.+?)_', r'\1', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    return text


def parse_markdown(md_text):
    """
    Parse markdown text into a list of blocks.
    Each block is a dict: { "type": "h1"|"h2"|"h3"|"bullet"|"numbered"|"paragraph"|"blank", "text": "..." }
    """
    blocks = []
    lines = md_text.split('\n')
    log.debug(f"Parsing markdown: {len(lines)} lines")

    for line in lines:
        stripped = line.strip()

        if not stripped:
            blocks.append({"type": "blank", "text": ""})
            continue

        # Headers
        m = re.match(r'^(#{1,3})\s+(.*)', stripped)
        if m:
            level = len(m.group(1))
            blocks.append({"type": f"h{level}", "text": strip_inline_markup(m.group(2))})
            continue

        # Bullet points (- or *)
        m = re.match(r'^[-*]\s+(.*)', stripped)
        if m:
            blocks.append({"type": "bullet", "text": strip_inline_markup(m.group(1))})
            continue

        # Numbered list
        m = re.match(r'^(\d+)\.\s+(.*)', stripped)
        if m:
            blocks.append({"type": "numbered", "text": strip_inline_markup(m.group(2)), "num": m.group(1)})
            continue

        # Regular paragraph
        blocks.append({"type": "paragraph", "text": strip_inline_markup(stripped)})

    log.info(f"Parsed {len(blocks)} blocks: {', '.join(b['type'] for b in blocks)}")
    return blocks


def get_text_width(font, txt):
    if not txt:
        return 0
    try:
        return font.getlength(txt)
    except AttributeError:
        return font.getsize(txt)[0]


def render_text_block(text, font, width, indent=0):
    """Render a text string into a 1-bit image with word wrapping."""
    usable_width = width - indent
    lines = []
    words = text.split(' ')
    current_line = ""
    for word in words:
        test = current_line + (" " if current_line else "") + word
        if get_text_width(font, test) <= usable_width:
            current_line = test
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)

    if not lines:
        return Image.new('1', (width, 1), color=1)

    try:
        ascent, descent = font.getmetrics()
        line_height = ascent + descent
    except AttributeError:
        _, line_height = font.getsize('A')

    interline = 4
    total_h = len(lines) * (line_height + interline) - interline
    if total_h <= 0:
        total_h = line_height

    img = Image.new('1', (width, total_h), color=1)
    draw = ImageDraw.Draw(img)
    y = 0
    for line in lines:
        draw.text((indent, y), line, font=font, fill=0)
        y += line_height + interline
    return img


def render_markdown_to_image(md_text):
    """Convert markdown text into a single 1-bit image ready for printing."""
    log.info("Rendering markdown to image...")
    blocks = parse_markdown(md_text)

    # Pre-load fonts
    log.debug("Loading fonts for all block types...")
    fonts = {
        "h1": load_bold_font(DEFAULT_FONT_NAME, FONT_SIZES["h1"]),
        "h2": load_bold_font(DEFAULT_FONT_NAME, FONT_SIZES["h2"]),
        "h3": load_bold_font(DEFAULT_FONT_NAME, FONT_SIZES["h3"]),
        "body": load_font(DEFAULT_FONT_NAME, FONT_SIZES["body"]),
        "bullet": load_font(DEFAULT_FONT_NAME, FONT_SIZES["bullet"]),
    }

    block_images = []
    for i, block in enumerate(blocks):
        btype = block["type"]
        log.debug(f"  Rendering block {i+1}/{len(blocks)}: type={btype}, text='{block.get('text', '')[:50]}'")

        if btype == "blank":
            block_images.append(Image.new('1', (PRINTER_WIDTH_PIXELS, PARAGRAPH_SPACING), color=1))
            continue

        if btype in ("h1", "h2", "h3"):
            font = fonts[btype]
            img = render_text_block(block["text"], font, PRINTER_WIDTH_PIXELS)
            if btype == "h1":
                underline = Image.new('1', (PRINTER_WIDTH_PIXELS, 3), color=1)
                draw = ImageDraw.Draw(underline)
                draw.line([(0, 1), (PRINTER_WIDTH_PIXELS - 1, 1)], fill=0, width=1)
                img = stack_images([img, underline])
            log.debug(f"    → header image: {img.width}x{img.height}px")
            block_images.append(img)

        elif btype == "bullet":
            font = fonts["bullet"]
            bullet_prefix = "\u2022 "
            prefix_w = int(get_text_width(font, bullet_prefix)) + 2
            text_img = render_text_block(block["text"], font, PRINTER_WIDTH_PIXELS, indent=prefix_w)
            draw = ImageDraw.Draw(text_img)
            draw.text((0, 0), bullet_prefix, font=font, fill=0)
            log.debug(f"    → bullet image: {text_img.width}x{text_img.height}px")
            block_images.append(text_img)

        elif btype == "numbered":
            font = fonts["body"]
            prefix = f"{block['num']}. "
            prefix_w = int(get_text_width(font, prefix)) + 2
            text_img = render_text_block(block["text"], font, PRINTER_WIDTH_PIXELS, indent=prefix_w)
            draw = ImageDraw.Draw(text_img)
            draw.text((0, 0), prefix, font=font, fill=0)
            log.debug(f"    → numbered image: {text_img.width}x{text_img.height}px")
            block_images.append(text_img)

        elif btype == "paragraph":
            font = fonts["body"]
            img = render_text_block(block["text"], font, PRINTER_WIDTH_PIXELS)
            log.debug(f"    → paragraph image: {img.width}x{img.height}px")
            block_images.append(img)

    if not block_images:
        log.warning("No blocks rendered, returning empty image")
        return Image.new('1', (PRINTER_WIDTH_PIXELS, 10), color=1)

    # Add spacing between blocks
    spaced = []
    spacing_img = Image.new('1', (PRINTER_WIDTH_PIXELS, LINE_SPACING), color=1)
    for i, bimg in enumerate(block_images):
        spaced.append(bimg)
        if i < len(block_images) - 1:
            spaced.append(spacing_img.copy())

    # Add a bit of margin at top and bottom
    margin = Image.new('1', (PRINTER_WIDTH_PIXELS, 10), color=1)
    spaced.insert(0, margin)
    spaced.append(margin.copy())

    final = stack_images(spaced)
    log.info(f"Final print image: {final.width}x{final.height}px ({final.width * final.height // 8} bytes)")
    return final


def stack_images(images):
    """Vertically stack a list of 1-bit images."""
    total_h = sum(im.height for im in images)
    result = Image.new('1', (PRINTER_WIDTH_PIXELS, total_h), color=1)
    y = 0
    for im in images:
        result.paste(im, (0, y))
        y += im.height
    return result


# --- Flask App ---
app = Flask(__name__)

@app.after_request
def after_request(response):
    # Allow any origin to make requests
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response


@app.route('/print', methods=['POST', 'OPTIONS'])
def print_text():
    if request.method == 'OPTIONS':
        return '', 200
        
    start_time = time.time()
    log.debug(f"[DEBUG] >> print_text POST start")
    log.debug(f"[DEBUG] Headers: {request.headers}")
    log.debug(f"[DEBUG] Data preview: {request.get_data()[:200]}")
    log.info("=" * 60)
    log.info("POST /print — New print request received")
    log.info(f"  Remote addr: {request.remote_addr}")
    log.info(f"  Content-Type: {request.content_type}")
    log.info(f"  Content-Length: {request.content_length}")

    data = request.get_json(force=True, silent=True)
    if not data or not isinstance(data, dict) or not data.get('text'):
        log.warning("  REJECTED: Missing 'text' in JSON body")
        return jsonify({'error': "Missing 'text' in JSON body"}), 400

    md_text = data['text']
    mac = data.get('mac', DEFAULT_ADDRESS)
    log.info(f"  Target printer MAC: {mac}")
    log.info(f"  Text length: {len(md_text)} chars")
    log.info(f"  Text preview: {repr(md_text[:100])}{'...' if len(md_text) > 100 else ''}")

    try:
        log.debug(f"[DEBUG] Entering render_markdown_to_image for md_text length: {len(md_text)}")
        img = render_markdown_to_image(md_text)
        log.debug(f"[DEBUG] render_markdown_to_image success. Image: {img}")
    except Exception as e:
        log.error(f"  Render FAILED: {e}", exc_info=True)
        return jsonify({'error': f'Failed to render: {e}'}), 500

    if img is None:
        log.error("  Render returned None!")
        return jsonify({'error': 'Rendering produced no image'}), 500

    jobs = [(img, f"Markdown print ({img.height}px)")]

    try:
        log.debug(f"[DEBUG] Creating async environment and calling connect_and_print()")
        log.info("Creating async event loop for BLE printing...")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        global received_responses, notification_condition
        received_responses = {}
        notification_condition = asyncio.Condition()

        success = loop.run_until_complete(connect_and_print(mac, jobs))
    except Exception as e:
        elapsed = time.time() - start_time
        log.error(f"  Print FAILED after {elapsed:.1f}s: {e}", exc_info=True)
        return jsonify({'error': f'Print failed: {e}'}), 500
    finally:
        try:
            loop.close()
        except Exception:
            pass

    elapsed = time.time() - start_time
    if success:
        log.info(f"  SUCCESS — printed {img.height}px in {elapsed:.1f}s")
        log.info("=" * 60)
        return jsonify({'status': 'printed', 'height_px': img.height, 'elapsed_s': round(elapsed, 1)}), 200
    else:
        log.error(f"  FAILED — print unsuccessful after {elapsed:.1f}s")
        log.info("=" * 60)
        return jsonify({'status': 'print failed', 'elapsed_s': round(elapsed, 1)}), 500


@app.route('/')
def index():
    return '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Markdown Printer</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    textarea { width: 100%; height: 200px; font-family: monospace; font-size: 14px; }
    button { margin-top: 10px; padding: 8px 20px; font-size: 16px; cursor: pointer; }
    pre { background: #f4f4f4; padding: 10px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h2>Markdown Printer</h2>
  <p>Enter markdown below. Supports headers (#, ##, ###), bullet points (- or *), numbered lists, and paragraphs.</p>
  <textarea id="md"># Hello World

## Section One

- First item
- Second item
- Third item with a longer description that should wrap

### Sub-section

1. Step one
2. Step two
3. Step three

Just a regular paragraph of text that will be printed nicely.</textarea>
  <br>
  <button id="btn">Print</button>
  <pre id="out"></pre>
  <script>
    document.getElementById('btn').addEventListener('click', async () => {
      const out = document.getElementById('out');
      out.textContent = 'Sending...';
      try {
        const r = await fetch('/print', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ text: document.getElementById('md').value })
        });
        const j = await r.json().catch(() => null);
        out.textContent = 'HTTP ' + r.status + '\\n' + JSON.stringify(j, null, 2);
      } catch(e) { out.textContent = 'Error: ' + e; }
    });
  </script>
</body>
</html>'''


if __name__ == '__main__':
    log.info("=" * 60)
    log.info("Markdown Print Server starting")
    log.info(f"  URL: http://127.0.0.1:2221")
    log.info(f"  Printer MAC: {DEFAULT_ADDRESS}")
    log.info(f"  Printer width: {PRINTER_WIDTH_PIXELS}px")
    log.info(f"  Font sizes: {FONT_SIZES}")
    log.info(f"  matplotlib: {'available' if MATPLOTLIB_AVAILABLE else 'NOT available'}")
    log.info("=" * 60)
    app.run(host='127.0.0.1', port=2221, debug=False)
