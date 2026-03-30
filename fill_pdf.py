from __future__ import annotations

import base64
import io
import json
import sys
from datetime import datetime
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.stdout.reconfigure(encoding='utf-8')

FONT_CANDIDATES = [
    Path(r'C:\Windows\Fonts\malgun.ttf'),
    Path(r'C:\Windows\Fonts\gulim.ttc'),
    Path(r'C:\Windows\Fonts\batang.ttc'),
]
BOLD_FONT_CANDIDATES = [
    Path(r'C:\Windows\Fonts\malgunbd.ttf'),
    Path(r'C:\Windows\Fonts\malgunsl.ttf'),
    *FONT_CANDIDATES,
]
TEXT_RENDER_SCALE = 3

CHECKLIST_POSITIONS = {
    'risk-1': 415,
    'risk-2': 450,
    'risk-3': 485,
    'safety-1': 540,
    'safety-2': 570,
    'safety-3': 600,
    'safety-4': 630,
    'tbm-1': 685,
}
CHECKLIST_LABELS = {
    'risk-1': '① 금일 작업에 대한 위험요인과 안전대책에 대해 대화하고 숙지하였다. (위험성평가)',
    'risk-2': '② 금일 작업(혹은 유사작업)에서 발생한 안전사고 발생 사례를 공유받았다.',
    'risk-3': '③ 금일 작업 내용, 작업방법, 작업 물량(범위) 및 필요한 안전보호구를 잘 알고 있다.',
    'safety-1': '① 음주, 발열, 약물복용 등으로 금일 작업에 적합한 건강상태인지 확인하였다.',
    'safety-2': '② 개인보호구를 지급받고 점검하였다.',
    'safety-3': '③ 현장 위험요인 및 불안전한 상태 발견시 멈추고, 확인하고, 생각한 후 작업하도록 하였다.',
    'safety-4': '④ 비상시 행동요령을 숙지하였다.',
    'tbm-1': '① TBM 중 작업자가 제기한 불만사항, 질문, 제안 사항을 검토하고 반영한지 확인하였다.',
}

YES_X = 345
NO_X = 390
NA_X = 430
CHECK_WIDTH = 16
CHECK_HEIGHT = 16
CHECK_Y_OFFSET = -12

ACTION_X = 465
ACTION_WIDTH = 80
ACTION_HEIGHT = 22

SIGNER_NAME_RECT = fitz.Rect(373, 293, 481, 311)
SIGNATURE_MARK_RECT = fitz.Rect(500, 280, 550, 320)

NAME_RECT = fitz.Rect(81, 239, 129, 255)
MONTH_RECT = fitz.Rect(158, 237, 173, 253)
DAY_RECT = fitz.Rect(194, 237, 212, 253)
WORK_NAME_RECT = fitz.Rect(58, 281, 304, 299)
WORK_LOCATION_RECT = fitz.Rect(58, 299, 304, 317)


def load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = BOLD_FONT_CANDIDATES if bold else FONT_CANDIDATES
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    raise FileNotFoundError('No usable Korean font found in C:\\Windows\\Fonts')


def make_text_png(text: str, font_size: int, *, bold: bool = False, multiline: bool = False, width: int | None = None, align: str = 'left') -> bytes:
    if not text:
        return b''
    scale = TEXT_RENDER_SCALE
    font = load_font(font_size * scale, bold=bold)
    lines = text.splitlines() if multiline else [text]
    if multiline and width:
        wrapped_lines: list[str] = []
        dummy = Image.new('RGBA', (10, 10), (255, 255, 255, 0))
        measure = ImageDraw.Draw(dummy)
        max_width = max((width * scale) - (6 * scale), scale)
        for raw_line in lines:
            current = ''
            for ch in raw_line:
                candidate = current + ch
                bbox = measure.textbbox((0, 0), candidate or ' ', font=font)
                if current and (bbox[2] - bbox[0]) > max_width:
                    wrapped_lines.append(current)
                    current = ch
                else:
                    current = candidate
            wrapped_lines.append(current)
        lines = wrapped_lines
    dummy = Image.new('RGBA', (10, 10), (255, 255, 255, 0))
    d = ImageDraw.Draw(dummy)
    bboxes = [d.textbbox((0, 0), line or ' ', font=font) for line in lines]
    line_h = max((bbox[3] - bbox[1]) for bbox in bboxes) + (4 * scale)
    calc_width = max((bbox[2] - bbox[0]) for bbox in bboxes) + (6 * scale)
    img_w = max((width or 0) * scale, calc_width)
    img_h = line_h * len(lines) + (2 * scale)
    img = Image.new('RGBA', (img_w, img_h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    for idx, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line or ' ', font=font)
        text_w = bbox[2] - bbox[0]
        if align == 'center':
            x = max((img_w - text_w) // 2, 0)
        elif align == 'right':
            x = max(img_w - text_w - (2 * scale), 0)
        else:
            x = scale
        y = idx * line_h
        draw.text((x, y), line, font=font, fill=(0, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def make_check_png(size: int = 16) -> bytes:
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw.line((3, size // 2, 7, size - 4), fill=(0, 0, 0, 255), width=3)
    draw.line((7, size - 4, size - 3, 3), fill=(0, 0, 0, 255), width=3)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def insert_png(page: fitz.Page, rect: fitz.Rect, png_bytes: bytes) -> None:
    if png_bytes:
        page.insert_image(rect, stream=png_bytes, keep_proportion=False, overlay=True)


def make_rect(x: float, y: float, width: float, height: float) -> fitz.Rect:
    return fitz.Rect(x, y, x + width, y + height)


def make_check_rect(column_x: float, row_y: float) -> fitz.Rect:
    return make_rect(column_x, row_y + CHECK_Y_OFFSET, CHECK_WIDTH, CHECK_HEIGHT)


def make_action_rect(row_y: float) -> fitz.Rect:
    return make_rect(ACTION_X, row_y + CHECK_Y_OFFSET, ACTION_WIDTH, ACTION_HEIGHT)


def decode_signature(data_url: str) -> bytes:
    if not data_url or ',' not in data_url:
        return b''
    _, encoded = data_url.split(',', 1)
    return base64.b64decode(encoded)


def normalize_signature(signature_bytes: bytes) -> bytes:
    if not signature_bytes:
        return b''
    image = Image.open(io.BytesIO(signature_bytes)).convert('RGBA')
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if r > 245 and g > 245 and b > 245:
                pixels[x, y] = (255, 255, 255, 0)
            else:
                strength = min(r, g, b)
                alpha = max(a, 255 - strength)
                pixels[x, y] = (0, 0, 0, alpha)
    bbox = image.getbbox()
    if not bbox:
        return b''
    image = image.crop(bbox)
    # Thicken handwritten strokes so they remain legible against the real PDF form.
    alpha = image.getchannel('A').filter(ImageFilter.MaxFilter(5))
    solid = Image.new('RGBA', image.size, (0, 0, 0, 0))
    solid.putalpha(alpha)
    image = solid
    buf = io.BytesIO()
    image.save(buf, format='PNG')
    return buf.getvalue()


def get_response_action(response: dict) -> str:
    for key in ('action', 'actionText', 'requiredAction', 'neededAction'):
        value = str(response.get(key, '')).strip()
        if value:
            return value
    return ''


def create_pdf(payload: dict, output_path: Path) -> Path:
    template_path = next((Path(__file__).parent / 'assets').glob('*.pdf'))
    doc = fitz.open(str(template_path))
    page = doc[0]

    work_date = payload.get('workDate', '')
    month = ''
    day = ''
    if work_date:
        parsed = datetime.fromisoformat(work_date)
        month = str(parsed.month)
        day = str(parsed.day)

    worker_name = payload.get('workerName', '')
    insert_png(page, NAME_RECT, make_text_png(worker_name, 12, width=int(NAME_RECT.width), align='left'))
    insert_png(page, MONTH_RECT, make_text_png(month, 12, width=int(MONTH_RECT.width), align='center'))
    insert_png(page, DAY_RECT, make_text_png(day, 12, width=int(DAY_RECT.width), align='center'))
    insert_png(page, WORK_NAME_RECT, make_text_png(f"작업명 : {payload.get('workName', '')}", 10, width=int(WORK_NAME_RECT.width)))
    insert_png(page, WORK_LOCATION_RECT, make_text_png(f"작업위치 : {payload.get('workLocation', '')}", 10, width=int(WORK_LOCATION_RECT.width)))
    spaced_worker_name = ' '.join(list(worker_name)) if worker_name else ''
    insert_png(page, SIGNER_NAME_RECT, make_text_png(spaced_worker_name, 11, width=int(SIGNER_NAME_RECT.width), align='center'))

    check_png = make_check_png(CHECK_WIDTH)
    responses = payload.get('checklistResponses', {})
    for key, y in CHECKLIST_POSITIONS.items():
        response = responses.get(key, {})
        status = response.get('status', '')
        if status == 'yes':
            insert_png(page, make_check_rect(YES_X, y), check_png)
        elif status == 'no':
            insert_png(page, make_check_rect(NO_X, y), check_png)
            action = get_response_action(response)
            if action:
                insert_png(
                    page,
                    make_action_rect(y),
                    make_text_png(action, 7, width=ACTION_WIDTH, multiline=True),
                )
        elif status == 'na':
            insert_png(page, make_check_rect(NA_X, y), check_png)

    signature_bytes = normalize_signature(decode_signature(payload.get('signatureDataUrl', '')))
    if signature_bytes:
        page.insert_image(SIGNATURE_MARK_RECT, stream=signature_bytes, keep_proportion=True, overlay=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def main() -> int:
    if len(sys.argv) != 3:
        print('usage: fill_pdf.py <input_json> <output_pdf>', file=sys.stderr)
        return 1
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    payload = json.loads(input_path.read_text(encoding='utf-8-sig'))
    create_pdf(payload, output_path)
    print(str(output_path))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

