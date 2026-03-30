# fill_pdf.py Guide

## Goal
`fill_pdf.py` composes form values and the handwritten signature onto the source PDF.

This guide matches the current code layout, where all placement tuning should happen through constants.

## 1. Checklist placement
Checklist position is controlled by these constants only:

- `CHECKLIST_POSITIONS`
- `YES_X`, `NO_X`, `NA_X`
- `CHECK_WIDTH`, `CHECK_HEIGHT`, `CHECK_Y_OFFSET`

### Row positions
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

- If only one checklist row is off vertically, change that row's Y value.
- If every row looks off the same way, leave this block alone and adjust the checklist size/offset constants instead.

### Column positions
```python
YES_X = 359
NO_X = 402
NA_X = 449
```

- Move these to shift a whole column left or right.

### Checklist box size and vertical offset
```python
CHECK_WIDTH = 16
CHECK_HEIGHT = 16
CHECK_Y_OFFSET = -12
```

These replace the old inline values like `y - 12`, `+16`, `+4`.

How they work:
- `CHECK_WIDTH`: checkmark box width
- `CHECK_HEIGHT`: checkmark box height
- `CHECK_Y_OFFSET`: vertical offset from the row baseline

The actual rect is now built here:
```python
def make_check_rect(column_x: float, row_y: float) -> fitz.Rect:
    return make_rect(column_x, row_y + CHECK_Y_OFFSET, CHECK_WIDTH, CHECK_HEIGHT)
```

## 2. Upper sentence name/date
```python
NAME_RECT = fitz.Rect(81, 239, 129, 255)
MONTH_RECT = fitz.Rect(158, 237, 173, 253)
DAY_RECT = fitz.Rect(194, 237, 212, 253)
```

- `NAME_RECT`: worker name in the sentence near the top
- `MONTH_RECT`: month number
- `DAY_RECT`: day number

Move by changing both x values together or both y values together.

## 3. Work name / work location
```python
WORK_NAME_RECT = fitz.Rect(58, 281, 304, 299)
WORK_LOCATION_RECT = fitz.Rect(58, 299, 304, 317)
```

Font size is controlled at the call site:
```python
make_text_png(..., 10, ...)
```

## 4. Signer name / handwritten signature
```python
SIGNER_NAME_RECT = fitz.Rect(373, 293, 481, 311)
SIGNATURE_MARK_RECT = fitz.Rect(452, 280, 540, 320)
```

- `SIGNER_NAME_RECT`: spaced worker name next to the worker signature line
- `SIGNATURE_MARK_RECT`: handwritten signature image area

## 5. Action text area
```python
ACTION_RECT = fitz.Rect(498, 391, 578, 711)
```

The right column is narrow. If long Korean text looks cramped, shorten the action text or adjust this rect and font size together.

## 6. Text rendering path
Korean text is rendered to PNG first, then placed on the PDF.

Relevant functions:
- `make_text_png()`
- `insert_png()`

If text looks wrong, inspect both:
- the target rect
- the font size passed into `make_text_png()`

## 7. Handwritten signature path
Signature flow:
1. `decode_signature()`
2. `normalize_signature()`
3. `page.insert_image()`

If the signature looks wrong:
- placement -> `SIGNATURE_MARK_RECT`
- size -> `SIGNATURE_MARK_RECT`
- stroke cleanup -> `normalize_signature()`

## 8. Recommended editing order
1. Position constants first
2. Font size second
3. Signature tuning last

## 9. Quick reference
- single checklist row off: `CHECKLIST_POSITIONS`
- whole checklist column off: `YES_X`, `NO_X`, `NA_X`
- checklist size or vertical centering off: `CHECK_WIDTH`, `CHECK_HEIGHT`, `CHECK_Y_OFFSET`
- upper name/date off: `NAME_RECT`, `MONTH_RECT`, `DAY_RECT`
- work name/location off: `WORK_NAME_RECT`, `WORK_LOCATION_RECT`
- signer name/signature off: `SIGNER_NAME_RECT`, `SIGNATURE_MARK_RECT`
