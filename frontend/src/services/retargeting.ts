import { resolveRuntimeBranding } from '../utils/runtime-branding';

type CurrencyCode = string;

export interface ProductEventItem {
  id: string | number;
  sku?: string;
  name?: string;
  category?: string;
  quantity?: number;
  price?: number;
  currency?: CurrencyCode;
}

export interface PurchaseEvent {
  transactionId: string;
  value: number;
  currency: CurrencyCode;
  items: ProductEventItem[];
}

interface BaseBusinessEvent {
  value?: number;
  currency?: CurrencyCode;
  user_type?: string;
  plan?: string;
  source?: string;
}

interface SignUpEvent extends BaseBusinessEvent {
  method?: string;
}

interface LoginEvent extends BaseBusinessEvent {
  method?: string;
}

interface RequestDemoEvent extends BaseBusinessEvent {
  request_type?: string;
}

interface CreateOrderEvent extends BaseBusinessEvent {
  order_id?: string;
  items_count?: number;
}

interface AddPaymentMethodEvent extends BaseBusinessEvent {
  payment_method?: string;
}

interface InviteUserEvent extends BaseBusinessEvent {
  invited_role?: string;
}

interface UpgradePlanEvent extends BaseBusinessEvent {
  from_plan?: string;
  to_plan?: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
    __retargetingInitDone?: boolean;
  }
}

const RETARGETING_ENABLED = String(import.meta.env.VITE_RETARGETING_ENABLED || 'false') === 'true';
const REQUIRE_CONSENT =
  String(import.meta.env.VITE_RETARGETING_REQUIRE_CONSENT || 'false') === 'true';
const CONSENT_KEY = String(import.meta.env.VITE_RETARGETING_CONSENT_KEY || 'cookie_consent_marketing');
const META_PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || '').trim();
const GA4_ID = String(import.meta.env.VITE_GA4_ID || '').trim();
const GOOGLE_ADS_ID = String(import.meta.env.VITE_GOOGLE_ADS_ID || '').trim();

const hasTrackingConsent = (): boolean => {
  if (!REQUIRE_CONSENT) {
    return true;
  }

  try {
    const value = String(localStorage.getItem(CONSENT_KEY) || '').toLowerCase();
    return value === 'true' || value === 'granted' || value === 'yes';
  } catch {
    return false;
  }
};

const shouldInitScripts = (): boolean => {
  if (!RETARGETING_ENABLED) {
    return false;
  }

  if (!hasTrackingConsent()) {
    return false;
  }

  return Boolean(META_PIXEL_ID || GA4_ID || GOOGLE_ADS_ID);
};

const shouldTrackRuntime = (path?: string, hostname?: string): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeBranding = resolveRuntimeBranding({
    hostname: hostname || window.location.hostname,
    pathname: path || window.location.pathname,
  });

  return runtimeBranding.identity === 'b2b';
};

const canTrack = (): boolean => shouldInitScripts() && Boolean(window.gtag || window.fbq);

const appendScript = (src: string): void => {
  if (document.querySelector(`script[src="${src}"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

const applyGtagConsent = (granted: boolean): void => {
  if (!window.gtag) {
    return;
  }

  window.gtag('consent', 'update', {
    ad_storage: granted ? 'granted' : 'denied',
    analytics_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
  });
};

const initGtag = (): void => {
  if (!GA4_ID && !GOOGLE_ADS_ID) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: any[]) {
      window.dataLayer?.push(args);
    };

  appendScript(
    'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID || GOOGLE_ADS_ID),
  );

  window.gtag('js', new Date());

  if (REQUIRE_CONSENT) {
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    applyGtagConsent(hasTrackingConsent());
  }

  if (GA4_ID) {
    window.gtag('config', GA4_ID, { anonymize_ip: true });
  }
  if (GOOGLE_ADS_ID) {
    window.gtag('config', GOOGLE_ADS_ID, { anonymize_ip: true });
  }
};

const initMetaPixel = (): void => {
  if (!META_PIXEL_ID) {
    return;
  }

  if (!window.fbq) {
    const fbq = function fbq(...args: any[]) {
      (fbq as any).callMethod ? (fbq as any).callMethod(...args) : (fbq as any).queue.push(args);
    } as any;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';

    window.fbq = fbq;
    window._fbq = fbq;

    appendScript('https://connect.facebook.net/en_US/fbevents.js');
  }

  window.fbq?.('init', META_PIXEL_ID);
};

const createEventId = (eventName: string): string => {
  const eventSuffix = Math.random().toString(36).slice(2, 10);
  return `${eventName}_${Date.now()}_${eventSuffix}`;
};

const cleanPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
};

const emitBusinessEvent = (
  eventName: string,
  payload: Record<string, unknown>,
  options?: {
    metaStandardEvent?: string;
    metaStandardPayload?: Record<string, unknown>;
  },
): void => {
  if (!canTrack()) {
    return;
  }

  const eventId = createEventId(eventName);
  const normalizedPayload = cleanPayload(payload);

  if (window.gtag) {
    window.gtag('event', eventName, normalizedPayload);
  }

  if (window.fbq) {
    window.fbq('trackCustom', eventName, normalizedPayload, { eventID: eventId });

    if (options?.metaStandardEvent) {
      window.fbq('track', options.metaStandardEvent, options.metaStandardPayload || normalizedPayload, {
        eventID: eventId,
      });
    }
  }
};

export const getRetargetingConsentState = (): 'granted' | 'denied' | 'not_required' => {
  if (!REQUIRE_CONSENT) {
    return 'not_required';
  }

  try {
    const value = String(localStorage.getItem(CONSENT_KEY) || '').toLowerCase();
    if (value === 'true' || value === 'granted' || value === 'yes') {
      return 'granted';
    }
    if (value === 'false' || value === 'denied' || value === 'no') {
      return 'denied';
    }
  } catch {
    return 'denied';
  }

  return 'denied';
};

export const setRetargetingConsent = (granted: boolean): void => {
  if (!REQUIRE_CONSENT) {
    return;
  }

  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    // ignore storage errors
  }

  applyGtagConsent(granted);

  if (granted) {
    initRetargeting();
  }
};

export const initRetargeting = (path?: string, hostname?: string): void => {
  if (!shouldTrackRuntime(path, hostname)) {
    return;
  }

  if (!shouldInitScripts()) {
    return;
  }

  if (window.__retargetingInitDone) {
    return;
  }

  initGtag();
  initMetaPixel();
  window.__retargetingInitDone = true;
};

export const trackPageView = (path: string, hostname?: string): void => {
  if (!shouldTrackRuntime(path, hostname)) {
    return;
  }

  if (!shouldInitScripts()) {
    return;
  }

  initRetargeting(path, hostname);

  if (!canTrack()) {
    return;
  }

  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
    });
  }

  if (window.fbq) {
    window.fbq('track', 'PageView');
  }
};

export const trackSignUp = (event: SignUpEvent = {}): void => {
  emitBusinessEvent(
    'sign_up',
    {
      method: event.method || 'email',
      user_type: event.user_type || 'b2b',
      source: event.source || 'web',
      plan: event.plan,
      value: event.value,
      currency: event.currency || 'RON',
    },
    {
      metaStandardEvent: 'CompleteRegistration',
    },
  );
};

export const trackLogin = (event: LoginEvent = {}): void => {
  emitBusinessEvent('login', {
    method: event.method || 'email',
    user_type: event.user_type || 'user',
    source: event.source || 'web',
  });
};

export const trackRequestDemo = (event: RequestDemoEvent = {}): void => {
  emitBusinessEvent(
    'request_demo',
    {
      request_type: event.request_type || 'quote_request',
      source: event.source || 'web',
      user_type: event.user_type || 'lead',
      value: event.value,
      currency: event.currency || 'RON',
    },
    {
      metaStandardEvent: 'Lead',
    },
  );
};

export const trackCreateOrder = (event: CreateOrderEvent = {}): void => {
  emitBusinessEvent('create_order', {
    order_id: event.order_id,
    source: event.source || 'web',
    user_type: event.user_type || 'customer',
    items_count: event.items_count,
    value: event.value,
    currency: event.currency || 'RON',
    plan: event.plan,
  });
};

export const trackAddPaymentMethod = (event: AddPaymentMethodEvent = {}): void => {
  emitBusinessEvent(
    'add_payment_method',
    {
      payment_method: event.payment_method || 'unknown',
      source: event.source || 'web',
      user_type: event.user_type || 'customer',
      value: event.value,
      currency: event.currency || 'RON',
      plan: event.plan,
    },
    {
      metaStandardEvent: 'AddPaymentInfo',
      metaStandardPayload: cleanPayload({
        currency: event.currency || 'RON',
        value: event.value,
        payment_method: event.payment_method || 'unknown',
      }),
    },
  );
};

export const trackInviteUser = (event: InviteUserEvent = {}): void => {
  emitBusinessEvent('invite_user', {
    invited_role: event.invited_role,
    source: event.source || 'settings',
    user_type: event.user_type || 'admin',
    plan: event.plan,
  });
};

export const trackUpgradePlan = (event: UpgradePlanEvent = {}): void => {
  emitBusinessEvent(
    'upgrade_plan',
    {
      from_plan: event.from_plan,
      to_plan: event.to_plan,
      source: event.source || 'portal',
      user_type: event.user_type || 'customer',
      value: event.value,
      currency: event.currency || 'RON',
    },
    {
      metaStandardEvent: 'Subscribe',
    },
  );
};

export const trackViewItem = (item: ProductEventItem): void => {
  if (!shouldInitScripts()) {
    return;
  }

  initRetargeting();

  if (!canTrack()) {
    return;
  }

  const eventCurrency = item.currency || 'RON';
  const value = Number(item.price || 0);
  const contentId = String(item.sku || item.id);

  if (window.gtag) {
    window.gtag('event', 'view_item', {
      currency: eventCurrency,
      value,
      items: [
        {
          item_id: contentId,
          item_name: item.name,
          item_category: item.category,
          price: value,
          quantity: Number(item.quantity || 1),
        },
      ],
    });
  }

  if (window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_ids: [contentId],
      content_name: item.name,
      content_type: 'product',
      value,
      currency: eventCurrency,
    });
  }
};

export const trackAddToCart = (item: ProductEventItem): void => {
  if (!shouldInitScripts()) {
    return;
  }

  initRetargeting();

  if (!canTrack()) {
    return;
  }

  const eventCurrency = item.currency || 'RON';
  const quantity = Number(item.quantity || 1);
  const price = Number(item.price || 0);
  const value = price * quantity;
  const contentId = String(item.sku || item.id);

  if (window.gtag) {
    window.gtag('event', 'add_to_cart', {
      currency: eventCurrency,
      value,
      items: [
        {
          item_id: contentId,
          item_name: item.name,
          item_category: item.category,
          price,
          quantity,
        },
      ],
    });
  }

  if (window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_ids: [contentId],
      content_name: item.name,
      content_type: 'product',
      value,
      currency: eventCurrency,
    });
  }
};

export const trackBeginCheckout = (items: ProductEventItem[], value: number, currency = 'RON'): void => {
  if (!shouldInitScripts()) {
    return;
  }

  initRetargeting();

  if (!canTrack()) {
    return;
  }

  if (window.gtag) {
    window.gtag('event', 'begin_checkout', {
      currency,
      value,
      items: items.map((item) => ({
        item_id: String(item.sku || item.id),
        item_name: item.name,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
      })),
    });
  }

  if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_ids: items.map((item) => String(item.sku || item.id)),
      content_type: 'product',
      value,
      currency,
      num_items: items.length,
    });
  }
};

export const trackPurchase = (purchase: PurchaseEvent): void => {
  if (!shouldInitScripts()) {
    return;
  }

  initRetargeting();

  if (!canTrack()) {
    return;
  }

  const dedupeKey = `retargeting:purchase:${purchase.transactionId}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) {
      return;
    }
    sessionStorage.setItem(dedupeKey, '1');
  } catch {
    // no-op
  }

  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: purchase.transactionId,
      currency: purchase.currency,
      value: Number(purchase.value || 0),
      items: purchase.items.map((item) => ({
        item_id: String(item.sku || item.id),
        item_name: item.name,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
      })),
    });
  }

  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      content_ids: purchase.items.map((item) => String(item.sku || item.id)),
      content_type: 'product',
      value: Number(purchase.value || 0),
      currency: purchase.currency,
    });
  }
};
