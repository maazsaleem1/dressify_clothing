# Dressify Storefront — Admin Panel Guide

Yeh document **Dressify inventory / admin panel** ke liye hai  
(`https://dressifyclothing-77a5e.web.app`).

Isme woh fields aur settings hain jo **website** (Multikart UI + Dressify Firebase data) pe dikhne ke liye admin se set karni hoti hain — **sirf woh jo is panel mein actually maujood hain**.

| Item | Value |
|------|--------|
| Admin panel | Inventory Dashboard (React + Firestore) |
| Website | Multikart frontend (Dressify branding) — alag repo |
| Firebase project | `dressifyclothing-77a5e` |
| Currency | PKR (`Rs.`) |
| Images | Cloudinary (via admin `ImageUpload`) |

### Admin menu → storefront tools

| Sidebar | Route | Kaam |
|---------|-------|------|
| Inventory | `/inventory` | Products + online fields |
| Brands & Categories | `/brands-categories` | Brands + categories (+ images) |
| Homepage Slider | `/slider` | Home hero slides |
| Orders | `/orders` | Website orders + status |
| Reviews | `/reviews` | Approve / reject reviews |
| Dashboard | `/` | Online sales + slider preview |

> **Note:** In-store **Sales & Credit**, Customers, Production, Expenses, Reports alag business tools hain — website catalog ke liye zaroori nahi.

---

## 1) Products (`inventory` collection)

**Admin:** Inventory → Add / Edit → **Online Store Settings**

Har product jo website pe dikhana hai:

| Field | Required for website? | Admin UI | Detail |
|--------|------------------------|----------|--------|
| `onlineStatus` | **YES** | Checkbox “Show on website” | `true` hona chahiye. Warna shop/home pe **nahi** aayega. |
| `productName` | **YES** | Yes | Product title (e.g. `Contrast Collar Lux`) |
| `onlinePrice` | **YES** | “Sale Price / Now Price” | Website selling price (PKR). Empty → price `Rs. 0` / fallback issues. |
| `sellingPrice` | Optional | “Original / Was” price | Agar `sellingPrice` > `onlinePrice` → **sale** badge auto. |
| `imageUrl` | **YES** | Main image upload | Full Cloudinary URL |
| `productImages` | Recommended | Up to **4** extra images | 2nd image hover/back ke liye |
| `sizes` | Recommended | Size rows | `[{ size: "M", quantity: 10 }, …]` — warna site “One Size” |
| `description` | Recommended | Textarea | Product detail page |
| `sku` | Optional | Yes | Cart / order line pe useful |
| `categoryId` | Recommended | Category (+ subcategory) | Shop filter / banners. Subcategory select ho to wahi `categoryId` save hota hai. |
| `brandId` | Optional | Brand dropdown | Brand filter |
| `tag` / `isNew` / `new` / `status: 'new'` | Optional | NEW badge checkbox | Admin multiple badge fields sync karta hai |
| `tag` / `isSale` / `sale` / `status: 'sale'` | Optional | SALE badge (auto agar was > now) | Same |

### Price rules (important)

- Website price = **`onlinePrice`** (primary)
- Agar `onlinePrice` empty → website fallback `sellingPrice` use karti hai
- Sale badge: jab `sellingPrice` > `onlinePrice` (admin bhi auto-mark karta hai)

### Size rules

- `sizes: [{ size, quantity }]`
- Default form: S / M / L / XL, ya One Size
- Stock website + order accept pe inventory se linked hai

### Visibility note

- Admin inventory list **sab** products dikhati hai (online + hidden)
- `onlineStatus` **sirf website** visibility control karta hai
- Is panel mein `status` field **NEW/SALE badge** ke liye use hoti hai — `hidden` / `hide` hide-flag ke liye **mat** use karo

### Not in admin (yet)

| Field | Notes |
|--------|--------|
| `careGuide` | Guide / Multikart Care tab ke liye — **admin form mein nahi**. Agar website Care tab chahti hai to field baad mein add karni hogi ya Firestore mein manually. |

### Men’s store only (website rule)

- Storefront pe **sirf men’s** dikhana hai
- Women / ladies / girls named categories website skip karti hai
- Admin pe enforce nahi — **categories aur products men’s rakho**

---

## 2) Categories (`categories` collection)

**Admin:** Brands & Categories → Categories tab

| Field | Required? | Admin UI | Detail |
|--------|-----------|----------|--------|
| `name` | **YES** | Yes | e.g. `Casual Wear`, `Formal Wear` (women/ladies/girls naam mat do) |
| `imageUrl` | Recommended | Image upload | Home collection / category banner |
| `description` | Optional | Yes | |
| `brandId` | **YES** (admin) | Required on create | Category brand se linked |
| `parentCategoryId` | Optional | Subcategory | Main = `null`; subcategory = parent id |
| `isActive` | Default `true` | Display only | Form se toggle **nahi** — create pe `true` |
| `order` / `displayOrder` | — | **Nahi** | Admin sort order field nahi; list name se sort |

Website pe typically:

- Shop → categories: All Products / Men’s Fashion + aapki categories
- Home → collection banners (women names exclude)

Use **`imageUrl`** only (field name `image` admin nahi likhta).

---

## 3) Brands (`brands` collection)

**Admin:** Brands & Categories → Brands tab

| Field | Admin UI | Detail |
|--------|----------|--------|
| `name` | Yes | Brand display name |
| `description` | Yes | Optional |
| `imageUrl` | Yes | Optional logo / image |
| `isActive` | Display only | Defaults `true`; no form toggle |

Products ko **`brandId`** se link karo (Inventory form).

---

## 4) Homepage Sliders (`sliders` collection)

**Admin:** Homepage Slider (`/slider`)  
**Preview:** Dashboard pe bhi slider preview

| Field | Required? | Admin UI | Detail |
|--------|-----------|----------|--------|
| `imageUrl` | **YES** | Yes | Full-bleed hero image (Cloudinary URL) |
| `status` | **YES** | Active toggle | `true` = live on website |
| `heading` | Recommended | Yes | Bada text (e.g. `NEW COLLECTION`) |
| `subheading` | Recommended | Yes | Chhota text (e.g. `Welcome To Dressify`) |
| `ctaText` | Optional | Yes | Default website side: `Shop Now` |
| `ctaLink` | Optional | Yes | e.g. `/shop/left_sidebar` |
| `order` | Optional | Up / down reorder | Chhota number pehle |
| `productId` | Optional | Yes | Single product deep-link |
| `productIds` | Optional | Yes | Multi-product |
| `categoryId` / `brandId` | Optional | Yes | Filter deep-link |
| `filterQuery` / `linkType` | Optional | Yes | Extra linking helpers (admin saves these) |

> Alternate name `backgroundImageUrl` / `displayOrder` **use mat karo** — is panel mein **`imageUrl`** + **`order`** hain.

### Slider image tips

- Wide landscape (~**1920×800**)
- Text readable; men’s fashion imagery
- Agar koi active slider na ho → website Multikart fallback banner dikhati hai

---

## 5) Reviews (`reviews` collection)

**Admin:** Reviews (`/reviews`)

| Field | Who sets | Admin |
|--------|----------|--------|
| `productId` | Website form | View / filter (API) |
| `productName` | Website | View |
| `customerName`, `customerEmail` | Customer | View |
| `rating` | Customer | View (1–5) |
| `reviewTitle`, `reviewText` | Customer | View |
| `status` | **Admin** | `pending` → **`approved`** / **`rejected`** |
| `createdAt` / `updatedAt` | Auto | View |

Website pe **sirf `approved`** reviews dikhte hain.

**Admin actions:** Approve, Reject, Delete.

---

## 6) Orders (`orders` collection) — website se auto

Website checkout (COD / EasyPaisa) documents create karti hai. Admin usually create nahi karta.

### Typical fields (website writes)

- `orderNumber` (e.g. `ORD-...`)
- `customer` `{ name, email, phone }`
- `items[]` — name, size, qty, unitPrice, imageUrl, inventoryId, sku…
- `subtotal`, `shipping` / `shippingCost`, `tax`, `totalAmount`
- `paymentMethod`: e.g. `Cash on Delivery` | `EasyPaisa`
- `paymentStatus`, `status` (usually `Pending`)
- `shippingAddress`, `notes`

### Admin: Orders (`/orders`)

| Action | Supported? |
|--------|------------|
| List / search / filter by status | ✅ |
| View customer, address, items, total, payment method | ✅ |
| Status flow forward | ✅ **Pending → Accepted → Shipped → Delivered** |
| Stock deduct on **Accepted** | ✅ (transaction on inventory sizes) |
| Tracking number | ✅ Auto on **Shipped** (`TRACK-…`) — manual edit UI nahi |
| Send confirmation email (EmailJS) | ✅ |
| Cloud Function emails on create / status | ✅ |
| Edit `paymentStatus` (EasyPaisa confirm) | ❌ Read-only in UI |
| Cancel order button | ❌ API `Cancelled` allow karti hai; UI forward-only |
| Show subtotal / shipping / tax breakdown | ✅ Orders detail + confirmation email |
| Carts (`carts`) viewer | ❌ Collection website ke liye; admin mein page nahi |

**Admin daily kaam:** Orders list → Accept → Ship → Deliver; email confirm; EasyPaisa verify Firebase Console / future UI se.

---

## 7) Carts (`carts` collection)

- Website session carts
- **Admin panel mein UI / API nahi**
- Support ke liye Firebase Console se read kar sakte ho

---

## 8) Contact messages (`contactMessages` collection)

Website Contact form yahan save karti hai (storefront side):

| Field | Type | Notes |
|--------|------|--------|
| `firstName`, `lastName` | string | |
| `phone`, `email` | string | |
| `message` | string | Customer issue |
| `status` | string | Default `new` → `read` → `resolved` |
| `source` | string | e.g. `storefront-contact` |
| `createdAt` / `updatedAt` | timestamp | |

**Admin panel:** abhi **Contact Messages page nahi**.  
Messages dekhne ke liye: Firebase Console → Firestore → `contactMessages` (order by `createdAt` desc).

---

## 9) Multikart jaisa filled look — checklist

Admin se complete karo:

1. **8+ online products** — `onlineStatus: true`, `onlinePrice`, `imageUrl`
2. **2–4 active sliders** — men’s hero + heading/subheading + `status: true`
3. **3–6 men’s categories** — `imageUrl` set
4. Products pe **sizes + stock**
5. Kuch pe **sale** (`sellingPrice` > `onlinePrice`) aur **NEW** badge
6. Reviews **Approve** karo (PDP social proof)
7. Women / electronics / vegetables type demo categories **mat** rakho
8. Brands link karo agar brand filter chahiye

---

## 10) Common problems → fix (admin)

| Website pe dikha | Admin fix |
|------------------|-----------|
| Product list empty | Inventory → product → **Show on website** (`onlineStatus: true`) |
| Price `Rs. 0.00` | **Online Price** set karo |
| Double / ghost image | Alag `productImages[1]` do, ya sirf 1 image rakho |
| Slider pe purani Multikart image | Homepage Slider → active slide + `imageUrl` |
| Category empty / galat | Men’s categories + images; women names hatao |
| Review nahi dikh raha | Reviews → **Approve** (`status: approved`) |
| Order email nahi | EmailJS / Functions setup; customer email sahi ho |
| Contact form message kahan? | Firestore `contactMessages` (admin UI pending) |
| Product admin mein hai lekin site pe nahi | `onlineStatus` check; category name women filter to nahi? |

---

## 11) Quick “minimum live store”

1. Brands & Categories → 1 brand + 1 category `Men's Wear` + image  
2. Inventory → 4 products: name, `onlinePrice`, `imageUrl`, sizes, **Show on website**  
3. Homepage Slider → 2 slides: image + heading + subheading + active  
4. Test website: Home → Shop → Add to cart → Checkout (COD)  
5. Admin Orders → naya order dikhe → Accept  

Iske baad Multikart layout mein real Dressify data chalna chahiye.

---

## 12) Developer notes

- Website GraphQL / Multikart demo products use **nahi** karti — **Firebase** collections: `inventory`, `categories`, `brands`, `sliders`, `orders`, `reviews`, (+ `carts`, `contactMessages` storefront-only)
- Shipping (website): typically **Rs. 249**; payment: **COD + EasyPaisa**
- Branding: **Dressify**
- About Us often nav se remove; Contact → `contactMessages`
- Admin deploy: `npm run firebase:deploy:hosting` → https://dressifyclothing-77a5e.web.app
- Related older docs: `ONLINE_STORE_INTEGRATION.md`, `SLIDER_SETUP.md`, `ORDER_MANAGEMENT_SETUP.md`, `EMAILJS_INTEGRATION.md`

### Gaps vs older Multikart admin write-up

| Older guide said | Actual Dressify admin |
|------------------|------------------------|
| `careGuide` on products | Not in UI |
| Category `order` / `displayOrder` | Not in UI |
| `backgroundImageUrl` on sliders | Use `imageUrl` + `order` |
| Contact messages inbox | Not built — use Console |
| Carts admin | Not built |
| EasyPaisa payment confirm in UI | Not editable yet |
| Cancel order in UI | Forward status only |

Jab yeh features add hon, is file ko update karna.
