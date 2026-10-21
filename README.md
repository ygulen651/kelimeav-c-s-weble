# Kelime Avcısı — tanıtım sitesi

Bu, Kelime Avcısı uygulamasının statik tanıtım sitesi. Hiçbir paket kurmanız gerekmez, Node.js 18 veya üzeri yeterlidir.

## Klasör yapısı

```
src/
  config.json          ← Mağaza bağlantıları, e-posta, geliştirici bilgisi, duraklar, SSS (TÜM DÜZENLENEBİLİR BİLGİ)
  layout.html          ← Ortak <head> (SEO, sosyal paylaşım, favicon)
  partials/            ← Üst menü ve alt bilgi
  pages/               ← Sayfalar (her biri ayrı adres)
    index.html             /
    gizlilik.html          /gizlilik/
    kullanim-kosullari.html /kullanim-kosullari/
    hesap-silme.html       /hesap-silme/
    destek.html            /destek/
    hakkinda.html          /hakkinda/
    404.html
  assets/css, js, fonts, img
  og-image.jpg, favicon.ico, apple-touch-icon.png, icon-*.png
build.mjs              ← Derleyici
dist/                  ← Yayınlanacak çıktı (otomatik üretilir, elle düzenlemeyin)
```

## Komutlar

```bash
node build.mjs           # dist/ klasörünü üretir
node build.mjs --serve   # derler ve http://localhost:4321 adresinde önizler
```

Derleyici her çalıştığında şunları listeler:
- hukuki metinlerde sarı **DOĞRULA** ile işaretlenmiş ifadeler,
- doldurulmamış yapılandırma alanları (alan adı, e-posta, geliştirici adı ve adresi).

**Bu listede hiçbir madde kalmadan siteyi yayına almayın.** İşaretli ifadeyi doğruladıktan sonra `<mark class="dogrula">…</mark>` etiketini kaldırın ve metni gerekiyorsa düzeltin.

## Sık yapılan değişiklikler

| Ne? | Nerede? |
|---|---|
| App Store / Google Play bağlantısı | `config.json` → `stores`. Boş bırakılan buton "Yakında" olarak görünür. |
| Destek e-postası, yanıt süresi | `config.json` → `contact` |
| Alan adı | `config.json` → `site.url` (canonical, sitemap ve sosyal paylaşım bu değerden üretilir) |
| Son güncelleme tarihi | `config.json` → `site.lastUpdated` (YYYY-AA-GG). Hukuki metinleri her değiştirdiğinizde güncelleyin. |
| SSS | `config.json` → `faq` (ana sayfa ve destek sayfasında görünür) |
| Duraklar | `config.json` → `stops` |
| Ekran görüntüleri | `src/assets/img/screens/` (600×1304, hem `.webp` hem `.jpg`) |

## İletişim formu

- `contact.formEndpoint` **boşsa**: Form, alanları doğrular ve mesajı kullanıcının e-posta uygulamasında hazırlar. Sunucuya hiçbir şey gönderilmez ve form "gönderildi" gibi davranmaz.
- **Gerçek gönderim için** JSON POST kabul eden bir form hizmetinin adresini yazın (ör. Formspree: `https://formspree.io/f/XXXX`). Form gönderimde başarı ve hata durumlarını gösterir; `_headers` dosyasındaki CSP kuralına bu adres otomatik eklenir. Bu durumda Gizlilik Politikası'ndaki "form hizmeti sağlayıcısı" işaretli alanını doldurun.

## Yayınlama

`dist/` klasörünün içeriği herhangi bir statik barındırma hizmetine yüklenebilir. Hepsi ücretsiz HTTPS sunar.

**Netlify / Cloudflare Pages (önerilir):** Build komutu `node build.mjs`, yayın klasörü `dist`. `dist/_headers` dosyası güvenlik başlıklarını (HSTS, CSP vb.) otomatik uygular. Alan adınızı bağlayıp HTTPS'i açın.

**GitHub Pages / klasik hosting:** `dist/` içeriğini yükleyin. `_headers` dosyası bu ortamlarda çalışmaz; güvenlik başlıklarını sunucu ayarlarından ekleyin. 404 sayfası `404.html`'dir.

Yayından sonra:
1. `https://alanadınız/gizlilik/` adresini App Store Connect'te **Privacy Policy URL**, Google Play Console'da **Gizlilik politikası** alanına girin.
2. `https://alanadınız/hesap-silme/` adresini Google Play'deki **Hesap silme URL'si** alanına girin.
3. `https://alanadınız/destek/` adresini App Store'daki **Support URL** alanına girin.
4. `sitemap.xml` dosyasını Google Search Console'a ekleyin.

## Notlar

- Site çerez, analiz veya izleme aracı kullanmaz. Yazı tipleri (Plus Jakarta Sans, Sora, Fraunces, SIL Open Font License) sitenin kendi sunucusundan yüklenir. Sonradan analiz aracı eklerseniz Gizlilik Politikası'nı güncelleyin ve gerekiyorsa çerez onayı ekleyin.
- Profil ekranı görüntüsündeki gerçek kişi adı "Genç Kaşif" ile değiştirildi.
- Mağaza butonları özel tasarım. İsterseniz Apple'ın ve Google'ın resmî rozetleriyle değiştirebilirsiniz (`build.mjs` → `storeButtons`).
