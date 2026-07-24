import emailjs from '@emailjs/browser';

const EMAILJS_CONFIG = {
  serviceId: 'service_nzioc7a',
  templateId: 'template_e7ha0k3', // Dressify Order Confirmation (flat cost_* vars)
  publicKey: 'hV25LzOUnqnnf2yMr',
};

/** Storefront default shipping (PKR) when order has no shipping field */
export const DEFAULT_SHIPPING_PKR = 249;

emailjs.init(EMAILJS_CONFIG.publicKey);

const formatPrice = (price) => {
  const num = parseFloat(price) || 0;
  return `Rs. ${num.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
};

const toDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
  if (val?.seconds != null) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const getStatusMessage = (status) => {
  switch (status) {
    case 'Delivered':
      return 'Thank you for your order. Your order has been delivered. Happy shopping!';
    case 'Shipped':
      return 'Your order has been shipped! Tracking details are included below when available.';
    case 'Accepted':
      return "We've accepted your order and will process it shortly.";
    case 'Pending':
      return "We've received your order and will process it soon.";
    default:
      return "We'll send you tracking information when the order ships.";
  }
};

/**
 * Resolve money breakdown for email + Orders UI.
 * Website usually writes: shipping, tax, subtotal, totalAmount
 * Older orders may use shippingCost.
 */
export const getOrderCostBreakdown = (order = {}) => {
  const items = order.items || [];
  const itemsSubtotal = items.reduce(
    (sum, i) =>
      sum +
      (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity, 10) || 0),
    0
  );

  const hasShippingField =
    order.shipping !== undefined &&
    order.shipping !== null &&
    order.shipping !== '';
  const hasShippingCostField =
    order.shippingCost !== undefined &&
    order.shippingCost !== null &&
    order.shippingCost !== '';

  let shipping;
  if (hasShippingField) {
    shipping = parseFloat(order.shipping) || 0;
  } else if (hasShippingCostField) {
    shipping = parseFloat(order.shippingCost) || 0;
  } else {
    shipping = DEFAULT_SHIPPING_PKR;
  }

  const tax = parseFloat(order.tax ?? 0) || 0;
  const subtotal = parseFloat(order.subtotal) || itemsSubtotal;
  const total =
    parseFloat(order.totalAmount) || subtotal + shipping + tax;

  return {
    subtotal: Math.round(subtotal),
    shipping: Math.round(shipping),
    tax: Math.round(tax),
    total: Math.round(total),
    shippingSource: hasShippingField
      ? 'shipping'
      : hasShippingCostField
        ? 'shippingCost'
        : 'default',
  };
};

/**
 * Format Firestore order → EmailJS template_e7ha0k3 params.
 * Flat keys only for money: cost_shipping, cost_tax, cost_total
 */
const formatOrderForEmail = (order) => {
  const orders = (order.items || []).map((item) => {
    const qty = parseInt(item.quantity || 0, 10) || 0;
    const unit = parseFloat(item.unitPrice || 0) || 0;
    const size = item.size && item.size !== 'One Size' ? item.size : '';
    return {
      image_url: item.imageUrl || 'https://via.placeholder.com/64',
      name: item.productName || 'Product',
      units: qty,
      size,
      size_label: size ? ` · Size: ${size}` : '',
      price: formatPrice(unit * (qty || 1)),
    };
  });

  const { shipping, tax, total } = getOrderCostBreakdown(order);

  const customer = order.customer || {};
  const shippingAddress =
    order.shippingAddress ||
    [
      order.shippingDetails?.fullAddress,
      order.shippingDetails?.city,
      order.shippingDetails?.state,
      order.shippingDetails?.postalCode,
      order.shippingDetails?.country,
    ]
      .filter(Boolean)
      .join(', ') ||
    '';

  const orderDateObj = toDate(order.orderDate) || new Date();

  return {
    order_id: order.orderNumber || order.id || 'N/A',
    email: customer.email || '',
    customer_name: customer.name || 'Customer',
    customer_phone: customer.phone || '',
    shipping_address: shippingAddress || '—',
    payment_method: order.paymentMethod || 'Cash on Delivery',
    order_date: orderDateObj.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    status_message: getStatusMessage(order.status),
    website_link: 'https://dressifyclothing-77a5e.web.app',
    orders,
    cost_shipping: formatPrice(shipping),
    cost_tax: formatPrice(tax),
    cost_total: formatPrice(total),
  };
};

export const sendOrderConfirmationEmail = async (order) => {
  try {
    const templateParams = formatOrderForEmail(order);

    if (!templateParams.email) {
      throw new Error('Customer email is required to send confirmation email');
    }
    if (!templateParams.orders?.length) {
      throw new Error('Order must have at least one item');
    }

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams
    );

    return {
      success: true,
      message: 'Order confirmation email sent successfully',
      response,
    };
  } catch (error) {
    throw {
      success: false,
      message: error.text || error.message || 'Failed to send email',
      error,
    };
  }
};

export const testEmailConfiguration = async () => {
  try {
    const testParams = {
      order_id: 'TEST-123',
      email: 'maazsaleem953@gmail.com',
      customer_name: 'Test Customer',
      customer_phone: '+92 300 0000000',
      shipping_address: 'Test Street, Lahore, Punjab, Pakistan',
      payment_method: 'Cash on Delivery',
      order_date: new Date().toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      status_message: 'This is a test confirmation email.',
      website_link: 'https://dressifyclothing-77a5e.web.app',
      orders: [
        {
          image_url: 'https://via.placeholder.com/64',
          name: 'Test Product',
          units: 1,
          size_label: ' · Size: M',
          price: 'Rs. 1,000',
        },
      ],
      cost_shipping: `Rs. ${DEFAULT_SHIPPING_PKR.toLocaleString('en-PK')}`,
      cost_tax: 'Rs. 0',
      cost_total: `Rs. ${(1000 + DEFAULT_SHIPPING_PKR).toLocaleString('en-PK')}`,
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      testParams
    );

    return {
      success: true,
      message: 'Test email sent successfully',
      response,
    };
  } catch (error) {
    throw {
      success: false,
      message: error.text || error.message || 'Failed to send test email',
      error,
    };
  }
};

export default {
  sendOrderConfirmationEmail,
  testEmailConfiguration,
  getOrderCostBreakdown,
  DEFAULT_SHIPPING_PKR,
};
