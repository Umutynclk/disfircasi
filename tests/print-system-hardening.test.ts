import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { PDFDocument } from 'pdf-lib'
import { createSampleHepsiJetLabelPdf } from '../lib/hepsijet/sampleLabel'
import {
  generateCombinedThermalLabelPdf,
  inspectThermalPdfBuffer,
  findFirstNonEmptyPageIndex,
} from '../lib/printing/combined-label'
import { validateOrderForPrintQueue } from '../lib/printing/queue'
import {
  buildSumatraPrintArgs,
  WindowsPrinterDriver,
  SimulatedPrinterDriver,
} from '../print-agent/printer'
import { PrintAgentService } from '../print-agent/agent'
import { PrintJob, PRINT_AGENT_VERSION } from '../print-agent/types'

// ─── 1. ÖDEME EKRANI VE TARAYICI YAZDIRMA AYRIMI ────────────────────────────

describe('Ödeme Ekranı ve Tarayıcı Otomatik Yazdırma Koruması', () => {
  it('app/satin-al/page.tsx içinde window.print veya PrintTo çağrısı yoktur', () => {
    const checkoutCode = fs.readFileSync(
      path.resolve(process.cwd(), 'app/satin-al/page.tsx'),
      'utf-8'
    )
    assert.strictEqual(checkoutCode.includes('window.print('), false)
    assert.strictEqual(checkoutCode.includes('PrintTo'), false)
    assert.strictEqual(checkoutCode.includes('react-to-print'), false)
  })

  it('app/admin/siparisler/page.tsx onSnapshot akışında otomatik window.print() çağrısı kaldırılmıştır', () => {
    const adminOrdersCode = fs.readFileSync(
      path.resolve(process.cwd(), 'app/admin/siparisler/page.tsx'),
      'utf-8'
    )
    assert.strictEqual(
      adminOrdersCode.includes('if (autoPrintPromptRef.current)'),
      false,
      'onSnapshot içinde otomatik window.print() bulunmamalı'
    )
  })

  it('print-agent/printer.ts içinde GUI açan Start-Process / PrintTo komutu kaldırılmıştır', () => {
    const printerCode = fs.readFileSync(
      path.resolve(process.cwd(), 'print-agent/printer.ts'),
      'utf-8'
    )
    // Yorum satırlarını çıkarıp yalnızca çalışan kodu denetle
    const executableCode = printerCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    assert.strictEqual(executableCode.includes('-Verb PrintTo'), false)
    assert.strictEqual(executableCode.includes('Start-Process'), false)
    assert.strictEqual(executableCode.includes('-print-to-default'), false)
  })
})

// ─── 2. PAID DOĞRULAMASI VE KUYRUK KURALLARI ────────────────────────────────

describe('Print Queue — Yalnızca Doğrulanmış PAID ve Geçerli Kargo Kuralı', () => {
  it('PENDING, FAILED, CANCELLED siparişler kuyruğa kabul edilmez', () => {
    for (const paymentStatus of ['PENDING', 'FAILED', 'CANCELLED', undefined]) {
      const res = validateOrderForPrintQueue({
        id: 'ord_1',
        paymentStatus,
        status: 'processing',
        shipping: { status: 'created', barcode: 'KALIPORT12345678' },
      })
      assert.strictEqual(res.isValid, false, `${paymentStatus} sipariş reddedilmeli`)
    }
  })

  it('PAID ama kargosu oluşturulmamış sipariş kuyruğa kabul edilmez', () => {
    const res = validateOrderForPrintQueue({
      id: 'ord_2',
      paymentStatus: 'PAID',
      status: 'processing',
      shipping: { status: 'not_created' },
    })
    assert.strictEqual(res.isValid, false)
  })

  it('PAID + created + gerçek barkodlu sipariş kuyruğa kabul edilir', () => {
    const res = validateOrderForPrintQueue({
      id: 'ord_3',
      paymentStatus: 'PAID',
      status: 'processing',
      shipping: { status: 'created', barcode: 'KALIPORT99887766' },
    })
    assert.strictEqual(res.isValid, true)
  })

  it('Test/simülasyon barkodu gerçek print_queue içine alınamaz', () => {
    const res = validateOrderForPrintQueue({
      id: 'ord_4',
      paymentStatus: 'PAID',
      status: 'processing',
      shipping: { status: 'created', barcode: 'HJ-TEST-9876543210TR' },
    })
    assert.strictEqual(res.isValid, false)
  })
})

// ─── 3. PDF SAYFA SAYISI, BOŞ SAYFA KONTROLÜ VE ÖLÇÜ DOĞRULAMASI ───────────

describe('Birleşik Termal PDF — Tek Sayfa, Sıfır Boş Sayfa ve Doğru Ölçü', () => {
  it('Sentetik TEST - GERÇEK KARGO DEĞİLDİR siparişiyle 100x150mm dikey tek sayfa PDF üretir', async () => {
    const syntheticBarcode = 'TEST-GERCEK-KARGO-DEGILDIR-001'
    const hepsijetSample = await createSampleHepsiJetLabelPdf({
      barcode: syntheticBarcode,
      recipientName: 'Test Alici',
      city: 'ISTANBUL',
      town: 'KADIKOY',
    })

    const combinedBuffer = await generateCombinedThermalLabelPdf({
      order: {
        id: 'ORD_TEST_PDF_001',
        orderNumber: 'TEST-2026-001',
        createdAt: '2026-11-21T09:00:00.000Z',
        paymentStatus: 'PAID',
        total: 899,
        customer: { name: 'Test Alici', phone: '05000000000' },
        shippingAddress: {
          fullName: 'Test Alici',
          city: 'Istanbul',
          district: 'Kadikoy',
          address: 'Test Adres No:1',
        },
        items: [
          { name: '360 Sonic Otomatik Dis Fircasi', quantity: 1, price: 899 },
        ],
        shipping: {
          status: 'created',
          barcode: syntheticBarcode,
          desi: 1,
          weight: 0.3,
        },
      },
      hepsijetPdfBuffer: hepsijetSample,
      customPrintSettings: {
        preset: '100x150_portrait',
        orientation: 'portrait',
      },
    })

    const inspection = await inspectThermalPdfBuffer(combinedBuffer)
    assert.strictEqual(inspection.pageCount, 1, 'Final PDF tam 1 sayfa olmalı')
    assert.deepStrictEqual(inspection.blankPages, [], 'Boş sayfa bulunmamalı')
    assert.strictEqual(inspection.isValidSingleThermalPage, true)
    assert.ok(Math.abs(inspection.pages[0].widthMm - 100) <= 0.5, 'Genişlik ~100mm olmalı')
    assert.ok(Math.abs(inspection.pages[0].heightMm - 150) <= 0.5, 'Yükseklik ~150mm olmalı')
    assert.ok(inspection.pages[0].contentStreamBytes > 500, 'İçerik akışı dolu olmalı')
  })

  it('Kaynak HepsiJET PDF ilk sayfası boş ve 2. sayfası doluysa boş olmayan sayfayı seçer', async () => {
    const multiDoc = await PDFDocument.create()
    multiDoc.addPage([283.46, 283.46]) // 0. sayfa: tamamen boş
    const realSample = await createSampleHepsiJetLabelPdf({
      barcode: 'TEST-GERCEK-KARGO-DEGILDIR-002',
    })
    const sampleDoc = await PDFDocument.load(realSample)
    const [copied] = await multiDoc.copyPages(sampleDoc, [0])
    multiDoc.addPage(copied) // 1. sayfa: dolu

    const selectedIdx = findFirstNonEmptyPageIndex(multiDoc)
    assert.strictEqual(selectedIdx, 1, 'Boş 0. sayfa atlanıp 1. dolu sayfa seçilmeli')
  })
})

// ─── 4. SUMATRAPDF CLI & HEDEF YAZICI ADI ───────────────────────────────────

describe('Windows SumatraPDF CLI ve Hedef Yazıcı Adı Koruması', () => {
  it('SumatraPDF argümanları her zaman açık hedef yazıcıyı (-print-to) ve -silent kullanır', () => {
    const args = buildSumatraPrintArgs('4BARCODE 4B-2054TG', 'C:\\Temp\\etiket.pdf', 'noscale')
    assert.deepStrictEqual(args, [
      '-print-to',
      '4BARCODE 4B-2054TG',
      '-silent',
      '-print-settings',
      'noscale',
      'C:\\Temp\\etiket.pdf',
    ])
    assert.strictEqual(args.includes('-print-to-default'), false)
  })

  it('Yazıcı adı boşsa buildSumatraPrintArgs hata fırlatır', () => {
    assert.throws(() => buildSumatraPrintArgs('   ', 'C:\\Temp\\etiket.pdf'))
  })

  it('WindowsPrinterDriver hedef yazıcı adını korur', () => {
    const driver = new WindowsPrinterDriver('4BARCODE 4B-2054TG')
    assert.strictEqual(driver.printerName, '4BARCODE 4B-2054TG')
  })
})

// ─── 5. AGENT MÜKERRER BASKI ENGELLEME VE ACK RETRY ─────────────────────────

describe('PrintAgentService — Yerel Defter Mükerrer Baskı Koruması ve FIFO', () => {
  it('Agent v2.0.0 sürümünü bildirir', () => {
    assert.strictEqual(PRINT_AGENT_VERSION, '2.0.0')
  })

  it('Aynı jobId yerel sent_jobs defterindeyse ikinci kez fiziksel basmaz, manual_review bildirir', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaliport-agent-test-'))
    const stateFile = path.join(tmpDir, 'sent_jobs.json')
    const jobId = 'job_label_ORD_DUP_01_KALIPORT999'

    // Önceden spooler'a gönderilmiş gibi yerel defter hazırla
    fs.writeFileSync(
      stateFile,
      JSON.stringify([
        {
          jobId,
          printerName: '4BARCODE 4B-2054TG',
          spoolerJobId: '42',
          submittedAt: '2026-11-21T09:00:00.000Z',
        },
      ]),
      'utf-8'
    )

    let driverPrintCalled = 0
    const fakeLiveDriver = {
      name: 'Mock Live Driver',
      isDryRun: false,
      async printPdf() {
        driverPrintCalled++
        return { success: true, status: 'printed' as const, printed: true, simulated: false }
      },
    }

    const ackCalls: any[] = []
    const originalFetch = global.fetch
    global.fetch = (async (url: string | URL, init?: RequestInit) => {
      const urlStr = String(url)
      if (urlStr.endsWith('/api/print-agent/jobs/poll')) {
        const mockJob: PrintJob = {
          jobId,
          orderId: 'ORD_DUP_01',
          barcode: 'KALIPORT999',
          type: 'shipping_label',
          status: 'processing',
          createdAt: '2026-11-21T09:00:00.000Z',
          updatedAt: '2026-11-21T09:05:00.000Z',
          attemptCount: 2,
          maxAttempts: 3,
          idempotencyKey: jobId,
          printerId: '4BARCODE 4B-2054TG',
        }
        return new Response(JSON.stringify({ success: true, job: mockJob }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (urlStr.includes('/ack')) {
        ackCalls.push(JSON.parse(String(init?.body || '{}')))
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('Not Found', { status: 404 })
    }) as any

    try {
      const agent = new PrintAgentService(
        {
          apiUrl: 'https://sonrakam.com',
          agentId: 'kaliport-win-01',
          agentToken: 'test-token-masked',
          printerName: '4BARCODE 4B-2054TG',
          dryRun: false,
          stateFilePath: stateFile,
        },
        fakeLiveDriver
      )

      const res = await agent.pollOnce()
      assert.strictEqual(driverPrintCalled, 0, 'Aynı job ikinci kez yazıcıya gönderilmemeli')
      assert.strictEqual(res.error, 'DUPLICATE_PRINT_PREVENTED')
      assert.strictEqual(ackCalls.length, 1)
      assert.strictEqual(ackCalls[0].status, 'manual_review')
      assert.strictEqual(ackCalls[0].errorCode, 'DUPLICATE_PRINT_PREVENTED_LOCAL_LEDGER')
      assert.strictEqual(ackCalls[0].spoolerJobId, '42')
    } finally {
      global.fetch = originalFetch
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('SimulatedPrinterDriver geçerli PDF verisini diske yazar ve printed=false döner', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaliport-sim-test-'))
    try {
      const driver = new SimulatedPrinterDriver(tmpDir)
      const pdfBuf = await createSampleHepsiJetLabelPdf({ barcode: 'TEST-SIM-01' })
      const res = await driver.printPdf(pdfBuf, {
        jobId: 'job_sim_test_1',
        orderId: null,
        type: 'shipping_label',
        status: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attemptCount: 1,
        maxAttempts: 3,
        idempotencyKey: 'job_sim_test_1',
      })
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.printed, false)
      assert.strictEqual(res.simulated, true)
      assert.ok(res.outputPath && fs.existsSync(res.outputPath))
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
