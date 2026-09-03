(() => {
  const sleeve = document.getElementById('sleeve');

  // build the stacked sticker layers from embedded data URIs (STICKERS,
  // defined in images-data.js). Using data URIs — rather than separate
  // image files — means this also works when the page is opened directly
  // from disk (file://), where loading external images into a canvas for
  // pixel hit-testing would otherwise be blocked.
  STICKERS.forEach((s, i) => {
    const img = document.createElement('img');
    img.className = 'sticker';
    img.src = s.src;
    img.alt = s.name;
    img.dataset.name = s.name;
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.style.zIndex = String(i + 1);
    sleeve.appendChild(img);
  });
  const stickers = Array.from(sleeve.querySelectorAll('.sticker'));

  const HIT_SIZE = 240; // resolution of the offscreen alpha map
  const ALPHA_THRESHOLD = 10;

  let alphaMaps = null; // filled once images are ready
  let focusedIndex = null;

  function focusSticker(index){
    focusedIndex = index;
    sleeve.classList.add('active');
    stickers.forEach((img, i) => img.classList.toggle('is-focused', i === index));
  }

  function clearFocus(){
    focusedIndex = null;
    sleeve.classList.remove('active');
    stickers.forEach(img => img.classList.remove('is-focused'));
  }

  function toggleSticker(index){
    if (focusedIndex === index){
      clearFocus();
    } else {
      focusSticker(index);
    }
  }

  // Build an alpha map for each sticker so clicks land on the artist's
  // actual artwork rather than the full transparent square around it.
  function buildAlphaMaps(){
    const canvas = document.createElement('canvas');
    canvas.width = HIT_SIZE;
    canvas.height = HIT_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    alphaMaps = stickers.map(img => {
      ctx.clearRect(0, 0, HIT_SIZE, HIT_SIZE);
      try {
        ctx.drawImage(img, 0, 0, HIT_SIZE, HIT_SIZE);
        const data = ctx.getImageData(0, 0, HIT_SIZE, HIT_SIZE).data;
        const alpha = new Uint8ClampedArray(HIT_SIZE * HIT_SIZE);
        for (let p = 0; p < HIT_SIZE * HIT_SIZE; p++){
          alpha[p] = data[p * 4 + 3];
        }
        return alpha;
      } catch (e){
        // canvas may be tainted in some environments; fall back to
        // "always hit" so clicks still work.
        return null;
      }
    });
  }

  function alphaAt(index, nx, ny){
    const map = alphaMaps[index];
    if (!map) return 255; // fallback: treat as opaque
    const px = Math.min(HIT_SIZE - 1, Math.max(0, Math.floor(nx * HIT_SIZE)));
    const py = Math.min(HIT_SIZE - 1, Math.max(0, Math.floor(ny * HIT_SIZE)));
    return map[py * HIT_SIZE + px];
  }

  function hitTest(clientX, clientY){
    const rect = sleeve.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;

    // check from the topmost layer down
    for (let i = stickers.length - 1; i >= 0; i--){
      if (alphaAt(i, nx, ny) > ALPHA_THRESHOLD) return i;
    }
    return null;
  }

  sleeve.addEventListener('click', (e) => {
    if (!alphaMaps) return; // maps not ready yet (shouldn't normally happen)
    const hit = hitTest(e.clientX, e.clientY);
    if (hit !== null) toggleSticker(hit);
  });

  // clicking anywhere outside the sleeve clears the focused sticker
  document.addEventListener('click', (e) => {
    if (focusedIndex !== null && !sleeve.contains(e.target)){
      clearFocus();
    }
  });

  // keyboard access: tab to a sticker, press Enter/Space to focus it
  stickers.forEach((img, index) => {
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        toggleSticker(index);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearFocus();
  });

  // wait for every sticker image to be decoded before building hit maps
  Promise.all(stickers.map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
    .then(buildAlphaMaps);
})();
