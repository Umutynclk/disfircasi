# Kurulum Rehberi

## 1. Bağımlılıkları Yükle

\`\`\`bash
npm install
\`\`\`

## 2. Firebase Yapılandırması

1. [Firebase Console](https://console.firebase.google.com/) üzerinden yeni bir proje oluşturun
2. Authentication'ı etkinleştirin (Email/Password)
3. Firestore Database oluşturun
4. Storage'ı etkinleştirin
5. Web app için yapılandırma bilgilerini alın

## 3. Ortam Değişkenlerini Ayarlayın

Proje kök dizininde \`.env.local\` dosyası oluşturun:

\`\`\`
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
\`\`\`

## 4. Firestore Koleksiyonları

Aşağıdaki koleksiyonları oluşturun:

### products
- name (string)
- price (number)
- description (string)
- images (array)
- video (string, optional)
- features (array)
- specifications (map)
- category (string)
- inStock (boolean)
- createdAt (timestamp)
- updatedAt (timestamp)

### contacts
- name (string)
- email (string)
- phone (string)
- subject (string)
- message (string)
- createdAt (timestamp)

## 5. Storage Kuralları

Firebase Storage'da aşağıdaki kuralları ayarlayın:

\`\`\`
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /videos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
\`\`\`

## 6. Firestore Güvenlik Kuralları

\`\`\`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products - herkes okuyabilir, sadece admin yazabilir
    match /products/{productId} {
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
\`\`\`

## 7. Admin Kullanıcı Oluşturma

1. Firebase Console > Authentication > Users
2. "Add user" ile admin kullanıcısı ekleyin
3. Bu kullanıcı ile admin paneline giriş yapabilirsiniz

## 8. Projeyi Çalıştırma

\`\`\`bash
npm run dev
\`\`\`

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

## Admin Paneli

Admin paneline erişmek için:
- URL: \`/admin/login\`
- Firebase Authentication ile oluşturduğunuz kullanıcı bilgileri ile giriş yapın

## Önemli Notlar

- İlk çalıştırmada Firebase bağlantı hatası alabilirsiniz, bu normaldir
- Demo veriler gösterilir, gerçek veriler için Firebase yapılandırmasını tamamlayın
- Production için Firebase kurallarını güvenlik gereksinimlerinize göre güncelleyin



