import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { getAuth, Auth } from 'firebase-admin/auth'

let adminApp: App | undefined
let adminDb: Firestore | undefined
let adminAuth: Auth | undefined

function getOrInitAdminApp(): App {
  if (adminApp) {
    return adminApp
  }

  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'disfircasi-f8e72'

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined

    if (clientEmail && privateKey) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      })
    } else {
      // Fallback: Initialize with projectId (works in GCP/Firebase App Hosting/Cloud Run environments)
      adminApp = initializeApp({
        projectId,
      })
    }
  } else {
    adminApp = getApps()[0]
  }

  return adminApp
}

export function getAdminFirestore(): Firestore {
  if (adminDb) {
    return adminDb
  }
  const app = getOrInitAdminApp()
  adminDb = getFirestore(app)
  return adminDb
}

export function getAdminAuth(): Auth {
  if (adminAuth) {
    return adminAuth
  }
  const app = getOrInitAdminApp()
  adminAuth = getAuth(app)
  return adminAuth
}

