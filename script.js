// ============================================================
// Greygate — ambient backdrop, scroll dial, particle transition
// ============================================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------
   1. Ambient "vanta-black" network backdrop — constant behind
      every section so the background never shifts away from it.
--------------------------------------------------------- */
(function ambientBackdrop(){
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  let nodes = [];

  function size(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const count = Math.round((w*h) / 24000);
    nodes = new Array(Math.min(count, 90)).fill(0).map(() => ({
      x: Math.random()*w, y: Math.random()*h,
      vx: (Math.random()-0.5)*0.12, vy: (Math.random()-0.5)*0.12,
      r: Math.random()*1.4 + 0.4
    }));
  }
  window.addEventListener('resize', size);
  size();

  function frame(){
    ctx.clearRect(0,0,w,h);
    for(let i=0;i<nodes.length;i++){
      const n = nodes[i];
      n.x += n.vx; n.y += n.vy;
      if(n.x < -20) n.x = w+20; if(n.x > w+20) n.x = -20;
      if(n.y < -20) n.y = h+20; if(n.y > h+20) n.y = -20;
    }
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a = nodes[i], b = nodes[j];
        const dx = a.x-b.x, dy = a.y-b.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < 140){
          ctx.strokeStyle = `rgba(232,230,226,${(1-dist/140)*0.08})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    for(let i=0;i<nodes.length;i++){
      const n = nodes[i];
      ctx.beginPath();
      ctx.fillStyle = 'rgba(232,230,226,0.35)';
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      ctx.fill();
    }
    if(!reduceMotion) requestAnimationFrame(frame);
  }
  frame();
})();

/* ---------------------------------------------------------
   2. Fixed scroll dial — rotates with total page scroll
      progress and gently fades once the CTA is reached.
--------------------------------------------------------- */
(function scrollDial(){
  const dialImg = document.querySelector('#scrollDial .dial-img');
  const dialWrap = document.getElementById('scrollDial');
  const chevron = document.querySelector('#scrollDial .dial-chevron');
  const closing = document.getElementById('closing');
  let ticking = false;

  function update(){
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    dialImg.style.transform = `rotate(${p * 720}deg)`;

    const closingTop = closing.getBoundingClientRect().top;
    const nearEnd = closingTop < window.innerHeight * 0.55;
    chevron.style.opacity = nearEnd ? '0' : '1';
    dialWrap.style.opacity = nearEnd ? '0.35' : '1';
    ticking = false;
  }
  document.addEventListener('scroll', () => {
    if(!ticking){ requestAnimationFrame(update); ticking = true; }
  }, { passive:true });
  update();
})();

/* ---------------------------------------------------------
   2. Particle transition — the diver disintegrates into embers,
      embers re-assemble into the hand + face artwork. Runs inside
      the left half of the combined pinned section, scroll-scrubbed.

      NOTE for the future 3D diver: this samples a flat PNG straight
      into a particle field. Once the OBJ model is ready, render it
      offscreen with a small Three.js scene (orbit the camera a few
      degrees for parallax, if wanted), draw that canvas into an
      offscreen 2D canvas each time the pose changes, and feed the
      result into sampleImage() below exactly like the PNG is now —
      the particle/disintegration pipeline itself doesn't need to change.
--------------------------------------------------------- */
(function particleTransition(){
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  const pinWrap = document.getElementById('duoPin');
  const stageEl = document.getElementById('particle-canvas').parentElement; // .duo-left
  const caption = document.getElementById('wipeCaption');

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H;

  function sizeCanvas(){
    const rect = stageEl.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', () => { sizeCanvas(); layoutParticles(); });

  // -- sample an image into a sparse particle field --------
  function sampleImage(img, opts){
    const { sampleW, threshold, step, marginX = 0, marginTop = 0, marginBottom = 0, minAlpha = 0 } = opts;
    const ratio = img.naturalHeight / img.naturalWidth;
    const sampleH = Math.round(sampleW * ratio);
    const off = document.createElement('canvas');
    off.width = sampleW; off.height = sampleH;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, sampleW, sampleH);
    const data = octx.getImageData(0,0,sampleW,sampleH).data;

    const pts = [];
    for(let y=0; y<sampleH; y+=step){
      for(let x=0; x<sampleW; x+=step){
        if(x < sampleW*marginX || x > sampleW*(1-marginX)) continue;
        if(y < sampleH*marginTop || y > sampleH*(1-marginBottom)) continue;
        const i = (y*sampleW + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if(a < minAlpha) continue;
        const lum = 0.299*r + 0.587*g + 0.114*b;
        if(lum > threshold){
          pts.push({
            u: x/sampleW, v: y/sampleH,
            r, g, b,
            lum
          });
        }
      }
    }
    return pts;
  }

  const diverImg = new Image();
  const handfaceImg = new Image();
  diverImg.src = 'assets/diver.png';
  handfaceImg.src = 'assets/handface.jpg';

  let diverRaw = [], handfaceRaw = [];
  let particlesReady = false;
  let diverParticles = [], handfaceParticles = [];

  function layoutParticles(){
    if(!diverRaw.length || !handfaceRaw.length) return;

    // shared "stage" rect, centred within the left panel, responsive
    const stageW = Math.min(W*0.72, H*0.62, 520);
    const stageH = stageW;
    const stageX = W/2 - stageW/2;
    const stageY = H/2 - stageH/2 - H*0.02;

    diverParticles = diverRaw.map(p => {
      const angle = Math.random()*Math.PI*2;
      const dist = 120 + Math.random()*(Math.max(W,H)*0.5);
      return {
        hx: stageX + p.u*stageW,
        hy: stageY + p.v*stageH,
        sx: stageX + p.u*stageW + Math.cos(angle)*dist,
        sy: stageY + p.v*stageH + Math.sin(angle)*dist - 50,
        color: `rgba(${Math.min(255,p.r+30)},${Math.min(255,p.g+18)},${Math.max(0,p.b-4)},`,
        size: 0.6 + Math.random()*1.3,
        seed: Math.random()
      };
    });

    handfaceParticles = handfaceRaw.map(p => {
      const angle = Math.random()*Math.PI*2;
      const dist = 100 + Math.random()*(Math.max(W,H)*0.45);
      return {
        hx: stageX + p.u*stageW,
        hy: stageY + p.v*stageH,
        sx: stageX + p.u*stageW + Math.cos(angle)*dist,
        sy: stageY + p.v*stageH + Math.sin(angle)*dist,
        color: `rgba(${p.r},${p.g},${p.b},`,
        size: 0.7 + Math.random()*1.5,
        seed: Math.random()
      };
    });

    particlesReady = true;
  }

  let imagesLoaded = 0;
  function onImgLoad(){
    imagesLoaded++;
    if(imagesLoaded === 2){
      // diver.png is a real cutout with alpha, so gate on alpha rather
      // than guessing a luminance threshold against an unknown backdrop —
      // this captures the whole suit, not just the bright rim-light bits.
      diverRaw = sampleImage(diverImg, { sampleW:170, threshold:4, step:2, minAlpha:120 });
      handfaceRaw  = sampleImage(handfaceImg,  { sampleW:170, threshold:34, step:2 });
      sizeCanvas();
      layoutParticles();
      requestAnimationFrame(render);
    }
  }
  diverImg.onload = onImgLoad;
  handfaceImg.onload = onImgLoad;

  function easeInOut(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  let progress = 0; // 0..1 across the pinned section
  let captionOn = false;

  function computeProgress(){
    const rect = pinWrap.getBoundingClientRect();
    const total = pinWrap.offsetHeight - window.innerHeight;
    const scrolled = -rect.top;
    progress = clamp01(total > 0 ? scrolled/total : 0);
  }

  function render(){
    if(!particlesReady){ requestAnimationFrame(render); return; }
    ctx.clearRect(0,0,W,H);

    const pA = clamp01(progress/0.42);          // diver disintegration 0->1
    const pB = clamp01((progress-0.58)/0.42);   // handface materialisation 0->1
    const eA = easeInOut(pA);
    const eB = easeInOut(pB);

    // diver: fades + scatters outward as eA rises
    if(eA < 1){
      ctx.globalCompositeOperation = 'lighter';
      for(let i=0;i<diverParticles.length;i++){
        const p = diverParticles[i];
        const local = clamp01(eA*1.15 - p.seed*0.15);
        const t = easeInOut(local);
        const x = p.hx + (p.sx-p.hx)*t;
        const y = p.hy + (p.sy-p.hy)*t - t*40;
        const alpha = (1-t) * 0.9;
        if(alpha <= 0.01) continue;
        ctx.beginPath();
        ctx.fillStyle = p.color + alpha.toFixed(3) + ')';
        ctx.arc(x, y, p.size + t*0.6, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // hand + face: converges + fades in as eB rises
    if(eB > 0){
      ctx.globalCompositeOperation = 'lighter';
      for(let i=0;i<handfaceParticles.length;i++){
        const p = handfaceParticles[i];
        const local = clamp01(eB*1.15 - p.seed*0.15);
        const t = easeInOut(local);
        const x = p.sx + (p.hx-p.sx)*t;
        const y = p.sy + (p.hy-p.sy)*t;
        const alpha = t * 0.95;
        if(alpha <= 0.01) continue;
        ctx.beginPath();
        ctx.fillStyle = p.color + alpha.toFixed(3) + ')';
        ctx.arc(x, y, p.size, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // caption wipe, from the right, once the face has assembled
    const capProgress = clamp01((progress-0.8)/0.18);
    if(capProgress > 0){
      caption.style.opacity = '1';
      caption.style.clipPath = `inset(0 0 0 ${(1-easeInOut(capProgress))*100}%)`;
    } else {
      caption.style.opacity = '0';
    }

    requestAnimationFrame(render);
  }

  document.addEventListener('scroll', () => { computeProgress(); }, { passive:true });
  computeProgress();
})();

/* ---------------------------------------------------------
   3. Services menu — a small semicircular "winding dial" of every
      discipline, sitting in the right half of the combined section
      next to the disintegration animation. Modelled on react-bits'
      OptionWheel: it spins via scroll, direct drag, or arrow keys,
      and items fade + tilt away from the focused selection. Each
      row is still a real link through to its own detail page.
--------------------------------------------------------- */
(function servicesDial(){
  const pinWrap = document.getElementById('duoPin');
  if(!pinWrap) return;
  const wrap = document.querySelector('.services-dial-wrap');
  const list = document.getElementById('servicesList');
  const items = Array.from(list.querySelectorAll('.service-item'));
  const counter = document.getElementById('servicesCounter');
  const N = items.length;

  let R = 120;       // arc radius, recomputed on resize
  let anchorX = 0, anchorY = 0;
  const angleStep = 0.30; // radians between neighbouring items

  // manualOffset lets drag/keys nudge the selection independently of
  // the page's scroll position; scroll still drives the base position.
  let manualOffset = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartOffset = 0;

  function measure(){
    const rect = wrap.getBoundingClientRect();
    R = Math.min(rect.width, rect.height) * 0.46;
    anchorX = rect.width * 0.92;
    anchorY = rect.height * 0.5;
  }
  window.addEventListener('resize', measure);
  measure();

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function clamp01(v){ return clamp(v, 0, 1); }

  function scrollProgress(){
    const rect = pinWrap.getBoundingClientRect();
    const total = pinWrap.offsetHeight - window.innerHeight;
    const scrolled = -rect.top;
    return clamp01(total > 0 ? scrolled/total : 0);
  }

  function render(){
    const base = scrollProgress() * (N - 1);
    const centerFloat = clamp(base + manualOffset, 0, N - 1);

    items.forEach((el, i) => {
      const d = i - centerFloat;
      const dist = Math.abs(d);
      const focus = clamp01(1 - dist/2.15);
      const angle = d * angleStep;

      const x = anchorX + R * (Math.cos(angle) - 1);
      const y = anchorY + R * Math.sin(angle);
      const tilt = clamp(-angle * 22, -34, 34); // degrees — tilts away from the focused item

      const fontSize = 0.8 + focus*0.85;    // rem
      const blur = (1-focus) * 5;           // px
      const visible = dist < 3.4;
      const opacity = visible ? (0.16 + focus*0.84) : 0;

      el.style.left = x.toFixed(1) + 'px';
      el.style.top = y.toFixed(1) + 'px';
      el.style.transform = `translate(-100%, -50%) rotate(${tilt.toFixed(1)}deg)`;
      el.style.fontSize = fontSize.toFixed(3) + 'rem';
      el.style.filter = `blur(${blur.toFixed(2)}px)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.fontWeight = (400 + focus*300).toFixed(0);
      el.style.color = focus > 0.7 ? 'var(--ink)' : 'var(--ink-dim)';
      el.style.pointerEvents = visible ? 'auto' : 'none';
    });

    const active = Math.round(centerFloat);
    counter.textContent = String(active+1).padStart(2,'0') + ' / ' + String(N).padStart(2,'0');
  }

  document.addEventListener('scroll', () => { requestAnimationFrame(render); }, { passive:true });
  window.addEventListener('resize', () => requestAnimationFrame(render));

  // --- drag to spin, like OptionWheel ---
  function clampManualOffset(){
    const base = scrollProgress() * (N - 1);
    manualOffset = clamp(manualOffset, -base, (N - 1) - base);
  }
  function onPointerDown(e){
    dragging = true;
    wrap.classList.add('dragging');
    dragStartX = e.clientX;
    dragStartOffset = manualOffset;
  }
  function onPointerMove(e){
    if(!dragging) return;
    const deltaPx = e.clientX - dragStartX;
    manualOffset = dragStartOffset - deltaPx/58; // 58px of drag ≈ one item
    clampManualOffset();
    requestAnimationFrame(render);
  }
  function onPointerUp(){
    dragging = false;
    wrap.classList.remove('dragging');
  }
  wrap.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // --- arrow keys to spin, like OptionWheel ---
  wrap.setAttribute('tabindex', '0');
  wrap.setAttribute('role', 'listbox');
  wrap.setAttribute('aria-label', 'Our services');
  wrap.addEventListener('keydown', (e) => {
    if(['ArrowUp','ArrowLeft'].includes(e.key)){
      e.preventDefault();
      manualOffset -= 1; clampManualOffset(); requestAnimationFrame(render);
    } else if(['ArrowDown','ArrowRight'].includes(e.key)){
      e.preventDefault();
      manualOffset += 1; clampManualOffset(); requestAnimationFrame(render);
    } else if(e.key === 'Enter'){
      const base = scrollProgress() * (N - 1);
      const activeIdx = Math.round(clamp(base + manualOffset, 0, N - 1));
      items[activeIdx].click();
    }
  });

  render();
})();

/* ---------------------------------------------------------
   4. Interior Architecture — before/after slider. Drag the
      handle (or the line, or tap anywhere) to wipe between
      the mid-build site photo and the finished render.
--------------------------------------------------------- */
(function beforeAfterSlider(){
  const panel = document.getElementById('interiors');
  if(!panel) return;
  const handle = document.getElementById('interiorsHandle');
  const hintLabel = document.getElementById('interiorsHintLabel');
  let dragging = false;

  function setSplit(clientX){
    const rect = panel.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(4, Math.min(96, pct));
    panel.style.setProperty('--split', pct + '%');
  }

  function clearHint(){
    handle.classList.remove('hint');
    if(hintLabel) hintLabel.style.opacity = '0';
  }

  function onPointerDown(e){
    dragging = true;
    clearHint();
    setSplit(e.clientX);
  }
  function onPointerMove(e){
    if(!dragging) return;
    setSplit(e.clientX);
  }
  function onPointerUp(){ dragging = false; }

  handle.addEventListener('pointerdown', onPointerDown);
  panel.addEventListener('pointerdown', (e) => {
    if(e.target === handle) return;
    dragging = true;
    clearHint();
    setSplit(e.clientX);
  });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
})();

/* ---------------------------------------------------------
   5. Closing section — logo, headline, copy and CTA wipe up
      from the bottom once the section enters view.
--------------------------------------------------------- */
(function closingReveal(){
  const closing = document.getElementById('closing');
  const items = closing.querySelectorAll('.wipe-up');

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        items.forEach((el, i) => {
          setTimeout(() => {
            el.style.transition = 'clip-path 0.9s cubic-bezier(.16,.84,.44,1), transform 0.9s cubic-bezier(.16,.84,.44,1), opacity 0.7s ease';
            el.style.clipPath = 'inset(0 0 0 0)';
            el.style.transform = 'translateY(0)';
            el.style.opacity = '1';
          }, i * 110);
        });
        io.disconnect();
      }
    });
  }, { threshold: 0.35 });

  io.observe(closing);
})();

/* ---------------------------------------------------------
   6. CTA — links straight to the contact page (contact.html).
--------------------------------------------------------- */

