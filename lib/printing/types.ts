export type PrintJobType = 'shipping_label' | 'no_orders_notice'
export type PrintJobStatus = 'pending' | 'processing' | 'printed' | 'failed' | 'simulated'

export interface AckPrintJobBody {
  status: 'printed' | 'failed' | 'simulated'
  isDryRun?: boolean
  errorCode?: string
  errorMessage?: string
  simulatedOutputPath?: string
}

export interface PrintJobError {
  code: string
  message: string
  timestamp: string
}

export interface PrintJob {
  jobId: string
  orderId: string | null
  orderNumber?: string
  barcode?: string
  type: PrintJobType
  status: PrintJobStatus
  createdAt: string
  updatedAt: string
  attemptCount: number
  maxAttempts: number
  idempotencyKey: string
  printerId?: string
  lockedBy?: string
  lockedAt?: number
  leaseExpiresAt?: number
  lastError?: PrintJobError
  printedAt?: string
  simulatedAt?: string
  isDryRun?: boolean
  metadata?: {
    noticeDate?: string
    totalChecked?: number
    customerDeliveryNo?: string
    simulatedOutputPath?: string
  }
}

export interface PrintAgent {
  agentId: string
  name: string
  tokenHash: string
  salt: string
  status: 'active' | 'revoked'
  printerId: string
  createdAt: string
  lastSeenAt?: string
  description?: string
}

export interface PrintAgentAuthResult {
  isAuthorized: boolean
  agent?: PrintAgent
  error?: string
}
