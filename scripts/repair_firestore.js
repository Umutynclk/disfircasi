const fs = require('fs')
const path = require('path')

// .env.local dosyasını elle oku
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.substring(0, eqIdx).trim()
    let val = trimmed.substring(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = val
    }
  }
}

const admin = require('firebase-admin')

function initDb() {
  if (admin.apps.length === 0) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'disfircasi-e6962',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    })
  }
  return admin.firestore()
}

async function main() {
  const db = initDb()

  console.log('Repairing orders...\n')
  const ordersToCheck = [
    'GS26102974F34AE742425BB7',
    'GS261029D97CC262E430B2FE',
    'GS2610286E8540DAFF59BCBC',
    'GS26102890EF906322B156A0',
    'GS261028088BD6A65CA58EAE',
  ]

  for (const orderNum of ordersToCheck) {
    let docRef = db.collection('orders').doc(orderNum)
    let docSnap = await docRef.get()

    if (!docSnap.exists) {
      const q = await db.collection('orders').where('orderNumber', '==', orderNum).limit(1).get()
      if (!q.empty) {
        docRef = q.docs[0].ref
        docSnap = q.docs[0]
      }
    }

    if (!docSnap.exists) {
      console.log(`⚠️ Order ${orderNum} not found, skipping...`)
      continue
    }

    const data = docSnap.data()
    const strayFields = Object.keys(data).filter(k => k.startsWith('shipping.'))

    console.log(`Order ${orderNum} (id: ${docRef.id}):`)
    console.log(`  status: ${data.status}`)
    console.log(`  shipping.status: ${data.shipping?.status || 'N/A'}`)
    console.log(`  shipping.barcode: ${data.shipping?.barcode || 'N/A'}`)
    console.log(`  shipping.liveRequestMade: ${data.shipping?.liveRequestMade}`)
    if (strayFields.length > 0) {
      console.log(`  ⚠️ Stray dotted fields: ${strayFields.join(', ')}`)
    }

    // Step 1: Delete stray dotted fields first (separate call)
    if (strayFields.length > 0) {
      const deleteUpdates = {}
      for (const key of strayFields) {
        deleteUpdates[key] = admin.firestore.FieldValue.delete()
      }
      await docRef.update(deleteUpdates)
      console.log(`  → Deleted ${strayFields.length} stray dotted fields`)
    }

    // Step 2: Now update the shipping object
    if (orderNum === 'GS26102974F34AE742425BB7') {
      await docRef.update({
        shipping: {
          ...(data.shipping || {}),
          status: 'created',
          barcode: 'KALIPORTGS261029',
          customerDeliveryNo: 'KALIPORTGS261029',
          trackingNumber: 'KALIPORTGS261029',
          carrier: 'hepsijet',
          liveRequestMade: true,
          dispatchedAt: data.shipping?.dispatchedAt || new Date().toISOString(),
          trackingUrl: 'https://hepsijet.com/gonderi-takibi/KALIPORTGS261029',
          error: null,
          updatedAt: new Date().toISOString(),
        },
        status: 'shipped',
        updatedAt: new Date().toISOString(),
      })
      console.log('  ✅ Set to shipped with barcode=KALIPORTGS261029 (live HepsiJET)')
    } else if (data.shipping?.status === 'creating' || data.shipping?.status === 'unknown') {
      await docRef.update({
        shipping: {
          ...(data.shipping || {}),
          status: 'failed',
          error: 'Önceki gönderim isteği zaman aşımına uğradı veya hata aldı. Tekrar deneyebilirsiniz.',
          liveRequestMade: false,
          updatedAt: new Date().toISOString(),
        },
      })
      console.log('  ✅ Released lock, set to status=failed')
    } else if (data.shipping?.status === 'simulated') {
      // Clear simulated barcode that starts with HJKLP
      if (data.shipping?.barcode?.startsWith('HJKLP') || data.shipping?.barcode?.startsWith('HJTEST')) {
        await docRef.update({
          'shipping.barcode': '',
          'shipping.trackingNumber': '',
          'shipping.updatedAt': new Date().toISOString(),
        })
        console.log('  ✅ Cleared simulated barcode')
      } else {
        console.log('  → Simulated, no cleanup needed')
      }
    } else {
      console.log(`  → No action needed (shipping.status: ${data.shipping?.status || 'N/A'})`)
    }

    console.log('')
  }

  console.log('✅ All order repairs completed!')
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
