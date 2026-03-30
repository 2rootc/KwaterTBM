# TOOLBOX MEETING MVP

## Run
터미널에서 실행:
```bash
cd app
python server.py
```

윈도우에서 실행창이 바로 닫히는 경우:
```bat
app\run_server.bat
```
또는 `app\\run_server.bat`를 더블클릭하세요.
에러가 있으면 창이 유지되어 원인을 볼 수 있습니다.

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

## Ship Readiness
`gstack /ship`를 쓰려면 현재 앱 디렉터리를 git 저장소로 사용하면 됩니다.

현재 포함된 기본 배포 메타:
- `VERSION`
- `CHANGELOG.md`
- `TODOS.md`
- `.gitignore`

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
