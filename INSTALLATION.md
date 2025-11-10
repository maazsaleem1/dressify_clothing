# Installation Guide - Inventory Management Dashboard

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v5 or higher) - [Download here](https://www.mongodb.com/try/download/community)
- **Git** (optional) - [Download here](https://git-scm.com/)

## Step-by-Step Installation

### 1. Install MongoDB

#### Windows:
1. Download MongoDB Community Server from the official website
2. Run the installer and follow the installation wizard
3. MongoDB will start automatically as a Windows service
4. Verify installation by opening Command Prompt and typing:
   ```bash
   mongod --version
   ```

#### Alternative: Use MongoDB Atlas (Cloud)
If you prefer not to install MongoDB locally, you can use MongoDB Atlas (free tier):
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster
4. Get your connection string
5. Update the `.env` file with your Atlas connection string

### 2. Install Project Dependencies

Open your terminal/command prompt in the project directory and run:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/inventory-dashboard
NODE_ENV=development
```

Create a `.env` file in the `client` directory:

```env
VITE_API_URL=http://localhost:5000/api
```

**Note:** If using MongoDB Atlas, replace the MONGODB_URI with your Atlas connection string:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inventory-dashboard
```

### 4. Start the Application

#### Option 1: Start Both Servers Together (Recommended)
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend server on `http://localhost:5173`

#### Option 2: Start Servers Separately

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

### 5. Access the Application

Open your web browser and navigate to:
```
http://localhost:5173
```

## Initial Setup

### 1. Add Brands
1. Navigate to "Brands & Categories" from the sidebar
2. Click "Add Brand"
3. Add brands like: Icon, Local Rugby Brand, Custom In-House

### 2. Add Categories
1. Stay on "Brands & Categories" page
2. Switch to "Categories" tab
3. Click "Add Category"
4. Add categories like: Hoodies, Trousers, Jerseys, Sweatshirts

### 3. Add Customers
1. Navigate to "Customers" from the sidebar
2. Click "Add Customer"
3. Fill in customer details (name, market, contact, type)

### 4. Add Inventory
1. Navigate to "Inventory" from the sidebar
2. Click "Add Stock"
3. Fill in product details (brand, category, sizes, cost, price)

### 5. Create Sales
1. Navigate to "Sales & Credit" from the sidebar
2. Click "New Sale"
3. Select customer, add items, specify payment

### 6. Track Production
1. Navigate to "Production" from the sidebar
2. Click "New Production Batch"
3. Fill in batch details
4. Update status as production progresses
5. Move completed batches to inventory

## Troubleshooting

### MongoDB Connection Issues

**Error: "MongooseServerSelectionError"**
- Ensure MongoDB is running:
  ```bash
  # Windows (if not running as service)
  mongod
  
  # Check if MongoDB is running
  mongo --eval "db.version()"
  ```

### Port Already in Use

**Error: "Port 5000 is already in use"**
- Change the PORT in `.env` file to another port (e.g., 5001)
- Or kill the process using the port:
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```

### Module Not Found Errors

**Error: "Cannot find module"**
- Delete `node_modules` folders and reinstall:
  ```bash
  rm -rf node_modules client/node_modules
  npm run install-all
  ```

### Frontend Not Loading

**Error: "Failed to fetch"**
- Ensure backend server is running
- Check if VITE_API_URL in `client/.env` is correct
- Verify CORS is enabled in backend

## Development Tips

### Hot Reload
Both frontend and backend support hot reload:
- Backend: Uses `nodemon` - saves automatically restart server
- Frontend: Uses Vite - changes reflect immediately

### Database Management

**View Database:**
```bash
# Using MongoDB Shell
mongo
use inventory-dashboard
db.inventory.find().pretty()
```

**Clear Database:**
```bash
mongo
use inventory-dashboard
db.dropDatabase()
```

### Sample Data

To add sample data for testing, you can use the MongoDB shell or create a seed script.

## Production Deployment

### Backend Deployment (Render/Heroku)
1. Create account on Render.com or Heroku
2. Connect your GitHub repository
3. Set environment variables
4. Deploy

### Frontend Deployment (Vercel/Netlify)
1. Build the frontend:
   ```bash
   cd client
   npm run build
   ```
2. Deploy the `dist` folder to Vercel or Netlify
3. Update API URL to your backend URL

### Database (MongoDB Atlas)
1. Use MongoDB Atlas for production database
2. Update MONGODB_URI in production environment variables
3. Whitelist your deployment server's IP address

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the README.md file
3. Check MongoDB and Node.js documentation

## Next Steps

After successful installation:
1. Explore the Dashboard to see overview statistics
2. Add your first brand and category
3. Create inventory items
4. Register customers
5. Make your first sale
6. Track production batches
7. View reports and analytics

Enjoy using your Inventory Management Dashboard! 🎉

