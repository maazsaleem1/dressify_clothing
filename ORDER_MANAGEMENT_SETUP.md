# 📦 Order Management System Setup Guide

## ✅ What's Been Added

A complete **Order Management System** that allows you to:

1. **View All Orders** - See all website orders in one place
2. **Order Details** - Complete order information with customer and product details
3. **Status Management** - Update order status through workflow
4. **Search & Filter** - Find orders quickly
5. **Status Tracking** - Visual progress indicator

---

## 📋 Features

### Order Management Page
- **Location**: Navigate to **"Orders"** in the sidebar
- **Order List**: Table view of all orders
- **Search**: Search by order number, customer name, email, or phone
- **Filter**: Filter by order status
- **View Details**: Click eye icon to see full order details
- **Update Status**: Quick status update buttons

### Order Status Workflow

Orders progress through these statuses:

1. **Pending** ⏰ - New order, awaiting confirmation
2. **Accepted** ✅ - Order confirmed and being processed
3. **Shipped** 🚚 - Order shipped to customer
4. **Delivered** 📦 - Order delivered successfully
5. **Cancelled** ❌ - Order cancelled (can be set at any time)

### Status Update Flow

- **Pending** → **Accepted** → **Shipped** → **Delivered**
- Each status can only move to the next one in sequence
- **Cancelled** can be set at any time

---

## 🎯 How to Use

### Viewing Orders

1. Go to **Orders** in the sidebar
2. See all orders in a table format
3. Use search bar to find specific orders
4. Use status filter to see orders by status
5. Click **👁️ View** icon to see full details

### Updating Order Status

**Method 1: Quick Update from Table**
1. Find the order in the table
2. Click the **✏️ Edit** icon next to the order
3. Confirm the status update
4. Status automatically moves to next step

**Method 2: Update from Details Modal**
1. Click **👁️ View** to open order details
2. See status progress bar at top
3. Click **"Update to [Next Status]"** button
4. Confirm the update

### Viewing Order Details

Click the **👁️ View** icon to see:
- **Customer Information**: Name, email, phone, shipping address
- **Order Information**: Date, payment method, payment status, tracking number
- **Product List**: All items with images, sizes, quantities, prices
- **Status Progress**: Visual indicator of order progress
- **Order Notes**: Any additional notes

---

## 📊 Order Data Structure

Each order in Firestore:

```javascript
{
  id: "order_id",
  orderNumber: "ORD-1234567890",
  customerId: "customer_id",  // Reference to customer
  customer: {                 // Populated customer data
    name: "John Doe",
    email: "john@example.com",
    phone: "+92 300 1234567"
  },
  items: [                    // Array of ordered items
    {
      productName: "Dusty Teal T-Shirt",
      sku: "MT0405P-2XL-TEL",
      size: "XL",
      quantity: 2,
      unitPrice: 3890,
      imageUrl: "https://...",
      inventoryId: "inventory_id"
    }
  ],
  totalAmount: 7780,
  paymentMethod: "Cash on Delivery",  // or "Credit Card", "Bank Transfer", etc.
  paymentStatus: "Paid",              // or "Pending", "Partial"
  status: "Pending",                  // Pending, Accepted, Shipped, Delivered, Cancelled
  shippingAddress: "123 Main St, City, Country",
  trackingNumber: "TRACK-1234567890", // Auto-generated when status = Shipped
  notes: "Handle with care",
  orderDate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 🔗 Website Integration

### Creating Orders from Website

When a customer places an order on your website, create it like this:

```javascript
import { createOrder } from './services/api';

const placeOrder = async (cartItems, customerInfo, paymentInfo) => {
  const orderData = {
    customerId: customerInfo.id,  // If customer exists
    customer: {                    // Or full customer object
      name: customerInfo.name,
      email: customerInfo.email,
      phone: customerInfo.phone
    },
    items: cartItems.map(item => ({
      productName: item.productName,
      sku: item.sku,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.onlinePrice || item.sellingPrice,
      imageUrl: item.imageUrl,
      inventoryId: item.id
    })),
    totalAmount: cartItems.reduce((sum, item) => 
      sum + (item.onlinePrice || item.sellingPrice) * item.quantity, 0
    ),
    paymentMethod: paymentInfo.method,
    paymentStatus: paymentInfo.status || 'Pending',
    status: 'Pending',
    shippingAddress: customerInfo.address,
    notes: customerInfo.notes || ''
  };

  const result = await createOrder(orderData);
  return result.data;
};
```

### Updating Inventory on Order

When an order is created, you should also update inventory:

```javascript
// After creating order, update inventory quantities
for (const item of orderData.items) {
  const inventoryRef = doc(db, 'inventory', item.inventoryId);
  const inventoryDoc = await getDoc(inventoryRef);
  
  if (inventoryDoc.exists()) {
    const inventoryData = inventoryDoc.data();
    const sizes = inventoryData.sizes || [];
    const sizeIndex = sizes.findIndex(s => s.size === item.size);
    
    if (sizeIndex >= 0) {
      const newSizes = [...sizes];
      newSizes[sizeIndex] = {
        ...newSizes[sizeIndex],
        quantity: Math.max(0, (newSizes[sizeIndex].quantity || 0) - item.quantity)
      };
      await updateDoc(inventoryRef, { sizes: newSizes });
    }
  }
}
```

---

## 🎨 Status Indicators

### Status Colors
- **Pending**: Yellow (⏰ Clock icon)
- **Accepted**: Blue (✅ CheckCircle icon)
- **Shipped**: Purple (🚚 Truck icon)
- **Delivered**: Green (📦 Package icon)
- **Cancelled**: Red (❌ XCircle icon)

### Status Progress Bar

The order details modal shows a visual progress bar:
```
[✓] Pending → [✓] Accepted → [✓] Shipped → [ ] Delivered
```

Each step is marked as completed when the order reaches that status.

---

## 🔄 Order Status Updates

### Automatic Features

1. **Tracking Number**: Automatically generated when status changes to "Shipped"
2. **Updated Timestamp**: Automatically updated on each status change
3. **Status Validation**: Only allows valid status transitions

### Manual Status Updates

Admins can update status through:
- Quick update button in table (moves to next status)
- Update button in details modal
- Status dropdown (if you add one)

---

## 📱 Responsive Design

The order management interface is fully responsive:
- **Mobile**: Stacked layout, touch-friendly buttons
- **Tablet**: Optimized table layout
- **Desktop**: Full table with all columns visible

---

## 🔍 Search & Filter

### Search Functionality
Search works across:
- Order number (e.g., "ORD-1234567890")
- Customer name
- Customer email
- Customer phone number

### Filter Options
- All Status
- Pending
- Accepted
- Shipped
- Delivered
- Cancelled

---

## 📝 Best Practices

1. **Update Status Promptly**: Keep customers informed by updating status quickly
2. **Add Tracking Numbers**: When shipping, ensure tracking number is added
3. **Review Orders Daily**: Check for new pending orders regularly
4. **Verify Payment**: Confirm payment before marking as "Accepted"
5. **Update Inventory**: Ensure inventory is updated when orders are created
6. **Customer Communication**: Notify customers when status changes

---

## 🚀 API Functions

Available in `services/api.js`:

```javascript
// Get all orders (with optional status filter)
getOrders({ status: 'Pending' })

// Get single order by ID
getOrder(orderId)

// Create new order
createOrder(orderData)

// Update order status
updateOrderStatus(orderId, 'Shipped')

// Update order (any fields)
updateOrder(orderId, orderData)

// Delete order
deleteOrder(orderId)
```

---

## 💡 Example: Complete Order Flow

### 1. Customer Places Order (Website)
```javascript
const order = await createOrder({
  customer: { name: "John", email: "john@example.com", phone: "+92..." },
  items: [...cartItems],
  totalAmount: 5000,
  paymentMethod: "Cash on Delivery",
  status: "Pending"
});
```

### 2. Admin Reviews Order (Dashboard)
- Go to Orders page
- See new order in "Pending" status
- Click View to see details

### 3. Admin Accepts Order
- Click "Update to Accepted"
- Order status changes to "Accepted"
- Inventory quantities updated (if not done automatically)

### 4. Admin Ships Order
- Click "Update to Shipped"
- Tracking number auto-generated
- Order status changes to "Shipped"

### 5. Order Delivered
- Click "Update to Delivered"
- Order marked as complete
- Customer notified (if you add notification system)

---

## ✅ Summary

You now have:
- ✅ Complete order management interface
- ✅ Order details view with all information
- ✅ Status workflow (Pending → Accepted → Shipped → Delivered)
- ✅ Search and filter functionality
- ✅ Visual status progress indicator
- ✅ Responsive design
- ✅ API functions for order CRUD operations

The order management system is ready to handle all your website orders! 🎉
