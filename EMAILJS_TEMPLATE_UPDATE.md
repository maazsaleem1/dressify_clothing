# 📧 EmailJS Template Update Guide

## What You Need to Update in Your EmailJS Template

Your email service now sends a dynamic `status_message` variable that changes based on order status. You need to update your EmailJS template to use this variable.

---

## 🔧 Update Your EmailJS Template

### Step 1: Go to EmailJS Dashboard

1. Log in to [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Go to **Email Templates**
3. Find your template: `template_e7ha0k3`
4. Click **Edit**

### Step 2: Update the Message Section

**Find this line in your template:**
```html
<p>We'll send you tracking information when the order ships.</p>
```

**Replace it with:**
```html
<p>{{status_message}}</p>
```

This will automatically show different messages based on order status:
- **Delivered**: "Thank you for placing order. Your order has been delivered. Happy shopping!"
- **Shipped**: "Your order has been shipped! We will send you tracking information soon."
- **Accepted**: "Thank you for your order! We have accepted your order and will process it shortly."
- **Pending**: "Thank you for your order! We have received your order and will process it soon."

### Step 3: Remove $ Sign from Prices

**Find all instances of `$` in your template and replace with `Rs.` or remove:**

**Current (with $ sign):**
```html
<strong>${{price}}</strong>
<td>${{cost.shipping}}</td>
<td>${{cost.tax}}</td>
<td>${{cost.total}}</td>
```

**Updated (only Rs., no $ sign):**
```html
<strong>{{price}}</strong>
<td>{{cost.shipping}}</td>
<td>{{cost.tax}}</td>
<td>{{cost.total}}</td>
```

**Note:** The prices are already formatted with "Rs." in the code, so you just need to remove the `$` sign from your template.

---

## 📋 Complete Template Variable Reference

Your template should use these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{order_id}}` | Order number | "ORD-1234567890" |
| `{{email}}` | Customer email | "customer@example.com" |
| `{{status_message}}` | **NEW** - Dynamic message based on status | "Thank you for placing order..." |
| `{{#orders}}` | Loop through order items | |
| `{{image_url}}` | Product image URL | "https://..." |
| `{{name}}` | Product name | "Sweatshirt" |
| `{{units}}` | Quantity | 1 |
| `{{price}}` | Price (already formatted as "Rs. 1,200") | "Rs. 1,200" |
| `{{/orders}}` | End of orders loop | |
| `{{cost.shipping}}` | Shipping cost (formatted as "Rs. 500") | "Rs. 500" |
| `{{cost.tax}}` | Tax amount (formatted as "Rs. 0") | "Rs. 0" |
| `{{cost.total}}` | Total amount (formatted as "Rs. 7,880") | "Rs. 7,880" |

---

## 🎯 Status Messages

The system automatically sends different messages based on order status:

### Delivered
```
Thank you for placing order. Your order has been delivered. Happy shopping!
```

### Shipped
```
Your order has been shipped! We will send you tracking information soon.
```

### Accepted
```
Thank you for your order! We have accepted your order and will process it shortly.
```

### Pending
```
Thank you for your order! We have received your order and will process it soon.
```

---

## ✅ Example Updated Template Section

Here's how your template section should look:

```html
<div style="padding: 0 16px">
  <!-- Dynamic status message -->
  <p>{{status_message}}</p>
  
  <div style="text-align: left; font-size: 14px; padding-bottom: 4px; border-bottom: 2px solid #333;">
    <strong>Order # {{order_id}}</strong>
  </div>
  
  {{#orders}}
  <table style="width: 100%; border-collapse: collapse">
    <tr style="vertical-align: top">
      <td style="padding: 24px 8px 0 4px; display: inline-block; width: max-content">
        <img style="height: 64px" height="64px" src="{{image_url}}" alt="item" />
      </td>
      <td style="padding: 24px 8px 0 8px; width: 100%">
        <div>{{name}}</div>
        <div style="font-size: 14px; color: #888; padding-top: 4px">QTY: {{units}}</div>
      </td>
      <td style="padding: 24px 4px 0 0; white-space: nowrap">
        <strong>{{price}}</strong>
      </td>
    </tr>
  </table>
  {{/orders}}
  
  <div style="padding: 24px 0">
    <div style="border-top: 2px solid #333"></div>
  </div>
  
  <table style="border-collapse: collapse; width: 100%; text-align: right">
    <tr>
      <td style="width: 60%"></td>
      <td>Shipping</td>
      <td style="padding: 8px; white-space: nowrap">{{cost.shipping}}</td>
    </tr>
    <tr>
      <td style="width: 60%"></td>
      <td>Taxes</td>
      <td style="padding: 8px; white-space: nowrap">{{cost.tax}}</td>
    </tr>
    <tr>
      <td style="width: 60%"></td>
      <td style="border-top: 2px solid #333">
        <strong style="white-space: nowrap">Order Total</strong>
      </td>
      <td style="padding: 16px 8px; border-top: 2px solid #333; white-space: nowrap">
        <strong>{{cost.total}}</strong>
      </td>
    </tr>
  </table>
</div>
```

**Key Changes:**
1. ✅ Replaced hardcoded message with `{{status_message}}`
2. ✅ Removed `$` sign from all price fields
3. ✅ Prices already formatted as "Rs. X,XXX" from code

---

## 🧪 Testing

After updating your template:

1. Go to Orders page in admin panel
2. Click Mail icon on an order with status "Delivered"
3. Check the email - it should show:
   - "Thank you for placing order. Your order has been delivered. Happy shopping!"
   - All prices with "Rs." only (no $ sign)

---

## 📝 Summary

**What to change in EmailJS template:**
1. Replace hardcoded message with `{{status_message}}`
2. Remove `$` sign from all price fields (prices already have "Rs." from code)

**What's already done in code:**
- ✅ Status-based messages are generated automatically
- ✅ All prices formatted as "Rs. X,XXX" (no $ sign)
- ✅ Dynamic message changes based on order status

Your emails will now show professional, status-appropriate messages and use PKR currency format! 🎉
