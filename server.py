from __future__ import annotations

import json
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from fill_pdf import create_pdf

ROOT = Path(__file__).resolve().parent
STORAGE = ROOT / 'storage'
LOG_DIR = STORAGE / 'logs'
PDF_DIR = STORAGE / 'pdfs'
TMP_DIR = STORAGE / 'tmp'
ADMIN_PASSWORD = (__import__('os').environ.get('TBM_ADMIN_PASSWORD') or '5555')
CHECKLIST_KEYS = (
    'risk-1',
    'risk-2',
    'risk-3',
    'safety-1',
    'safety-2',
    'safety-3',
    'safety-4',
    'tbm-1',
)

for path in (LOG_DIR, PDF_DIR, TMP_DIR):
    path.mkdir(parents=True, exist_ok=True)


def validate_meeting_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    required_fields = ('employeeType', 'teamCode', 'teamName', 'workerName', 'workDate', 'workTime', 'workName', 'workLocation')
    for field in required_fields:
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f'missing {field}')

    signature_data_url = payload.get('signatureDataUrl')
    if not isinstance(signature_data_url, str) or not signature_data_url.strip():
        errors.append('missing signatureDataUrl')

    checklist_responses = payload.get('checklistResponses')
    if not isinstance(checklist_responses, dict):
        errors.append('missing checklistResponses')
        return errors

    for key in CHECKLIST_KEYS:
        response = checklist_responses.get(key)
        if not isinstance(response, dict):
            errors.append(f'missing checklist response: {key}')
            continue

        status = response.get('status')
        if status not in {'yes', 'no', 'na'}:
            errors.append(f'invalid checklist status: {key}')
            continue

        action = response.get('action', '')
        if status == 'no' and (not isinstance(action, str) or not action.strip()):
            errors.append(f'missing checklist action: {key}')

    return errors


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/healthz':
            self.handle_health_check()
            return
        if parsed.path == '/api/meetings':
            self.handle_list_meetings()
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/admin/verify':
            self.handle_admin_verify()
            return

        if parsed.path != '/api/meetings/submit':
            self.send_error(HTTPStatus.NOT_FOUND, 'Not Found')
            return

        try:
            content_length = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(content_length).decode('utf-8')
            payload = json.loads(raw or '{}')
            validation_errors = validate_meeting_payload(payload)
            if validation_errors:
                body = json.dumps({'error': 'invalid payload', 'details': validation_errors}, ensure_ascii=False).encode('utf-8')
                self.send_response(HTTPStatus.BAD_REQUEST)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            meeting_id = payload.get('id') or __import__('uuid').uuid4().hex
            payload['id'] = meeting_id

            output_pdf = PDF_DIR / f'{meeting_id}.pdf'
            output_log = LOG_DIR / f'{meeting_id}.json'

            create_pdf(payload, output_pdf)
            output_log.write_text(
                json.dumps({**payload, 'pdfFile': output_pdf.name}, ensure_ascii=False, indent=2),
                encoding='utf-8',
            )

            response = {
                'ok': True,
                'id': meeting_id,
                'savedAt': __import__('datetime').datetime.now().isoformat(),
                'pdfUrl': f'/storage/pdfs/{output_pdf.name}',
                'logUrl': f'/storage/logs/{output_log.name}',
            }
            body = json.dumps(response, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as error:
            body = json.dumps({'error': str(error)}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        prefix = '/api/meetings/'
        if not parsed.path.startswith(prefix):
            self.send_error(HTTPStatus.NOT_FOUND, 'Not Found')
            return

        admin_password = self.headers.get('X-Admin-Password', '')
        if admin_password != ADMIN_PASSWORD:
            body = json.dumps({'error': 'admin authorization required'}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.FORBIDDEN)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        meeting_id = parsed.path[len(prefix):].strip()
        if not meeting_id:
            self.send_error(HTTPStatus.BAD_REQUEST, 'Missing meeting id')
            return

        try:
            removed = []
            for path in (PDF_DIR / f'{meeting_id}.pdf', LOG_DIR / f'{meeting_id}.json'):
                if path.exists():
                    path.unlink()
                    removed.append(path.name)

            body = json.dumps({'ok': True, 'id': meeting_id, 'removed': removed}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as error:
            body = json.dumps({'error': str(error)}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def handle_admin_verify(self):
        try:
            content_length = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(content_length).decode('utf-8')
            payload = json.loads(raw or '{}')
            password = payload.get('password', '')

            if password != ADMIN_PASSWORD:
                body = json.dumps({'ok': False, 'error': 'invalid admin password'}, ensure_ascii=False).encode('utf-8')
                self.send_response(HTTPStatus.FORBIDDEN)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            body = json.dumps({'ok': True}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as error:
            body = json.dumps({'error': str(error)}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def handle_list_meetings(self):
        try:
            meetings = []
            for log_path in sorted(LOG_DIR.glob('*.json'), key=lambda item: item.stat().st_mtime, reverse=True):
                try:
                    payload = json.loads(log_path.read_text(encoding='utf-8'))
                except json.JSONDecodeError:
                    continue

                meeting_id = payload.get('id') or log_path.stem
                pdf_file = payload.get('pdfFile') or f'{meeting_id}.pdf'
                meetings.append({
                    **payload,
                    'id': meeting_id,
                    'pdfFile': pdf_file,
                    'pdfUrl': f'/storage/pdfs/{pdf_file}',
                    'logUrl': f'/storage/logs/{log_path.name}',
                    'savedAt': __import__('datetime').datetime.fromtimestamp(log_path.stat().st_mtime).isoformat(),
                })

            body = json.dumps({'ok': True, 'meetings': meetings}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as error:
            body = json.dumps({'error': str(error)}, ensure_ascii=False).encode('utf-8')
            self.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def handle_health_check(self):
        body = json.dumps({'ok': True, 'service': 'tbm-app'}, ensure_ascii=False).encode('utf-8')
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    port = int((__import__('os').environ.get('PORT') or '4173'))
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'TBM app running at http://localhost:{port}')
    server.serve_forever()
    return 0


if __name__ == '__main__':
    sys.exit(main())
