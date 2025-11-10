# Inventory Management Dashboard

A comprehensive garment inventory management system for tracking stock, managing credit sales, and monitoring production.

## Features

- **Inventory Management**: Track stock with brand, category, size, and quantity details
- **Brand & Category Management**: Organize products efficiently
- **Customer & Credit Sales**: Manage walk-in and credit-based transactions
- **Production Module**: Track in-house production from order to completion
- **Sales & Payment Summary**: Financial analytics with visual reports
- **Dashboard Overview**: Real-time insights and key metrics

## Technology Stack

- **Frontend**: React.js + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Charts**: Recharts
- **UI Components**: Custom components with modern design

## Installation

1. Install all dependencies:
```bash
npm run install-all
```

2. Create `.env` file in root directory:
```bash
cp .env.example .env
```

3. Update MongoDB URI in `.env` file

4. Start development servers:
```bash
npm run dev
```

The application will run on:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Project Structure

```
inventory-dashboard/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── App.jsx        # Main app component
├── server/                # Express backend
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   └── index.js           # Server entry point
└── package.json
```

## Usage

### Adding Stock
1. Navigate to Inventory module
2. Click "Add Stock" button
3. Fill in product details (brand, category, sizes, cost)
4. Submit to add to inventory

### Managing Credit Sales
1. Go to Credit Sales module
2. Register customer if new
3. Create sale transaction
4. Record partial or full payments

### Production Tracking
1. Access Production module
2. Create new production batch
3. Track progress through stages
4. Move completed items to inventory

## Future Enhancements

- Barcode scanning
- SMS reminders for credit payments
- Expense & profit analytics
- Vendor management
- Multi-location support

## License

ISC
