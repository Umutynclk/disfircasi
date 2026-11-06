# KALIPORT — PALMX TXP 400 Windows Print Agent

Bu uygulama, PALMX TXP 400 termal barkod yazıcısının bağlı olduğu Windows bilgisayarda arka planda (Windows Servisi olarak) çalışarak sunucudaki `print_queue` yazdırma işlerini güvenli şekilde çeken, PDF oluşturan ve termal yazıcıya gönderen istemcidir.

---

## 🛡️ Kritik Güvenlik İlkeleri ve Sınırlar

1. **Varsayılan Simülasyon Koruması (`dryRun: true`):**
   - Agent ilk kurulumda ve varsayılan olarak `DRY_RUN=true` modunda çalışır.
   - Bu modda fiziksel yazıcıya hiçbir veri gönderilmez.
   - İndirilen PDF dosyaları yerel `./simulated_prints/` klasörüne kaydedilir.
   - Simülasyon sonucu sunucuya `status: 'simulated'` olarak bildirilir; **gerçek üretim siparişini asla `printed` durumuna geçirmez.**
2. **Platform Koruması:**
   - macOS veya Linux ortamında `dryRun: false` ayarlansa dahi gerçek yazıcı sürücüsü asla başlatılmaz; sistem otomatik olarak simülasyona düşer.
3. **Canlı Kargo Koruması:**
   - `HEPSIJET_LIVE_DISPATCH_ENABLED` kapalı kalır. Canlı HepsiJET API'si çağrılarak gerçek gönderi oluşturulmaz.
4. **Gizlilik ve Token Güvenliği:**
   - Müşteri kişisel verileri (ad, soyad, açık adres, telefon) ve agent tokenları terminale veya log dosyalarına asla düz metin olarak yazdırılmaz.
   - Tokenlar `pa_tes***` şeklinde maskelenir.

---

## 📋 Sistem Gereksinimleri

- **İşletim Sistemi:** Windows 10, Windows 11 veya Windows Server 2016+
- **Çalışma Ortamı:** Node.js LTS v18.x, v20.x veya v22.x ([nodejs.org](https://nodejs.org))
- **Donanım:** PALMX TXP 400 Termal Barkod Yazıcı (USB veya Ağ bağlantılı)
- **Etiket Rulosu:** 150 × 100 mm (Yatay) veya 100 × 150 mm (Dikey) Termal Kargo Etiketi
- **Önerilen Yardımcı Araç (Opsiyonel ama Önerilir):**
  - **SumatraPDF** (veya **PDFtoPrinter.exe**): Sessiz, penceresiz ve tam ölçekli termal yazdırma için `print-agent` klasörüne `SumatraPDF.exe` veya `PDFtoPrinter.exe` konulması tavsiye edilir.

---

## 🚀 Windows Kurulumu (Tek Tıkla Sıfır Kod Mimarisi)

Windows bilgisayarda Sonrakam.com projesinin kaynak kodları, Next.js, GitHub reposu veya Firebase CLI **bulunmaz**.
Yalnızca `print-agent/` klasörü Windows bilgisayara kopyalanır.

### Adım 1: Klasörü Windows Bilgisayara Kopyalayın
Windows bilgisayarda `C:\KaliportPrintAgent` klasörü oluşturun ve yalnızca `print-agent/` klasörünün içeriğini buraya yapıştırın.
(Derlenmiş `dist/index.js`, `quick-setup.bat`, `install-service.ps1`, `config.example.json` dosyaları tek başına yeterlidir).

### Adım 2: `quick-setup.bat` Dosyasına Çift Tıklayın
1. `quick-setup.bat` scriptine sağ tıklayıp **Yönetici Olarak Çalıştır**'ı seçin.
2. Script sistemdeki bağlı termal yazıcıları listeler (örn. `PALMX TXP 400`).
3. Admin panelinden (`/admin/ayarlar` -> Print Agent Durumu) aldığınız tokenı sorulduğunda yapıştırın.
4. Script otomatik olarak:
   - Bilgisayarın prizde iken uyku moduna geçmesini kapatır (`standby-timeout-ac 0`),
   - Windows Servisini veya Görev Zamanlayıcı arka plan görevini oluşturur,
   - Bilgisayar açılışında otomatik başlama ayarını yapar,
   - Sunucuya bağlantı testini gerçekleştirir.

---

### Adım 3: Manuel Test veya Numune Baskı
- **Numune Baskı Testi:** `test-sample.bat` dosyasına çift tıklayın. Yazıcıya veya simülasyona tek bir numune gönderilir.
- **Canlı Mod:** Etiketlerin fiziksel çıkması için `config.json` dosyasında `"dryRun": false` olarak ayarlanır.

### Adım 3: Yazıcıyı ve Sürücüyü Denetleyin
PowerShell'i yönetici olarak açıp şu komutu çalıştırın:

```powershell
cd C:\KaliportPrintAgent
powershell -ExecutionPolicy Bypass -File .\check-printer.ps1
```

- Çıktıda `✅ Yazıcı Windows üzerinde başarıyla bulundu!` mesajını ve port bilgisini teyit edin.
- Yazıcı adı Windows'ta farklı görünüyorsa (örn: `PALMX 400`), `config.json` dosyasındaki `printerName` alanını bu adla birebir eşitleyin.
- İsteğe bağlı Windows test sayfası basmak için:
  ```powershell
  .\check-printer.ps1 -PrintTestPage
  ```

---

## 🧪 Test Aşamaları (Önce Simülasyon, Sonra Kontrollü Baskı)

### Test 1: Güvenli Simülasyon Testi (Windows / Mac)
Gerçek sunucuya ve kuyruğa dokunmadan, tek bir sentetik numune etiketle simülasyonu test edin:

```bash
# Simülasyon numune testi
npx tsx index.ts --test-sample
```
- **Beklenen Çıktı:** `✅ SİMÜLASYON BAŞARILI! PDF Dosyası Diske Yazıldı: ./simulated_prints/job_sample_manual_...pdf`
- **Doğrulama:** PDF dosyasını açıp 150×100 mm boyutunu, `(NUMUNE)` filigranını ve barkod alanını kontrol edin.

---

### Test 2: Kontrollü Fiziksel Numune Baskısı (Yalnızca Windows)
Bu adım **yalnızca** Test 1 başarılı olduktan, yazıcı açık ve termal kâğıt takılı olduktan sonra operatör onayıyla yapılır.

1. `config.json` dosyasında geçici olarak `"dryRun": false` yapın.
2. PowerShell üzerinden **yalnızca tek bir numune** basmak için şu komutu çalıştırın:
   ```powershell
   npx tsx index.ts --test-sample
   ```
3. **Fiziksel Doğrulama Listesi:**
   - [ ] Yazıcı kâğıdı sıkışmadan düzgün besledi mi?
   - [ ] Etiket sınırları taştı mı (150×100 mm veya 100×150 mm)?
   - [ ] Barkod çizgileri net mi?
   - [ ] Metinlerde Türkçe karakter bozulması var mı?
   - [ ] Etikette `* HJ-TEST-9876543210TR (NUMUNE) *` ve geçersizlik uyarısı yer alıyor mu?
4. **Test sonrası:** Canlı otomatik otomasyon kuyruğu henüz başlatılmayacaksa `config.json` dosyasında `"dryRun": true` değerine geri dönün.

---

## ⚙️ Windows Servisi Olarak Çalıştırma (Arka Plan)

### Servis Kurulumu
PowerShell'i **Yönetici Olarak Çalıştır** seçeneğiyle açın:

```powershell
cd C:\KaliportPrintAgent
powershell -ExecutionPolicy Bypass -File .\install-service.ps1
```

- NSSM mevcutsa Windows Service (`KaliportPrintAgent`) olarak kurulur.
- NSSM yoksa Windows Görev Zamanlayıcı (Task Scheduler) ile sistem açılışında arka planda başlayacak şekilde yapılandırılır.

### Servis Yönetim Komutları

```powershell
# Durum kontrolü
Get-Service KaliportPrintAgent

# Servisi durdurma
Stop-Service KaliportPrintAgent

# Servisi başlatma
Start-Service KaliportPrintAgent

# Servisi yeniden başlatma
Restart-Service KaliportPrintAgent

# Canlı logları izleme
Get-Content C:\KaliportPrintAgent\logs\agent_stdout.log -Tail 50 -Wait
```

### Servis Kaldırma
```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall-service.ps1
```

---

## 🔑 Agent Tokenını Döndürme veya İptal Etme

1. KALIPORT Admin Paneli -> **Ayarlar / Print Agents** sayfasına gidin.
2. İlgili agent'ın yanındaki **"Tokenı Yenile"** veya **"Erişimi İptal Et"** butonuna tıklayın.
3. Yeni üretilen tokenı kopyalayın.
4. Windows bilgisayarda `C:\KaliportPrintAgent\config.json` dosyasındaki `agentToken` alanına yapıştırın.
5. Servisi yeniden başlatın:
   ```powershell
   Restart-Service KaliportPrintAgent
   ```
