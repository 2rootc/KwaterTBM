# TOOLBOX MEETING MVP

## Run
터미널에서 실행:
```bash
cd app
python server.py
```

브라우저에서 `http://localhost:4173` 접속.

## Verify Before Ship
최소 검증:
```bash
cd app
python smoke_test.py
```

이 스크립트는 다음을 확인합니다.
- 샘플 payload 검증
- 실제 PDF 생성
- 로컬 서버 기동
- `GET /`
- `GET /api/meetings`

## Render Deploy
이 앱은 Render에서 `Docker` 웹서비스로 배포하는 구성이 준비되어 있습니다.

포함된 배포 파일:
- `Dockerfile`
- `render.yaml`
- `requirements.txt`
- `CLAUDE.md`

배포 전 로컬 확인:
```bash
cd app
python smoke_test.py
```

Render 배포 기준:
- Start: Docker 컨테이너에서 `python server.py`
- Port: Render가 주는 `PORT` 사용
- Health check: `/healthz`

주의:
- PDF 한글 렌더링 때문에 Docker 이미지에서 `fonts-noto-cjk`를 설치합니다.
- Render에서 첫 배포 후 발급된 URL을 `CLAUDE.md`의 Production URL에 채우면 됩니다.

## Extras
배포에 필요 없는 로컬 보조 파일들은 [`app_extras`](D:/project/GSTACK/app_extras)로 옮겨 두었습니다.

## Included
- 내부직원 / 외부직원 첫 화면 분기
- 내부직원 팀 선택
- TBM 입력 폼
- 모바일 서명 캔버스
- 로컬 로그 저장
- 서버 저장 로그 생성
- 실제 `TBM양식.pdf` 기반 PDF 생성
- 생성된 PDF 다운로드
- JSON 로그 다운로드

## Current limitation
- 외부직원 상세 흐름 미구현
- DB 없음: 브라우저 localStorage + 파일 로그 사용
- PDF 좌표는 현재 양식 기준 수동 매핑
