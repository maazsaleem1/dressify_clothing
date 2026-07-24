# EmailJS Integration Guide

## Overview

Admin panel se Orders page par order confirmation emails EmailJS se bhejte hain.

---

## Configuration

`client/src/services/emailService.js`:

```javascript
const EMAILJS_CONFIG = {
  serviceId: 'service_nzioc7a',
  templateId: 'template_e7ha0k3',
  publicKey: 'hV25LzOUnqnnf2yMr'
};
```

HTML to paste in EmailJS: `EMAILJS_ORDER_CONFIRMATION_TEMPLATE.html`

---

## Template variables (flat money keys)

| Variable | Example | Source |
|----------|---------|--------|
| `order_id` | ORD-123 | `orderNumber` |
| `email` | customer@… | `customer.email` |
| `customer_name` | Ali | `customer.name` |
| `customer_phone` | 03… | `customer.phone` |
| `shipping_address` | … | `shippingAddress` |
| `payment_method` | Cash on Delivery | `paymentMethod` |
| `order_date` | 24 July 2026 | `orderDate` |
| `status_message` | We've received… | from `status` |
| `website_link` | https://… | fixed in code |
| `orders[]` | line items | see below |
| **`cost_shipping`** | Rs. 249 | `shipping` / `shippingCost` / default **249** |
| **`cost_tax`** | Rs. 0 | `tax` |
| **`cost_total`** | Rs. 7,880 | `totalAmount` |

Do **not** use nested `{{cost.shipping}}` — EmailJS often leaves it blank from admin sends.

### Line items (`orders`)

- `image_url`, `name`, `units`, `size_label` (e.g. ` · Size: M`), `price` (line total)

---

## Shipping rules

1. Prefer `order.shipping`
2. Else `order.shippingCost`
3. Else default **Rs. 249**
4. Orders detail modal shows Subtotal / Shipping / Taxes / Total (same helper as email)

Website checkout should write `shipping: 249` on each order.

---

## How to use

1. **Orders** → mail icon, or open order → **Send Confirmation Email**
2. Check shipping line in modal before send
3. Customer must have `customer.email`

---

## Troubleshooting

- Empty shipping in email → ensure EmailJS HTML uses `{{cost_shipping}}` (not `{{cost.shipping}}`)
- Paste latest HTML from `EMAILJS_ORDER_CONFIRMATION_TEMPLATE.html`
- Template ID must be `template_e7ha0k3`
- “Customer email is required” → order missing email

---

## Summary

- Template: `template_e7ha0k3` (Dressify branded HTML)
- Money: flat `cost_shipping`, `cost_tax`, `cost_total`
- Default shipping: Rs. 249 when field missing
