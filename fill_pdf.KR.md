# fill_pdf.py 한글 가이드

## 목적
`fill_pdf.py`는 웹 폼 입력값과 서명 이미지를 원본 PDF 위에 합성해서 최종 PDF를 만드는 파일입니다.

이 문서는 코드 안 주석 대신, 어디를 바꾸면 무엇이 움직이는지 바로 찾을 수 있게 정리한 가이드입니다.

## 1. 체크 위치
체크 위치는 아래 값 3가지로 결정됩니다.

- `CHECKLIST_POSITIONS`
- `YES_X`, `NO_X`, `NA_X`
- 실제 체크 삽입 rect (`fitz.Rect(...)`)

### CHECKLIST_POSITIONS
각 체크리스트 줄의 기준 Y 좌표입니다.

```python
CHECKLIST_POSITIONS = {
    'risk-1': 413,
    'risk-2': 447,
    'risk-3': 485,
    'safety-1': 535,
    'safety-2': 570,
    'safety-3': 602,
    'safety-4': 634,
    'tbm-1': 681,
}
```

- 특정 줄만 위/아래로 틀리면 해당 key 값만 조정하면 됩니다.
- 모든 줄이 같이 어궋나면 `YES_X / NO_X / NA_X` 또는 체크 rect를 먼저 보는 편이 낫습니다.

### YES_X / NO_X / NA_X
체크가 들어가는 각 컬럼의 X 좌표입니다.

- `YES_X`: `네`
- `NO_X`: `아니요`
- `NA_X`: `해당없음`

- 모든 `네` 체크가 좌/우로 같이 틀리면 `YES_X`만 바꾸면 됩니다.
- 같은 방식으로 `NO_X`, `NA_X`도 따로 조정할 수 있습니다.

### 체크 삽입 rect
실제로는 아래 형태의 rect가 PDF에 들어갑니다.

```python
fitz.Rect(YES_X, y - 12, YES_X + 16, y + 4)
fitz.Rect(NO_X, y - 12, NO_X + 16, y + 4)
fitz.Rect(NA_X, y - 12, NA_X + 16, y + 4)
```

- `YES_X`, `NO_X`, `NA_X`를 바꾸면 좌우 이동
- `y - 12`, `y + 4`를 바꾸면 상하 이동
- `+16`, `+4`를 바꾸면 체크 크기까지 바뀝니다

## 2. 상단 이름 / 날짜
상단 문장 줄은 아래 rect로 제어합니다.

- `NAME_RECT`
- `MONTH_RECT`
- `DAY_RECT`

```python
NAME_RECT = fitz.Rect(81, 239, 129, 255)
MONTH_RECT = fitz.Rect(158, 237, 173, 253)
DAY_RECT = fitz.Rect(194, 237, 212, 253)
```

- `NAME_RECT`: 상단 문장 안 이름
- `MONTH_RECT`: 월 숫자
- `DAY_RECT`: 일 숫자

조정 방법:
- 위/아래 이동: `y0`, `y1`을 같이 바꾸기
- 좌/우 이동: `x0`, `x1`을 같이 바꾸기

## 3. 작업명 / 작업위치
- `WORK_NAME_RECT`
- `WORK_LOCATION_RECT`

```python
WORK_NAME_RECT = fitz.Rect(58, 281, 304, 299)
WORK_LOCATION_RECT = fitz.Rect(58, 299, 304, 317)
```

이 두 줄은 `작업명 :`, `작업위치 :` 텍스트까지 포함해서 한 줄로 렌더링됩니다.

글자 크기는 아래 부분에서 조정합니다.

```python
make_text_png(..., 10, ...)
```

## 4. 근로자 옆 이름 / 실제 서명
- `SIGNER_NAME_RECT`
- `SIGNATURE_MARK_RECT`

```python
SIGNER_NAME_RECT = fitz.Rect(373, 293, 481, 311)
SIGNATURE_MARK_RECT = fitz.Rect(452, 280, 540, 320)
```

- `SIGNER_NAME_RECT`: `근로자 ______` 줄 옆 이름
- `SIGNATURE_MARK_RECT`: 자필 서명 PNG가 들어가는 영역

## 5. 조치내용 칸
`ACTION_RECT`가 오른쪽 `아니요인 경우 필요한 조치내용` 영역입니다.

```python
ACTION_RECT = fitz.Rect(498, 391, 578, 711)
```

이 칸은 폭이 좁아서 긴 문장은 쉽게 뫙개집니다. 필요하면 짧게 요약해서 넣는 편이 낫습니다.

## 6. 한글 텍스트가 들어가는 방식
이 파일은 한글을 PDF에 직접 쓰지 않고, 먼저 PNG로 그린 다음 PDF 위에 올립니다.

흐름:
1. `make_text_png()`에서 PNG 생성
2. `insert_png()`로 PDF에 올림

글씨가 이상하면 보통 두 군데를 같이 봐야 합니다.
- 해당 rect
- `make_text_png()`에 넘기는 `font_size`

## 7. 자필 서명 처리 흐름
1. `signatureDataUrl` 디코딩
2. `normalize_signature()`에서 흰 배경 제거
3. bounding box crop
4. `page.insert_image()`로 PDF에 삽입

## 8. 수정 추천 순서
1. 좌표를 먼저 맞춘다
2. 그 다음 글자 크기를 조정한다
3. 마지막에 서명 크기와 위치를 맞춘다

## 9. 빠른 찾기
- 체크 한 줄만 틀림: `CHECKLIST_POSITIONS`
- 체크 전\ccb4 좌우 틀림: `YES_X`, `NO_X`, `NA_X`
- 상단 이름/날짜: `NAME_RECT`, `MONTH_RECT`, `DAY_RECT`
- 작업명/작업위치: `WORK_NAME_RECT`, `WORK_LOCATION_RECT`
- 서명: `SIGNATURE_MARK_RECT`
- 글자 크기: `make_text_png(..., font_size, ...)`
