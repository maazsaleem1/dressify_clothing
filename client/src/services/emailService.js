import emailjs from '@emailjs/browser';

// EmailJS Configuration
const EMAILJS_CONFIG = {
  serviceId: 'service_nzioc7a',
  templateId: 'template_e7ha0k3',
  publicKey: 'hV25LzOUnqnnf2yMr'
};

// Initialize EmailJS
emailjs.init(EMAILJS_CONFIG.publicKey);

/**
 * Get status-based message for email
 */
const getStatusMessage = (status) => {
  switch (status) {
    case 'Delivered':
      return 'Thank you for placing order. Your order has been delivered. Happy shopping!';
    case 'Shipped':
      return 'Your order has been shipped! We will send you tracking information soon.';
    case 'Accepted':
      return 'Thank you for your order! We have accepted your order and will process it shortly.';
    case 'Pending':
      return 'Thank you for your order! We have received your order and will process it soon.';
    default:
      return 'We\'ll send you tracking information when the order ships.';
  }
};

/**
 * Format order data to match EmailJS template structure
 * The template uses Handlebars syntax with {{#orders}} loop
 */
const formatOrderForEmail = (order) => {
  // Format order items for template
  // EmailJS Handlebars templates can iterate over arrays directly
  const orders = (order.items || []).map(item => ({
    image_url: item.imageUrl || 'https://via.placeholder.com/64',
    name: item.productName || 'Product',
    units: item.quantity || 0,
    price: `Rs. ${(item.unitPrice || 0).toLocaleString()}` // Only Rs., no $ sign
  }));

  // Calculate costs
  // If order has shipping/tax fields, use them; otherwise default to 0
  const subtotal = order.totalAmount || 0;
  const shipping = order.shippingCost || 0;
  const tax = order.tax || 0;
  const total = subtotal + shipping + tax;

  // Get status-based message
  const statusMessage = getStatusMessage(order.status);

  // EmailJS template parameters
  // For nested objects like cost.shipping, EmailJS supports dot notation
  return {
    order_id: order.orderNumber || order.id || 'N/A',
    email: order.customer?.email || '',
    status_message: statusMessage, // Dynamic message based on order status
    orders: orders, // Array for {{#orders}} loop in template
    'cost.shipping': `Rs. ${shipping.toLocaleString()}`, // Only Rs., no $ sign
    'cost.tax': `Rs. ${tax.toLocaleString()}`, // Only Rs., no $ sign
    'cost.total': `Rs. ${total.toLocaleString()}` // Only Rs., no $ sign
  };
};

/**
 * Send order confirmation email
 * @param {Object} order - Order object from Firestore
 * @returns {Promise} EmailJS response
 */
export const sendOrderConfirmationEmail = async (order) => {
  try {
    // Format order data for template
    const templateParams = formatOrderForEmail(order);

    // Validate required fields
    if (!templateParams.email) {
      throw new Error('Customer email is required to send confirmation email');
    }

    if (!templateParams.orders || templateParams.orders.length === 0) {
      throw new Error('Order must have at least one item');
    }

    // Send email using EmailJS
    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams
    );

    return {
      success: true,
      message: 'Order confirmation email sent successfully',
      response
    };
  } catch (error) {
    throw {
      success: false,
      message: error.text || error.message || 'Failed to send email',
      error
    };
  }
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async () => {
  try {
    const testParams = {
      order_id: 'TEST-123',
      email: 'maazsaleem953@gmail.com',
      status_message: 'Thank you for placing order. Your order has been delivered. Happy shopping!',
      orders: [
        {
          image_url: 'https://via.placeholder.com/64',
          name: 'Test Product',
          units: 1,
          price: 'Rs. 1,000'
        }
      ],
      'cost.shipping': 'Rs. 0',
      'cost.tax': 'Rs. 0',
      'cost.total': 'Rs. 1,000'
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      testParams
    );

    return {
      success: true,
      message: 'Test email sent successfully',
      response
    };
  } catch (error) {
    throw {
      success: false,
      message: error.text || error.message || 'Failed to send test email',
      error
    };
  }
};

export default {
  sendOrderConfirmationEmail,
  testEmailConfiguration
};
