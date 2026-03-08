"""
MXW01 Cat Printer - BLE communication module.

Handles rendering text to a 1-bit bitmap and sending it to the printer
over Bluetooth Low Energy using the MXW01 protocol.
"""

import asyncio
import math
from bleak import BleakClient, BleakScanner
from bleak.exc import BleakError
from PIL import Image, ImageDraw, ImageFont

# --- GATT UUIDs ---
CONTROL_WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000ae02-0000-1000-8000-00805f9b34fb"
DATA_WRITE_UUID = "0000ae03-0000-1000-8000-00805f9b34fb"

PRINTER_WIDTH_PIXELS = 384
PRINTER_WIDTH_BYTES = PRINTER_WIDTH_PIXELS // 8
DELAY_BETWEEN_PRINTS = 1.0


# --- CRC-8 ---
def _crc8_update(crc, data_byte):
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
        crc = _crc8_update(crc, byte)
    return crc


# --- Command helpers ---
def create_command_with_crc(command_id, data):
    data_length_le = len(data).to_bytes(2, byteorder='little')
    crc = calculate_crc8(data)
    return bytes([0x22, 0x21, command_id, 0x00]) + data_length_le + data + bytes([crc, 0xFF])


def create_command_simple(command_id, data):
    data_length_le = len(data).to_bytes(2, byteorder='little')
    return bytes([0x22, 0x21, command_id, 0x00]) + data_length_le + data + bytes([0x00, 0x00])


# --- Text rendering ---
def render_text_to_bitmap(text, font_path_or_name="Arial", font_size=24, alignment="center"):
    """Render text string into a 1-bit PIL Image sized for the printer."""
    try:
        font = ImageFont.truetype(font_path_or_name, font_size)
    except (IOError, OSError):
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except (IOError, OSError):
            font = ImageFont.load_default()

    width = PRINTER_WIDTH_PIXELS

    def get_text_width(txt):
        if not txt:
            return 0
        try:
            return font.getlength(txt)
        except AttributeError:
            return font.getsize(txt)[0]

    # Word-wrap
    lines = []
    for paragraph in text.split('\n'):
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split(' ')
        current_line = ""
        for word in words:
            test_line = current_line + (" " if current_line else "") + word
            if get_text_width(test_line) <= width:
                current_line = test_line
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
        interline_spacing = 4
    except AttributeError:
        _, line_height = font.getsize('A')
        interline_spacing = 2

    line_step = line_height + interline_spacing
    total_height = (len(lines) * line_step) - interline_spacing
    if total_height <= 0:
        total_height = line_height

    img = Image.new('1', (width, total_height), color=1)
    draw = ImageDraw.Draw(img)
    y = 0
    for line in lines:
        lw = get_text_width(line)
        if alignment == 'center':
            x = (width - lw) // 2
        elif alignment == 'right':
            x = width - lw
        else:
            x = 0
        draw.text((x, y), line, font=font, fill=0)
        y += line_step

    return img


# --- Image → printer bytes ---
def process_image(img):
    """Convert a 1-bit PIL image into printer byte data."""
    pixels = list(img.getdata())
    width, height = img.size
    data = bytearray()
    for y_row in range(height):
        byte = 0
        for x_col in range(width):
            pixel = pixels[y_row * width + x_col]
            if pixel == 0:  # black
                byte |= (1 << (x_col % 8))
            if (x_col + 1) % 8 == 0 or (x_col + 1) == width:
                data.append(byte)
                byte = 0
    return bytes(data)


# --- BLE notification handling ---
_received_responses = {}
_notification_condition = None


async def _notification_handler(sender, data):
    global _received_responses
    if not data or len(data) < 8 or data[0] != 0x22 or data[1] != 0x21:
        return
    cmd_id = data[2]
    payload_len = int.from_bytes(data[4:6], 'little')
    payload = data[6:6 + payload_len] if len(data) >= 6 + payload_len else None
    async with _notification_condition:
        _received_responses[cmd_id] = payload
        _notification_condition.notify_all()


def _check_a1(payload):
    if not payload or len(payload) < 8:
        return False
    return payload[6] == 0


def _check_a9(payload):
    if not payload or len(payload) < 1:
        return False
    return payload[0] == 0


# --- Print job ---
async def _run_print_job(client, img):
    global _received_responses

    printer_data = process_image(img)
    image_height = img.height

    ae01 = client.services.get_characteristic(CONTROL_WRITE_UUID)
    ae03 = client.services.get_characteristic(DATA_WRITE_UUID)

    cmd_b1 = create_command_with_crc(0xB1, bytes([0x00]))
    cmd_a2 = create_command_with_crc(0xA2, bytes([0x5D]))
    cmd_a1 = create_command_with_crc(0xA1, bytes([0x00]))

    height_le = image_height.to_bytes(2, 'little')
    width_le = PRINTER_WIDTH_BYTES.to_bytes(2, 'little')
    cmd_a9 = create_command_simple(0xA9, height_le + width_le)
    cmd_ad = create_command_simple(0xAD, bytes([0x00]))

    # 1. Setup (B1, A2, A1) → wait A1
    async with _notification_condition:
        _received_responses.pop(0xA1, None)
    for cmd in [cmd_b1, cmd_a2, cmd_a1]:
        await client.write_gatt_char(ae01.uuid, cmd, response=False)
        await asyncio.sleep(0.01)
    async with _notification_condition:
        await asyncio.wait_for(
            _notification_condition.wait_for(lambda: 0xA1 in _received_responses),
            timeout=7.0
        )
        if not _check_a1(_received_responses.pop(0xA1)):
            raise RuntimeError("Printer A1 status check failed")

    # 2. Print request (A2, A9) → wait A9
    async with _notification_condition:
        _received_responses.pop(0xA9, None)
    for cmd in [cmd_a2, cmd_a9]:
        await client.write_gatt_char(ae01.uuid, cmd, response=False)
        await asyncio.sleep(0.01)
    async with _notification_condition:
        await asyncio.wait_for(
            _notification_condition.wait_for(lambda: 0xA9 in _received_responses),
            timeout=7.0
        )
        if not _check_a9(_received_responses.pop(0xA9)):
            raise RuntimeError("Printer A9 status check failed")

    # 3. Send image data in 20-byte chunks
    for i in range(0, len(printer_data), 20):
        await client.write_gatt_char(ae03.uuid, printer_data[i:i+20], response=False)

    # 4. End print (AD) → wait AA
    async with _notification_condition:
        _received_responses.pop(0xAA, None)
    await client.write_gatt_char(ae01.uuid, cmd_ad, response=False)
    timeout_s = max(15.0, image_height / 20.0)
    async with _notification_condition:
        try:
            await asyncio.wait_for(
                _notification_condition.wait_for(lambda: 0xAA in _received_responses),
                timeout=timeout_s
            )
            _received_responses.pop(0xAA)
        except asyncio.TimeoutError:
            pass  # may still have printed
    await asyncio.sleep(0.5)


async def print_text(mac_address, text, font_name="Courier New", font_size=32, alignment="center"):
    """
    Render text and send it to the cat printer at the given MAC address.

    Returns (success: bool, message: str).
    """
    global _received_responses, _notification_condition

    _received_responses = {}
    _notification_condition = asyncio.Condition()

    img = render_text_to_bitmap(text, font_name, font_size, alignment)
    if img is None:
        return False, "Failed to render text"

    try:
        async with BleakClient(mac_address, timeout=20.0) as client:
            if not client.is_connected:
                return False, "Failed to connect to printer"

            await client.start_notify(NOTIFY_UUID, _notification_handler)
            await _run_print_job(client, img)
            try:
                await client.stop_notify(NOTIFY_UUID)
            except Exception:
                pass

        return True, "Printed successfully"

    except BleakError as e:
        return False, f"Bluetooth error: {e}"
    except asyncio.TimeoutError:
        return False, "Connection timed out"
    except Exception as e:
        return False, f"Print error: {e}"
