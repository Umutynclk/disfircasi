import { logEvent, EventParams } from 'firebase/analytics';
import { getFirebaseAnalytics } from '@/firebase/config';

// Analytics event loglama için helper fonksiyon
export const logAnalyticsEvent = async (
  eventName: string,
  eventParams?: EventParams
) => {
  try {
    const analytics = await getFirebaseAnalytics();
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
    }
  } catch (error) {
    console.warn('Analytics event loglanamadı:', error);
  }
};

// Yaygın kullanılan event'ler için helper fonksiyonlar
export const analytics = {
  // Ürün görüntüleme
  viewProduct: async (productId: string, productName: string, price: number) => {
    await logAnalyticsEvent('view_item', {
      currency: 'TRY',
      value: price,
      items: [
        {
          item_id: productId,
          item_name: productName,
          price: price,
        },
      ],
    });
  },

  // Sepete ekleme
  addToCart: async (productId: string, productName: string, price: number) => {
    await logAnalyticsEvent('add_to_cart', {
      currency: 'TRY',
      value: price,
      items: [
        {
          item_id: productId,
          item_name: productName,
          price: price,
        },
      ],
    });
  },

  // Sayfa görüntüleme
  pageView: async (pagePath: string, pageTitle?: string) => {
    await logAnalyticsEvent('page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
  },

  // İletişim formu gönderimi
  contactFormSubmit: async () => {
    await logAnalyticsEvent('contact_form_submit');
  },

  // Ürün arama
  search: async (searchTerm: string) => {
    await logAnalyticsEvent('search', {
      search_term: searchTerm,
    });
  },
};



