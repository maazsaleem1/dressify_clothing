# 📧 EmailJS Integration Guide

## Overview

Your admin panel now includes EmailJS integration to send order confirmation emails directly from the Orders page. This allows you to manually send confirmation emails to customers when needed.

---

## ✅ What's Been Added

1. **EmailJS Service** (`client/src/services/emailService.js`)
   - Configured with your EmailJS credentials
   - Formats order data to match your email template
   - Handles email sending with error handling

2. **Send Email Button** in Orders Page
   - Email icon button in orders table (next to View/Edit buttons)
   - "Send Confirmation Email" button in order details modal
   - Only shows when customer email is available

---

## 🔧 Configuration

Your EmailJS credentials are configured in `client/src/services/emailService.js`:

```javascript
const EMAILJS_CONFIG = {
  serviceId: 'service_nzioc7a',
  templateId: 'template_e7ha0k3',
  publicKey: 'hV25LzOUnqnnf2yMr'
};
```

**Note:** These credentials are stored in the code. For production, consider using environment variables.

---

## 📋 Email Template Structure

Your EmailJS template expects these variables:

- `order_id` - Order number
- `email` - Customer email address
- `orders` - Array of order items with:
  - `image_url` - Product image URL
  - `name` - Product name
  - `units` - Quantity
  - `price` - Formatted price (e.g., "Rs. 3,690")
- `cost.shipping` - Shipping cost
- `cost.tax` - Tax amount
- `cost.total` - Total order amount

---

## 🎯 How to Use

### From Orders Table

1. Navigate to **Orders** page
2. Find the order you want to send email for
3. Click the **📧 Mail icon** button (purple icon)
4. Confirm the action
5. Email will be sent to the customer's email address

### From Order Details Modal

1. Click **👁️ View** icon on any order
2. Scroll to the bottom of the modal
3. Click **"Send Confirmation Email"** button
4. Confirm the action
5. Email will be sent

---

## 🔍 How It Works

1. **Data Formatting**: Order data from Firestore is formatted to match your EmailJS template structure
2. **Validation**: Checks if customer email exists before sending
3. **Email Sending**: Uses EmailJS API to send email via Gmail service
4. **Error Handling**: Shows success/error messages to admin

---

## 📊 Order Data Mapping

The system automatically maps your order data:

| Order Field | Email Template Variable | Example |
|------------|------------------------|---------|
| `orderNumber` | `order_id` | "ORD-1234567890" |
| `customer.email` | `email` | "customer@example.com" |
| `items[].imageUrl` | `orders[].image_url` | "https://..." |
| `items[].productName` | `orders[].name` | "Dusty Teal T-Shirt" |
| `items[].quantity` | `orders[].units` | 2 |
| `items[].unitPrice` | `orders[].price` | "Rs. 3,690" |
| `shippingCost` | `cost.shipping` | "Rs. 500" |
| `tax` | `cost.tax` | "Rs. 0" |
| `totalAmount` | `cost.total` | "Rs. 7,880" |

---

## ⚙️ Cost Calculation

Currently, the email service calculates costs as:

- **Subtotal**: `order.totalAmount`
- **Shipping**: `order.shippingCost` (defaults to 0 if not set)
- **Tax**: `order.tax` (defaults to 0 if not set)
- **Total**: Subtotal + Shipping + Tax

**To add shipping/tax to orders:**

Update your order creation code to include:

```javascript
const orderData = {
  // ... other fields
  totalAmount: 7380,
  shippingCost: 500,  // Add this
  tax: 0,             // Add this
  // ...
};
```

---

## 🐛 Troubleshooting

### Email Not Sending

1. **Check Customer Email**: Ensure order has `customer.email` field
2. **Check EmailJS Quota**: Verify your EmailJS account has available emails
3. **Check Browser Console**: Look for error messages
4. **Verify Template**: Ensure EmailJS template ID matches

### Template Variables Not Working

If template variables aren't rendering:

1. Check EmailJS template syntax
2. Verify variable names match exactly (case-sensitive)
3. For nested objects, use dot notation: `{{cost.shipping}}`
4. For arrays, use Handlebars `{{#each}}` or `{{#orders}}`

### Common Errors

- **"Customer email is required"**: Order doesn't have customer email
- **"Failed to send email"**: Check EmailJS service status or quota
- **Template errors**: Verify template syntax in EmailJS dashboard

---

## 🔒 Security Notes

1. **Public Key**: The public key is safe to expose in client-side code
2. **Private Key**: Never expose your private key
3. **Rate Limiting**: EmailJS has rate limits based on your plan
4. **Email Validation**: Always validate customer email before sending

---

## 🚀 Future Enhancements

Potential improvements:

1. **Auto-send on status change**: Automatically send email when order status changes
2. **Email templates**: Different templates for different order statuses
3. **Email history**: Track which emails were sent and when
4. **Bulk email**: Send emails to multiple orders at once
5. **Email preview**: Preview email before sending

---

## 📝 Code Example

To send email programmatically:

```javascript
import { sendOrderConfirmationEmail } from '../services/emailService';

// Get order from Firestore
const order = await getOrder(orderId);

// Send email
try {
  const result = await sendOrderConfirmationEmail(order);
  console.log('Email sent:', result.message);
} catch (error) {
  console.error('Error:', error.message);
}
```

---

## ✅ Testing

To test the email configuration:

```javascript
import { testEmailConfiguration } from '../services/emailService';

try {
  const result = await testEmailConfiguration();
  console.log('Test email sent successfully!');
} catch (error) {
  console.error('Test failed:', error.message);
}
```

---

## 🎯 Summary

- **Location**: Orders page → Mail icon or Order Details modal
- **Requirement**: Order must have customer email
- **Service**: EmailJS with Gmail
- **Template**: Uses your existing EmailJS template
- **Format**: Automatically formats order data for template

Your order confirmation emails are now fully integrated! 📧✨
