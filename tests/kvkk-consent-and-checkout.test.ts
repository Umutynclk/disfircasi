import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  KVKK_DOCUMENT_TYPES,
  checkCompanyLegalCompleteness,
  buildDefaultKvkkDocuments,
  validateCheckoutLegalRequirements,
} from '../lib/kvkk/types'

const ROOT = path.resolve(__dirname, '..')
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), 'utf8')

test('checkCompanyLegalCompleteness detects complete vs incomplete company info', () => {
  const complete = checkCompanyLegalCompleteness({
    title: 'Kalıport Alüminyum Plastik Kalıp İmalat San. Tic. Ltd. Şti.',
    address: 'FEVZİÇAKMAK MAH. 10758. SK. C3 BLOK NO: 17 G KARATAY/KONYA',
    mersis: '0492061710000001',
    taxOffice: 'SELÇUK VERGİ DAİRESİ',
    taxNumber: '4920617100',
    phone: '+90 (850) 885 0 123',
    email: 'info@sonrakam.com',
  })
  assert.equal(complete.isComplete, true)
  assert.deepEqual(complete.missingFields, [])

  const incomplete = checkCompanyLegalCompleteness({
    title: 'Test Ltd.',
    address: '',
    mersis: '',
    taxOffice: 'Konya',
    taxNumber: '',
    phone: '',
    email: 'info@test.com',
  })
  assert.equal(incomplete.isComplete, false)
  assert.ok(incomplete.missingFields.length >= 3)
})

test('buildDefaultKvkkDocuments builds all 6 required legal documents with version 1', () => {
  const docs = buildDefaultKvkkDocuments({
    title: 'Kalıport Alüminyum Plastik Kalıp İmalat San. Tic. Ltd. Şti.',
    address: 'KARATAY/KONYA',
    mersis: '0492061710000001',
    taxOffice: 'SELÇUK',
    taxNumber: '4920617100',
    phone: '+90 (850) 885 0 123',
    email: 'info@sonrakam.com',
  })

  for (const docType of KVKK_DOCUMENT_TYPES) {
    assert.ok(docs[docType], `Missing document ${docType}`)
    assert.equal(docs[docType].docType, docType)
    assert.equal(docs[docType].version, 1)
    assert.ok(docs[docType].title.length > 3)
    assert.ok(docs[docType].draftContent.length > 30)
  }
})

test('validateCheckoutLegalRequirements enforces contract confirmation without forcing optional consents', () => {
  // Only Ön Bilgilendirme + Mesafeli Satış is mandatory
  const validWithoutOptionals = validateCheckoutLegalRequirements({
    contractConfirmed: true,
    explicitConsent: false,
    commercialConsent: false,
  })
  assert.equal(validWithoutOptionals.valid, true)

  const validWithOptionals = validateCheckoutLegalRequirements({
    contractConfirmed: true,
    explicitConsent: true,
    commercialConsent: true,
  })
  assert.equal(validWithOptionals.valid, true)

  const invalidWithoutContract = validateCheckoutLegalRequirements({
    contractConfirmed: false,
    explicitConsent: true,
    commercialConsent: true,
  })
  assert.equal(invalidWithoutContract.valid, false)
  assert.ok(invalidWithoutContract.error && invalidWithoutContract.error.length > 10)
})

test('Checkout page separates KVKK Aydınlatma, mandatory contracts, and optional consents', () => {
  const src = read('app/satin-al/page.tsx')
  assert.ok(!src.includes('!kvkkAccepted'), 'Checkout must NOT block submission on kvkkAccepted')
  assert.ok(src.includes('validateCheckoutLegalRequirements'), 'Checkout must validate legal requirements via helper')
  assert.ok(src.includes('explicitConsent'), 'Checkout must have separate explicitConsent state')
  assert.ok(src.includes('commercialEmailConsent'), 'Checkout must have separate commercialEmailConsent state')
  assert.ok(src.includes('commercialSmsConsent'), 'Checkout must have separate commercialSmsConsent state')
  assert.ok(src.includes('commercialPhoneConsent'), 'Checkout must have separate commercialPhoneConsent state')
  assert.ok(src.includes('Siparişi Onayla ve Ödemeye Geç'), 'Checkout must display clear primary CTA label')
  assert.ok(src.includes('/api/consents/record'), 'Checkout must record server-side consent/notice logs')
  assert.ok(src.includes('mobileSummaryOpen'), 'Checkout must provide collapsible mobile order summary')
})

test('Registration page shows KVKK Aydınlatma notice and separate optional consents', () => {
  const src = read('app/kayit/page.tsx')
  assert.ok(src.includes('/api/admin/kvkk/documents?public=true'), 'Signup must fetch published KVKK docs')
  assert.ok(src.includes('/api/consents/record'), 'Signup must log notice_shown and optional consents')
  assert.ok(src.includes('explicitConsent'), 'Signup must have optional explicitConsent')
  assert.ok(src.includes('commercialEmailConsent'), 'Signup must have optional commercialEmailConsent')
  assert.ok(src.includes('commercialSmsConsent'), 'Signup must have optional commercialSmsConsent')
  assert.ok(src.includes('commercialPhoneConsent'), 'Signup must have optional commercialPhoneConsent')
})

test('Admin settings wires KVKK management tab and Profile wires consent withdrawal card', () => {
  const adminSrc = read('app/admin/ayarlar/page.tsx')
  assert.ok(adminSrc.includes('kvkk_management'), 'Admin settings must include kvkk_management tab')
  assert.ok(adminSrc.includes('KvkkManagementPanel'), 'Admin settings must render KvkkManagementPanel')

  const profileSrc = read('app/profil/page.tsx')
  assert.ok(profileSrc.includes('KvkkConsentsCard'), 'Profile page must render KvkkConsentsCard for withdrawal')

  const apiSrc = read('app/api/admin/kvkk/documents/route.ts')
  assert.ok(apiSrc.includes('iysIntegrated: false'), 'KVKK API must transparently report İYS is not integrated')
  assert.ok(apiSrc.includes('kvkk_document_versions'), 'KVKK API must archive immutable document versions')
})
