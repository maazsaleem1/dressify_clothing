import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import BrandsCategories from './pages/BrandsCategories';
import Customers from './pages/Customers';
import Sales from './pages/Sales';
import Production from './pages/Production';
import Reports from './pages/Reports';
import Slider from './pages/Slider';
import Orders from './pages/Orders';
import Reviews from './pages/Reviews';

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/brands-categories" element={<BrandsCategories />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/production" element={<Production />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/slider" element={<Slider />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/reviews" element={<Reviews />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

