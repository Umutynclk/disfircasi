# Projeyi Çalıştırma Rehberi

## Adım 1: Node.js Kurulumu Kontrol

Önce Node.js'in yüklü olduğundan emin olun:

\`\`\`bash
node --version
npm --version
\`\`\`

Eğer yüklü değilse: [Node.js İndir](https://nodejs.org/) (v18 veya üzeri önerilir)

## Adım 2: Bağımlılıkları Yükle

Proje klasörüne gidin ve paketleri yükleyin:

\`\`\`bash
cd "/Users/umutyoncalik/Desktop/cursor disfircasi"
npm install
\`\`\`

Bu işlem birkaç dakika sürebilir. Tüm paketlerin yüklenmesini bekleyin.

## Adım 3: Firebase Yapılandırması (İsteğe Bağlı - Demo İçin Gerekli Değil)

Eğer Firebase kullanmak istiyorsanız:

1. `.env.local` dosyası oluşturun
2. Firebase bilgilerinizi ekleyin (detaylar için KURULUM.md'ye bakın)

**Not:** Firebase olmadan da proje çalışır, ancak ürünler demo verilerle gösterilir.

## Adım 4: Geliştirme Sunucusunu Başlat

\`\`\`bash
npm run dev
\`\`\`

Bu komutu çalıştırdıktan sonra şu çıktıyı göreceksiniz:

\`\`\`
  ▲ Next.js 14.2.0
  - Local:        http://localhost:3000
  - Ready in X seconds
\`\`\`

## Adım 5: Tarayıcıda Aç

Tarayıcınızda şu adresi açın:
**http://localhost:3000**

## Komutlar

### Geliştirme Modu
\`\`\`bash
npm run dev
\`\`\`
- Hot reload aktif (kod değişikliklerinde otomatik yenilenir)
- http://localhost:3000 adresinde çalışır

### Production Build
\`\`\`bash
npm run build
npm start
\`\`\`
- Production için optimize edilmiş build
- Önce `build` sonra `start` çalıştırılmalı

### Lint Kontrol
\`\`\`bash
npm run lint
\`\`\`
- Kod kalitesi kontrolü

## Sorun Giderme

### Port 3000 Kullanımda
Eğer 3000 portu kullanılıyorsa:
\`\`\`bash
npm run dev -- -p 3001
\`\`\`

### Node_modules Hatası
Eğer hata alırsanız:
\`\`\`bash
rm -rf node_modules package-lock.json
npm install
\`\`\`

### TypeScript Hataları
\`\`\`bash
npm install --save-dev typescript @types/node @types/react @types/react-dom
\`\`\`

## İlk Çalıştırma Sonrası

1. Ana sayfa açılacak: http://localhost:3000
2. Ürünler sayfası: http://localhost:3000/urunler
3. İletişim: http://localhost:3000/iletisim
4. Admin paneli: http://localhost:3000/admin/login (Firebase yapılandırması gerekli)

## Önemli Notlar

- ✅ Firebase yapılandırması olmadan da çalışır (demo veriler gösterilir)
- ✅ Hot reload otomatik çalışır - dosyaları kaydedince tarayıcı güncellenir
- ✅ TypeScript tip kontrolü yapılır
- ✅ Tailwind CSS otomatik derlenir



