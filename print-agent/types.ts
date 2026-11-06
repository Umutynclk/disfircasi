/**
 * KALIPORT PALMX TXP 400 Print Agent Tip Tanımları
 * Bu dosya bağımsızdır; Windows ortamına taşındığında harici modül bağımlılığı gerektirmez.
 */

export type PrintJobType = 'shipping_label' | 'no_orders_notice'
export type PrintJobStatus = 'pending' | 'processing' | 'printed' | 'failed' | 'simulated'

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
    [key: string]: any
  }
}

export interface PrintAgentConfig {
  apiUrl: string
  agentId: string
  agentToken: string
  printerName: string
  pollIntervalMs: number
  errorBackoffMs: number
  maxBackoffMs: number
  dryRun: boolean
  outputDir: string
}

export interface PrinterResult {
  success: boolean
  status: 'printed' | 'simulated' | 'failed'
  printed: boolean
  simulated: boolean
  outputPath?: string
  error?: string
  errorCode?: string
}

export interface PrinterDriver {
  name: string
  isDryRun: boolean
  printPdf(pdfBuffer: Buffer, job: PrintJob): Promise<PrinterResult>
}
