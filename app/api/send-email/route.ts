import { NextRequest, NextResponse } from 'next/server'

// Basit bir API route - E-posta gönderme işlevselliği için
// Production'da gerçek bir e-posta servisi (SendGrid, Mailgun, Resend, vb.) kullanılmalı
// Şimdilik sadece başarılı yanıt döndürüyoruz
// Mesajlar zaten ContactModal'da Firestore'a kaydediliyor

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, subject, message } = body

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Gerekli alanlar eksik' },
        { status: 400 }
      )
    }

    // TODO: Burada gerçek e-posta gönderme servisi entegre edilecek
    // Örnek Resend kullanımı:
    // 1. npm install resend
    // 2. const resend = new Resend(process.env.RESEND_API_KEY)
    // 3. await resend.emails.send({
    //     from: 'noreply@yourdomain.com',
    //     to: notificationEmail, // Admin panelinden alınacak
    //     subject: subject || 'Yeni İletişim Formu Mesajı',
    //     text: emailContent
    //   })
    
    // Şimdilik sadece başarılı yanıt döndürüyoruz
    // Mesajlar zaten ContactModal'da Firestore'a kaydediliyor
    // Admin panelinden 'contacts' koleksiyonunda görüntülenebilir

    return NextResponse.json(
      { 
        success: true,
        message: 'Mesajınız başarıyla gönderildi. En kısa sürede size dönüş yapacağız.' 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('E-posta gönderme hatası:', error)
    return NextResponse.json(
      { error: 'E-posta gönderilirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
