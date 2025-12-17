# 🌐 Online Store Integration Guide

## ✅ What's Been Added

Your inventory management system now includes **online store features** that allow you to:

1. **Manage Online Products** - Control which products appear on your website
2. **Set Online Prices** - Different prices for online vs. in-store
3. **Add Product Descriptions** - Rich descriptions for website visitors
4. **Upload Multiple Images** - Front, back, close-up views (like in the screenshot)
5. **Track SKU/Model Numbers** - Product identifiers for your website
6. **Size Availability** - Automatically shows available sizes on website

---

## 📋 New Fields Added to Inventory

### Online Store Settings Section

When adding or editing inventory items, you'll now see an **"Online Store Settings"** section with:

#### 1. **SKU/Model Number**
- Product identifier (e.g., "MT0405P")
- Used for tracking and website display
- Optional field

#### 2. **Online Price**
- Price displayed on your website
- Can be different from your regular selling price
- Example: Regular price Rs. 1500, Online price Rs. 3890
- Optional - if not set, uses regular selling price

#### 3. **Product Description**
- Detailed description for website visitors
- Supports multiple paragraphs
- This is what customers will read on your product page
- Optional but recommended

#### 4. **Multiple Product Images**
- Upload up to 4 additional images
- Perfect for: front view, back view, close-up, detail shots
- Images are stored in Cloudinary
- Main product image is still required

#### 5. **Online Status Toggle**
- **✅ Show on website** - Product is visible to customers
- **❌ Hide from website** - Product is hidden (for out-of-stock, discontinued, etc.)
- Easy toggle to control visibility

---

## 🎯 How to Use

### Adding a Product for Online Store

1. Go to **Inventory** > **Add Stock**
2. Fill in basic information (Brand, Category, Product Name, etc.)
3. Scroll down to **"Online Store Settings"** section
4. Fill in:
   - **SKU**: Enter product model number (e.g., "MT0405P-2XL-TEL")
   - **Online Price**: Set website price (if different from selling price)
   - **Description**: Write a compelling product description
   - **Additional Images**: Upload 2-4 extra images (front, back, close-up)
   - **Toggle "Show on website"**: Enable to make it visible
5. Click **Add Item**

### Editing Online Product Info

1. Click **Edit** on any inventory item
2. Scroll to **"Online Store Settings"** section
3. Update any fields as needed
4. Toggle online status on/off as needed
5. Click **Update Item**

---

## 📊 Inventory Table Updates

The inventory table now shows:
- **Online Status Column**: Shows 🌐 Online or 🔒 Hidden
- **SKU Display**: Shows SKU number if set
- **Online Price**: Shows online price if different from regular price

---

## 🔗 Website Integration

### Data Structure for Your Website

Each inventory item now includes these fields for your website:

```javascript
{
  id: "item_id",
  productName: "Dusty Teal Jacquard T-Shirt",
  sku: "MT0405P-2XL-TEL",
  sellingPrice: 1500,        // Regular price
  onlinePrice: 3890,         // Website price
  description: "Beautiful teal t-shirt...", // Product description
  imageUrl: "https://...",    // Main product image
  productImages: [            // Additional images array
    "https://...",  // Front view
    "https://...",  // Back view
    "https://...",  // Close-up
    "https://..."   // Detail shot
  ],
  onlineStatus: true,         // true = show on website
  sizes: [                    // Size availability
    { size: "S", quantity: 5 },
    { size: "M", quantity: 10 },
    { size: "L", quantity: 8 },
    { size: "XL", quantity: 3 }
  ],
  // ... other fields
}
```

### Fetching Products for Website

To get only products that should be shown online:

```javascript
// In your website API/service
const getOnlineProducts = async () => {
  const inventory = await getInventory();
  return inventory.data.filter(item => item.onlineStatus === true);
};
```

### Displaying on Website

Use the data like this:

1. **Product Images**: 
   - Main image: `item.imageUrl`
   - Gallery: `item.productImages` array
   - Show thumbnails for multiple views

2. **Price Display**:
   - Use `item.onlinePrice` if set, otherwise `item.sellingPrice`
   - Format: `Rs. ${item.onlinePrice || item.sellingPrice}`

3. **Size Selection**:
   - Filter sizes where `quantity > 0`
   - Show "Out of Stock" for sizes with 0 quantity
   - Example: `item.sizes.filter(s => s.quantity > 0)`

4. **Product Description**:
   - Display `item.description` on product page
   - Can be formatted as HTML or markdown

5. **SKU Display**:
   - Show `item.sku` on product page
   - Useful for customer service and tracking

---

## 🎨 Website Features You Can Build

Based on the screenshot you shared, here's what you can implement:

### 1. **Product Page Layout**
- Left: Image gallery (main + thumbnails)
- Right: Product info, price, size selection, add to cart

### 2. **Size Selection**
- Show available sizes as buttons
- Disable sizes with 0 quantity
- Show "Out of Stock" badge

### 3. **Price Display**
- Show online price prominently
- Show regular price if different (strikethrough)
- Display tax/shipping info

### 4. **Product Images**
- Main large image
- Thumbnail gallery below/left
- Click to change main image
- Zoom functionality

### 5. **Product Description**
- Rich text description
- Bullet points for features
- Size guide information

### 6. **Related Products**
- Show products from same brand/category
- "People also bought" section
- Bundle suggestions

---

## 🔄 Real-time Updates

When you update inventory:
- **Stock changes** automatically reflect on website
- **Online status** changes take effect immediately
- **Price updates** show on website instantly
- **New images** appear after upload

---

## 📝 Best Practices

1. **Always set online price** if different from regular price
2. **Write compelling descriptions** - helps with SEO and sales
3. **Upload multiple images** - customers want to see all angles
4. **Keep SKU consistent** - helps with inventory tracking
5. **Update online status** - hide out-of-stock items quickly
6. **Check size availability** - ensure accurate stock display

---

## 🚀 Next Steps

1. **Add products** with online settings
2. **Build your website** using the data structure above
3. **Connect to Firestore** to fetch online products
4. **Implement shopping cart** functionality
5. **Add search/filter** by brand, category, price
6. **Create product detail pages** with all the features

---

## 💡 Example API Endpoint for Website

```javascript
// Get all online products
GET /api/inventory?onlineStatus=true

// Get single product by ID
GET /api/inventory/:id

// Filter by category
GET /api/inventory?category=hoodies&onlineStatus=true

// Filter by brand
GET /api/inventory?brand=nike&onlineStatus=true
```

---

## ✅ Summary

You now have a complete system to:
- ✅ Manage which products appear online
- ✅ Set different prices for online vs. in-store
- ✅ Add rich product descriptions
- ✅ Upload multiple product images
- ✅ Track SKU/model numbers
- ✅ Control size availability display
- ✅ Easily toggle products on/off website

All this data is stored in Firestore and ready to be used by your website! 🎉

