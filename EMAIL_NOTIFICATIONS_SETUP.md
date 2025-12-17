# 📧 Email Notifications Setup Guide

## ✅ What's Been Added

Firebase Cloud Functions for **automatic email notifications**:

1. **New Order Notification** - Sends email to admin when order is created
2. **Order Status Update** - Sends email to customer when order status changes
3. **Rich HTML Emails** - Beautiful, formatted email templates

---

## 🔧 Setup Instructions

### Step 1: Install Dependencies

```bash
cd functions
npm install
```

This will install `nodemailer` for sending emails.

### Step 2: Configure Email Credentials

You have two options:

#### Option A: Using Firebase Functions Config (Recommended)

```bash
# Set email credentials
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.password="your-app-password"
firebase functions:config:set email.admin="admin@dressifyclothing.com"
```

**For Gmail:**
1. Enable 2-Step Verification
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password (not your regular password)

#### Option B: Using Environment Variables

Create `.env` file in `functions/` directory:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@dressifyclothing.com
```

Then update `functions/index.js` to use `process.env` instead of `functions.config()`.

### Step 3: Deploy Functions

```bash
# From project root
firebase deploy --only functions
```

Or from functions directory:

```bash
cd functions
firebase deploy --only functions
```

---

## 📧 Email Templates

### New Order Notification (Admin)

**Sent to:** Admin email address  
**Trigger:** When new order document is created  
**Contains:**
- Order number and date
- Customer information (name, email, phone, address)
- Complete product list with quantities and prices
- Total amount
- Payment method and status
- Link to view order in dashboard

### Order Status Update (Customer)

**Sent to:** Customer email  
**Trigger:** When order status changes  
**Contains:**
- Order number
- Updated status
- Tracking number (if status = Shipped)
- Personalized message

---

## 🎯 How It Works

### Automatic Triggers

1. **Order Created** → Admin receives email notification
2. **Status Changed** → Customer receives status update email

### Email Service Options

The function is configured for Gmail by default. To use other services:

#### SMTP Configuration (Any Email Provider)

Edit `functions/index.js`:

```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@domain.com',
    pass: 'your-password',
  },
});
```

**Common SMTP Settings:**

- **Gmail**: smtp.gmail.com, port 587
- **Outlook**: smtp-mail.outlook.com, port 587
- **Yahoo**: smtp.mail.yahoo.com, port 587
- **Custom SMTP**: Use your hosting provider's SMTP settings

---

## 🔐 Security Best Practices

1. **Never commit credentials** to git
2. **Use Firebase Functions config** or environment variables
3. **Use App Passwords** for Gmail (not regular password)
4. **Restrict email sending** to prevent abuse

---

## 🧪 Testing

### Test Locally with Emulators

```bash
# Start Firebase emulators
firebase emulators:start

# In another terminal, create a test order
# The function will trigger automatically
```

### Test in Production

1. Create a test order in your dashboard
2. Check admin email inbox
3. Update order status
4. Check customer email inbox

---

## 📝 Customization

### Change Email Template

Edit the HTML in `functions/index.js`:

```javascript
html: `
  <!DOCTYPE html>
  <html>
  <!-- Your custom HTML template -->
  </html>
`
```

### Change Recipients

Edit the `to` field in mailOptions:

```javascript
to: 'custom-email@example.com', // Single email
// or
to: ['email1@example.com', 'email2@example.com'], // Multiple emails
```

### Add More Email Triggers

You can add more triggers:

```javascript
exports.sendLowStockAlert = functions.firestore
  .document('inventory/{itemId}')
  .onUpdate(async (change, context) => {
    // Check if stock is low
    // Send email alert
  });
```

---

## ⚠️ Troubleshooting

### Emails not sending

1. **Check Firebase Functions logs:**
   ```bash
   firebase functions:log
   ```

2. **Verify credentials:**
   - Gmail: Use App Password, not regular password
   - Check email and password are correct

3. **Check function deployment:**
   ```bash
   firebase functions:list
   ```

### Function not triggering

1. **Check Firestore rules** - Function needs read access
2. **Verify function is deployed**
3. **Check Firebase Console** - Functions > Logs

### Gmail "Less secure app" error

- Enable 2-Step Verification
- Generate App Password
- Use App Password instead of regular password

---

## 💰 Firebase Functions Pricing

**Free Tier:**
- 2 million invocations/month
- 400,000 GB-seconds compute time
- 200,000 CPU-seconds

**Typical Usage:**
- ~100 orders/month = ~100 function invocations
- Well within free tier limits

---

## ✅ Summary

You now have:
- ✅ Automatic email notifications for new orders
- ✅ Customer status update emails
- ✅ Beautiful HTML email templates
- ✅ Configurable email service
- ✅ Secure credential management

Email notifications are ready to use! 📧

---

## 🚀 Next Steps

1. **Configure email credentials** (Step 2 above)
2. **Deploy functions** (`firebase deploy --only functions`)
3. **Test** by creating a test order
4. **Customize** email templates if needed

---

## 📚 Additional Resources

- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Nodemailer Docs](https://nodemailer.com/about/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
