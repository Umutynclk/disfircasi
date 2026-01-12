# 🦷 Elektrikli Diş Fırçası E-Ticaret Sitesi

Modern, ölçeklenebilir ve tamamen özelleştirilebilir bir e-ticaret platformu.

## ✨ Özellikler

- 🎨 **Modern ve Şık Tasarım**: Apple.com ve Oral-B.com.tr'den ilham alınmış tasarım
- 🔥 **Firebase Entegrasyonu**: Firestore, Authentication, Storage ve Analytics
- 👨‍💼 **Admin Paneli**: Tüm içerikleri yönetebileceğiniz kapsamlı admin paneli
- 📱 **Responsive Design**: Mobil, tablet ve desktop uyumlu
- 🛍️ **Ürün Yönetimi**: Ürün ekleme, düzenleme, silme ve stok takibi
- 🎨 **Renk Seçenekleri**: Her ürün için renk bazlı görsel ve fiyat yönetimi
- 📸 **Medya Yönetimi**: Fotoğraf ve video yükleme (Firebase Storage)
- 📝 **İçerik Yönetimi**: Tüm sayfa içeriklerini admin panelinden düzenleme
- 🔐 **Kullanıcı Sistemi**: Firebase Authentication ile kullanıcı girişi/kayıt
- 🍪 **Cookie Yönetimi**: Ziyaret takibi ve kullanıcı deneyimi iyileştirmeleri

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js 18+ 
- npm veya yarn
- Firebase hesabı

### Kurulum

1. **Projeyi klonlayın**:
   ```bash
   git clone <repo-url>
   cd cursor-disfircasi
   ```

2. **Bağımlılıkları yükleyin**:
   ```bash
   npm install
   ```

3. **Environment variables ayarlayın**:
   `.env.local` dosyasını oluşturun:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

4. **Development server'ı başlatın**:
   ```bash
   npm run dev
   ```

5. **Tarayıcıda açın**:
   ```
   http://localhost:3000
   ```

## 📁 Proje Yapısı

```
├── app/                    # Next.js App Router sayfaları
│   ├── admin/              # Admin paneli sayfaları
│   ├── urunler/            # Ürün listesi ve detay sayfaları
│   └── ...                 # Diğer sayfalar
├── components/             # React bileşenleri
│   ├── admin/              # Admin paneli bileşenleri
│   ├── home/               # Ana sayfa bileşenleri
│   └── layout/             # Layout bileşenleri
├── firebase/               # Firebase konfigürasyonu
├── lib/                    # Utility fonksiyonları
└── public/                 # Statik dosyalar
```

## 🛠️ Kullanım

### Admin Paneli

1. `/admin/login` adresine gidin
2. Firebase Authentication ile giriş yapın
3. Admin panelinden:
   - Ürün ekleme/düzenleme/silme
   - Site içeriklerini düzenleme
   - Medya yönetimi
   - Ayarlar

### Ürün Ekleme

1. Admin paneli → Ürünler → Yeni Ürün
2. Ürün bilgilerini doldurun
3. Fotoğraflar yükleyin
4. Renk seçenekleri ekleyin (opsiyonel)
5. Kaydedin

## 🚢 Deployment

Detaylı deployment talimatları için `DEPLOY.md` dosyasına bakın.

### Hızlı Deploy (Vercel)

1. GitHub'a push edin
2. Vercel'e bağlayın
3. Environment variables ekleyin
4. Deploy edin!

## 📝 Scripts

- `npm run dev` - Development server başlat
- `npm run build` - Production build oluştur
- `npm start` - Production server başlat
- `npm run lint` - ESLint çalıştır

## 🔧 Teknolojiler

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Firebase** - Backend (Firestore, Auth, Storage, Analytics)
- **Framer Motion** - Animations
- **React Icons** - Icons

## 📄 Lisans

Bu proje özel bir projedir.

## 🤝 Katkıda Bulunma

Bu proje özel bir projedir. Sorularınız için iletişime geçin.

---

**Not**: Production'a deploy etmeden önce Firebase Security Rules'ları kontrol edin!
