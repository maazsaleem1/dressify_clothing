const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure email transporter
// You'll need to set up email credentials in Firebase Functions config
const transporter = nodemailer.createTransport({
  service: 'gmail', // or use your email service (SMTP)
  auth: {
    user: functions.config().email?.user || process.env.EMAIL_USER,
    pass: functions.config().email?.password || process.env.EMAIL_PASSWORD,
  },
});

// Alternative: Use SMTP (more flexible)
// const transporter = nodemailer.createTransport({
//   host: 'smtp.gmail.com',
//   port: 587,
//   secure: false,
//   auth: {
//     user: functions.config().email?.user,
//     pass: functions.config().email?.password,
//   },
// });

/**
 * Cloud Function: Send email notification when a new order is created
 * Triggered automatically when a document is created in 'orders' collection
 */
exports.sendOrderNotification = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    try {
      const order = snap.data();
      const orderId = context.params.orderId;

      // Admin email (where notifications will be sent)
      const adminEmail = functions.config().email?.admin || process.env.ADMIN_EMAIL || 'admin@dressifyclothing.com';

      // Prepare email content
      const mailOptions = {
        from: `Dressify Clothing <${functions.config().email?.user || 'noreply@dressifyclothing.com'}>`,
        to: adminEmail,
        subject: `New Order Received - ${order.orderNumber || orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
              .customer-info { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
              .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
              .items-table th, .items-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              .items-table th { background: #f5f5f5; font-weight: bold; }
              .total { font-size: 18px; font-weight: bold; color: #667eea; margin-top: 15px; }
              .button { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 New Order Received!</h1>
                <p>Order #${order.orderNumber || orderId}</p>
              </div>
              <div class="content">
                <div class="order-info">
                  <h2>Order Details</h2>
                  <p><strong>Order Number:</strong> ${order.orderNumber || orderId}</p>
                  <p><strong>Order Date:</strong> ${order.orderDate?.toDate ? order.orderDate.toDate().toLocaleString() : new Date().toLocaleString()}</p>
                  <p><strong>Status:</strong> <span style="background: #ffc107; color: #000; padding: 3px 8px; border-radius: 3px;">${order.status || 'Pending'}</span></p>
                  <p><strong>Payment Method:</strong> ${order.paymentMethod || 'N/A'}</p>
                  <p><strong>Payment Status:</strong> ${order.paymentStatus || 'Pending'}</p>
                </div>

                <div class="customer-info">
                  <h2>Customer Information</h2>
                  <p><strong>Name:</strong> ${order.customer?.name || order.customerId || 'N/A'}</p>
                  <p><strong>Email:</strong> ${order.customer?.email || 'N/A'}</p>
                  <p><strong>Phone:</strong> ${order.customer?.phone || 'N/A'}</p>
                  ${order.shippingAddress ? `<p><strong>Shipping Address:</strong><br>${order.shippingAddress}</p>` : ''}
                </div>

                <h2>Order Items</h2>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Size</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(order.items || []).map(item => `
                      <tr>
                        <td>${item.productName || 'N/A'}</td>
                        <td>${item.size || 'N/A'}</td>
                        <td>${item.quantity || 0}</td>
                        <td>Rs. ${(item.unitPrice || 0).toLocaleString()}</td>
                        <td>Rs. ${((item.unitPrice || 0) * (item.quantity || 0)).toLocaleString()}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <div class="total">
                  <p>Total Amount: <strong>Rs. ${(order.totalAmount || 0).toLocaleString()}</strong></p>
                </div>

                ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}

                <p style="margin-top: 20px;">
                  <a href="https://your-dashboard-url.com/orders" class="button">View Order in Dashboard</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
New Order Received!

Order Number: ${order.orderNumber || orderId}
Order Date: ${order.orderDate?.toDate ? order.orderDate.toDate().toLocaleString() : new Date().toLocaleString()}
Status: ${order.status || 'Pending'}

Customer Information:
Name: ${order.customer?.name || 'N/A'}
Email: ${order.customer?.email || 'N/A'}
Phone: ${order.customer?.phone || 'N/A'}

Order Items:
${(order.items || []).map(item =>
          `- ${item.productName} (Size: ${item.size || 'N/A'}) x${item.quantity || 0} = Rs. ${((item.unitPrice || 0) * (item.quantity || 0)).toLocaleString()}`
        ).join('\n')}

Total Amount: Rs. ${(order.totalAmount || 0).toLocaleString()}

View order in dashboard: https://your-dashboard-url.com/orders
        `
      };

      // Send email
      await transporter.sendMail(mailOptions);
      console.log(`Order notification email sent for order ${orderId}`);

      return null;
    } catch (error) {
      console.error('Error sending order notification email:', error);
      // Don't throw error to prevent function retry loops
      return null;
    }
  });

/**
 * Optional: Send email to customer when order status changes
 */
exports.sendOrderStatusUpdate = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();
      const orderId = context.params.orderId;

      // Only send email if status changed
      if (before.status === after.status) {
        return null;
      }

      const customerEmail = after.customer?.email;
      if (!customerEmail) {
        console.log('No customer email found, skipping status update email');
        return null;
      }

      const mailOptions = {
        from: `Dressify Clothing <${functions.config().email?.user || 'noreply@dressifyclothing.com'}>`,
        to: customerEmail,
        subject: `Order ${after.orderNumber || orderId} - Status Updated`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .status-badge { display: inline-block; padding: 8px 16px; border-radius: 5px; font-weight: bold; }
              .status-pending { background: #ffc107; color: #000; }
              .status-accepted { background: #2196F3; color: white; }
              .status-shipped { background: #9c27b0; color: white; }
              .status-delivered { background: #4caf50; color: white; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Order Status Update</h1>
                <p>Order #${after.orderNumber || orderId}</p>
              </div>
              <div class="content">
                <p>Dear ${after.customer?.name || 'Customer'},</p>
                <p>Your order status has been updated:</p>
                <p>
                  <span class="status-badge status-${after.status?.toLowerCase() || 'pending'}">
                    ${after.status || 'Pending'}
                  </span>
                </p>
                ${after.status === 'Shipped' && after.trackingNumber ?
            `<p><strong>Tracking Number:</strong> ${after.trackingNumber}</p>` : ''}
                <p>Thank you for shopping with Dressify Clothing!</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Order status update email sent to ${customerEmail} for order ${orderId}`);

      return null;
    } catch (error) {
      console.error('Error sending status update email:', error);
      return null;
    }
  });
