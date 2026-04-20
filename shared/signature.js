export function setupSignaturePad(canvas) {
  const context = canvas.getContext('2d');
  let drawing = false;
  let hasStroke = false;

  function initContext() {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 5;
    context.strokeStyle = '#111111';
  }
  initContext();

  const getPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] ?? event;
    return {
      x: ((source.clientX - rect.left) / rect.width) * canvas.width,
      y: ((source.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event) => {
    event.preventDefault();
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawing = true;
  };

  const move = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    hasStroke = true;
  };

  const end = () => {
    drawing = false;
    context.closePath();
  };

  canvas.addEventListener('pointerdown', start, { passive: false });
  canvas.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end);

  return {
    clear() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasStroke = false;
    },
    isEmpty() {
      return !hasStroke;
    },
    toDataURL() {
      return canvas.toDataURL('image/png');
    },
    resize() {
      const body = canvas.closest('.sig-modal-body');
      if (!body) return;
      const saved = hasStroke ? canvas.toDataURL() : null;
      canvas.width = body.clientWidth - 16;
      canvas.height = body.clientHeight - 16;
      initContext();
      if (saved) {
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          hasStroke = true;
        };
        img.src = saved;
      }
    },
  };
}

export function createSignatureModal(signature, elements) {
  let _savedSignatureDataUrl = '';

  function open() {
    _savedSignatureDataUrl = signature.isEmpty() ? '' : signature.toDataURL();
    elements.signatureModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    signature.resize();
  }

  function close() {
    elements.signatureModal.classList.add('hidden');
    document.body.style.overflow = '';
    if (_savedSignatureDataUrl) {
      signature.clear();
      const img = new Image();
      img.onload = () => {
        const canvas = elements.signaturePad;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = _savedSignatureDataUrl;
    } else {
      signature.clear();
    }
  }

  return { open, close };
}
