# Quick Start Guide 🚀

Get your Inventory Management Dashboard up and running in 5 minutes!

## Prerequisites Check ✅

Make sure you have:
- [ ] Node.js installed (v16+)
- [ ] MongoDB installed and running
- [ ] Terminal/Command Prompt access

## Installation Steps

### 1️⃣ Install Dependencies (2 minutes)

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2️⃣ Configure Environment (30 seconds)

Create `.env` file in root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/inventory-dashboard
NODE_ENV=development
```

Create `client/.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

### 3️⃣ Start MongoDB (if not running)

**Windows:**
```bash
# MongoDB usually runs as a service automatically
# Check if running:
mongo --eval "db.version()"
```

**If not running, start it:**
```bash
mongod
```

### 4️⃣ Start the Application (1 minute)

```bash
npm run dev
```

This starts both backend (port 5000) and frontend (port 5173)

### 5️⃣ Open in Browser

Navigate to: **http://localhost:5173**

---

## First Time Setup 🎯

### Step 1: Add Brands (1 minute)
1. Click **"Brands & Categories"** in sidebar
2. Click **"Add Brand"**
3. Add these brands:
   - Icon
   - Local Rugby Brand
   - Custom In-House

### Step 2: Add Categories (1 minute)
1. Switch to **"Categories"** tab
2. Click **"Add Category"**
3. Add these categories:
   - Hoodies
   - Trousers
   - Jerseys
   - Sweatshirts
   - Zippers

### Step 3: Add a Customer (1 minute)
1. Click **"Customers"** in sidebar
2. Click **"Add Customer"**
3. Fill in:
   - Name: Ali Garments
   - Market: Saddar Market
   - Contact: +92 300 1234567
   - Type: Credit
   - Credit Limit: 100000

### Step 4: Add Inventory (2 minutes)
1. Click **"Inventory"** in sidebar
2. Click **"Add Stock"**
3. Fill in:
   - Brand: Icon
   - Category: Hoodies
   - Product Name: Winter Hoodie
   - Sizes: S:10, M:20, L:20, XL:10
   - Cost Per Unit: 1200
   - Selling Price: 1500
4. Click **"Add Item"**

### Step 5: Create a Sale (2 minutes)
1. Click **"Sales & Credit"** in sidebar
2. Click **"New Sale"**
3. Select customer: Ali Garments
4. Select product: Winter Hoodie
5. Select size: M
6. Quantity: 5
7. Click **"Add"**
8. Enter paid amount: 5000
9. Click **"Create Sale"**

### Step 6: View Dashboard 📊
1. Click **"Dashboard"** in sidebar
2. See your first sale reflected!
3. Check inventory updated automatically

---

## Quick Tips 💡

### Navigation
- Use the **sidebar** to switch between modules
- Click the **hamburger menu** to collapse sidebar
- All data updates in **real-time**

### Keyboard Shortcuts
- `Ctrl/Cmd + S` to save forms
- `Esc` to close modals
- `Tab` to navigate form fields

### Common Actions

**Add New Items:**
- Look for the **"+ Add"** button in each module

**Search:**
- Use the search bar at the top of lists

**Filter:**
- Use dropdown filters to narrow down data

**Edit:**
- Click the **pencil icon** on any item

**Delete:**
- Click the **trash icon** (with confirmation)

---

## Testing the System 🧪

### Test Scenario: Complete Workflow

1. **Create Production Batch**
   - Go to Production
   - Add batch: "Winter 2025 Collection"
   - 500 units, various sizes
   - Mark as "In Process"

2. **Complete Production**
   - Edit the batch
   - Change status to "Completed"
   - Click "Move to Inventory"
   - Select brand: Icon

3. **Make Multiple Sales**
   - Create 3-4 sales with different customers
   - Mix of cash and credit sales
   - Add partial payments to credit sales

4. **View Reports**
   - Go to Reports
   - See sales trends
   - Check top products
   - View payment distribution

5. **Check Dashboard**
   - All metrics updated
   - Charts showing data
   - Low stock alerts (if any)

---

## Troubleshooting 🔧

### Backend Won't Start
```bash
# Check if MongoDB is running
mongo --eval "db.version()"

# If not, start MongoDB
mongod
```

### Frontend Shows "Failed to Fetch"
- Ensure backend is running on port 5000
- Check browser console for errors
- Verify `.env` files are correct

### Port Already in Use
```bash
# Change PORT in .env to 5001 or any other port
PORT=5001
```

### Can't Connect to MongoDB
- Check if MongoDB service is running
- Verify MONGODB_URI in `.env`
- Try: `mongodb://127.0.0.1:27017/inventory-dashboard`

---

## Next Steps 📚

Now that you're set up:

1. **Read the Full Documentation**
   - Check `README.md` for overview
   - Read `FEATURES.md` for detailed features
   - See `INSTALLATION.md` for advanced setup

2. **Customize Your Setup**
   - Add your actual brands
   - Create your product categories
   - Import your customer list
   - Add your inventory

3. **Explore Features**
   - Try all modules
   - Test credit management
   - Create production batches
   - Generate reports

4. **Set Up for Production**
   - Deploy to cloud (Render, Heroku)
   - Use MongoDB Atlas
   - Configure domain name

---

## Support & Resources 📞

### Documentation
- `README.md` - Project overview
- `FEATURES.md` - Complete feature list
- `INSTALLATION.md` - Detailed installation guide

### Common Questions

**Q: How do I backup my data?**
A: Use MongoDB backup tools or export from MongoDB Compass

**Q: Can I use this for multiple businesses?**
A: Yes, create separate databases for each business

**Q: Is there a mobile app?**
A: The web app is mobile-responsive. Native apps are in the roadmap.

**Q: Can I customize the interface?**
A: Yes! The code is fully customizable. Edit React components in `client/src/`

---

## Success! 🎉

You're now ready to manage your inventory like a pro!

**What you can do now:**
- ✅ Track inventory in real-time
- ✅ Manage customer credits
- ✅ Monitor production
- ✅ Generate sales reports
- ✅ Make data-driven decisions

**Happy Managing! 🚀**

---

## Quick Command Reference

```bash
# Start everything
npm run dev

# Start backend only
npm run server

# Start frontend only
npm run client

# Install all dependencies
npm run install-all

# Build for production
npm run build

# MongoDB commands
mongo                          # Open MongoDB shell
use inventory-dashboard        # Switch to database
db.inventory.find()           # View inventory
db.sales.find()               # View sales
```

---

**Need Help?** Check the troubleshooting section above or review the full documentation files.

