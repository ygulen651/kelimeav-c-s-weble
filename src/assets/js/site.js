// Kelime Avcısı — küçük etkileşimler. Takip veya depolama kullanılmaz.
(() => {
  const doc = document.documentElement;
  doc.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Üst bar gölgesi
  const topbar = document.querySelector('[data-topbar]');
  if (topbar) {
    const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobil menü
  const menuBtn = document.querySelector('[data-menu-btn]');
  const menu = document.querySelector('[data-menu]');
  if (menuBtn && menu) {
    const label = menuBtn.querySelector('.sr-only');
    const setOpen = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      label.textContent = open ? 'Menüyü kapat' : 'Menüyü aç';
    };
    menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setOpen(false); menuBtn.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !menuBtn.contains(e.target)) setOpen(false);
    });
  }

  // Kaydırınca beliren öğeler
  const reveals = document.querySelectorAll('.section .reveal, .route .reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  }

  // Hero 3D eğim (yalnızca fareyle ve hareket azaltma kapalıyken)
  const stage = document.querySelector('[data-tilt]');
  if (stage && !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hero = stage.closest('.hero');
    let frame = 0;
    hero.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        stage.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
        stage.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      });
    });
    hero.addEventListener('pointerleave', () => {
      stage.style.setProperty('--ry', '0deg');
      stage.style.setProperty('--rx', '0deg');
    });
  }

  // Ekran galerisi
  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const prev = document.querySelector('[data-gallery-prev]');
    const next = document.querySelector('[data-gallery-next]');
    const step = () => {
      const item = gallery.querySelector('.shot');
      return item ? item.getBoundingClientRect().width + parseFloat(getComputedStyle(gallery).columnGap || 24) : 300;
    };
    const update = () => {
      const max = gallery.scrollWidth - gallery.clientWidth - 4;
      prev.disabled = gallery.scrollLeft <= 4;
      next.disabled = gallery.scrollLeft >= max;
    };
    prev.addEventListener('click', () => gallery.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => gallery.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
    gallery.addEventListener('scroll', update, { passive: true });
    gallery.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    });
    window.addEventListener('resize', update);
    update();
  }

  // İletişim formu
  const form = document.querySelector('[data-contact-form]');
  if (form) {
    const status = form.querySelector('[data-status]');
    const submit = form.querySelector('[type="submit"]');
    const endpoint = form.dataset.endpoint;
    const email = form.dataset.email;

    const rules = {
      name: (v) => (v.trim().length >= 2 ? '' : 'Lütfen adını yaz (en az 2 karakter).'),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Geçerli bir e-posta adresi yaz.'),
      topic: (v) => (v ? '' : 'Bir konu seç.'),
      message: (v) => (v.trim().length >= 10 ? '' : 'Mesajın en az 10 karakter olmalı.'),
    };

    const validateField = (field) => {
      const rule = rules[field.name];
      if (!rule) return true;
      const msg = rule(field.value);
      const err = form.querySelector(`#${field.id}-hata`);
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg;
      return !msg;
    };

    form.querySelectorAll('input, select, textarea').forEach((f) => {
      f.addEventListener('blur', () => { if (f.value) validateField(f); });
      f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') validateField(f); });
    });

    const setStatus = (type, text) => {
      status.className = `status status--${type}`;
      status.textContent = text;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = [...form.querySelectorAll('[name]')].filter((f) => rules[f.name]);
      const invalid = fields.filter((f) => !validateField(f));
      if (invalid.length) {
        setStatus('err', 'Formda düzeltilmesi gereken alanlar var.');
        invalid[0].focus();
        return;
      }
      if (form.querySelector('[name="_gotcha"]').value) return; // bot

      const data = Object.fromEntries(new FormData(form));
      delete data._gotcha;

      if (!endpoint) {
        // Sunucu tarafı form altyapısı yok: mesajı kullanıcının e-posta uygulamasında hazırla.
        const subject = `[${data.topic}] Kelime Avcısı destek talebi`;
        const body = `${data.message}\n\n—\nAd: ${data.name}\nE-posta: ${data.email}${data.device ? `\nCihaz / sürüm: ${data.device}` : ''}`;
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setStatus('info', `Mesajın e-posta uygulamanda hazırlandı. Göndermek için orada “Gönder”e dokun. E-posta uygulaman açılmadıysa doğrudan ${email} adresine yazabilirsin.`);
        return;
      }

      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'Gönderiliyor…';
      setStatus('info', 'Mesajın gönderiliyor…');
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        fields.forEach((f) => f.removeAttribute('aria-invalid'));
        setStatus('ok', 'Teşekkürler! Mesajın bize ulaştı. Yazdığın e-posta adresinden sana dönüş yapacağız.');
      } catch {
        setStatus('err', `Mesajın gönderilemedi. Lütfen biraz sonra tekrar dene ya da doğrudan ${email} adresine yaz.`);
      } finally {
        submit.disabled = false;
        submit.textContent = original;
      }
    });
  }
})();
