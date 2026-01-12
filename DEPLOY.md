# Deployment Guide

Bu proje production'a deploy edilmeye hazırdır. Aşağıdaki adımları takip edin:

## 🚀 Deployment Seçenekleri

### 1. Vercel (Önerilen - En Kolay)

1. **Vercel hesabı oluşturun**: https://vercel.com
2. **GitHub'a push edin**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
3. **Vercel'e bağlayın**:
   - Vercel dashboard'a gidin
   - "New Project" tıklayın
   - GitHub repo'nuzu seçin
   - Environment variables ekleyin (`.env.local` içindekiler)
   - Deploy edin!

**Environment Variables (Vercel Dashboard'da ekleyin):**
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAmzO0RY0q0g20adKEcn6vm3246xiPgmJE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=disfircasi-f8e72.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=disfircasi-f8e72
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=disfircasi-f8e72.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=304503945342
NEXT_PUBLIC_FIREBASE_APP_ID=1:304503945342:web:c2f9be5aef1f244df5402f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-YP3EEH211Z
```

### 2. Netlify

1. **Netlify hesabı oluşturun**: https://netlify.com
2. **Build ayarları**:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Environment variables: `.env.local` içindekileri ekleyin

### 3. Docker

1. **Dockerfile oluşturun** (zaten var)
2. **Build edin**:
   ```bash
   docker build -t disfircasi .
   docker run -p 3000:3000 disfircasi
   ```

### 4. Standalone Build (VPS/Server)

1. **Build edin**:
   ```bash
   npm run build
   npm start
   ```

## 📋 Pre-Deployment Checklist

- [x] Environment variables ayarlandı
- [x] `next.config.js` production için optimize edildi
- [x] Firebase config doğru
- [ ] Firebase Security Rules kontrol edildi
- [ ] Admin panel erişimi test edildi
- [ ] Tüm sayfalar test edildi

## 🔒 Firebase Security Rules

Firebase Firestore ve Storage için security rules'ları kontrol edin:

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin koleksiyonu - sadece authenticated admin
    match /admin/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Products - herkes okuyabilir, sadece admin yazabilir
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Site content - herkes okuyabilir, sadece admin yazabilir
    match /siteContent/{contentId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Contacts - herkes yazabilir, sadece admin okuyabilir
    match /contacts/{contactId} {
      allow create: if true;
      allow read: if request.auth != null;
    }
  }
}
```

**Storage Rules:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 🧪 Production Build Test

```bash
# Build test
npm run build

# Production server test
npm start
```

## 📝 Notlar

- `.env.local` dosyası git'e commit edilmemeli (zaten .gitignore'da)
- Production'da environment variables platform üzerinden eklenmeli
- Firebase config production'da da aynı olmalı
- Admin panel erişimi için Firebase Authentication kullanılıyor
