import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Factory, ArrowRight } from 'lucide-react';
import { getProductions, getCategories, getBrands, createProduction, updateProduction, moveToInventory, deleteProduction } from '../services/api';

const Production = () => {
  const [productions, setProductions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduction, setEditingProduction] = useState(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('');

  const [formData, setFormData] = useState({
    batchName: '',
    category: '',
    productName: '',
    totalQuantity: 0,
    sizeBreakdown: [
      { size: 'S', quantity: 0 },
      { size: 'M', quantity: 0 },
      { size: 'L', quantity: 0 },
      { size: 'XL', quantity: 0 }
    ],
    costPerUnit: '',
    sellingPrice: '',
    status: 'Ordered',
    expectedCompletionDate: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catsRes, brandsRes] = await Promise.all([
        getProductions(),
        getCategories(),
        getBrands()
      ]);
      setProductions(prodRes.data);
      setCategories(catsRes.data);
      setBrands(brandsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const filteredSizes = formData.sizeBreakdown.filter(s => s.quantity > 0);
      const totalQty = filteredSizes.reduce((sum, s) => sum + s.quantity, 0);
      
      const dataToSubmit = {
        ...formData,
        totalQuantity: totalQty,
        sizeBreakdown: filteredSizes
      };

      if (editingProduction) {
        await updateProduction(editingProduction._id, dataToSubmit);
      } else {
        await createProduction(dataToSubmit);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving production:', error);
      alert(error.response?.data?.error || 'Error saving production batch');
    }
  };

  const handleMoveToInventory = async () => {
    if (!selectedBrand) {
      alert('Please select a brand');
      return;
    }
    try {
      await moveToInventory(selectedProduction._id, { brandId: selectedBrand });
      setShowMoveModal(false);
      setSelectedProduction(null);
      setSelectedBrand('');
      fetchData();
    } catch (error) {
      console.error('Error moving to inventory:', error);
      alert(error.response?.data?.error || 'Error moving to inventory');
    }
  };

  const handleEdit = (production) => {
    setEditingProduction(production);
    setFormData({
      batchName: production.batchName,
      category: production.category._id,
      productName: production.productName,
      totalQuantity: production.totalQuantity,
      sizeBreakdown: production.sizeBreakdown.length > 0 ? production.sizeBreakdown : [
        { size: 'S', quantity: 0 },
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 0 },
        { size: 'XL', quantity: 0 }
      ],
      costPerUnit: production.costPerUnit,
      sellingPrice: production.sellingPrice,
      status: production.status,
      expectedCompletionDate: production.expectedCompletionDate ? 
        new Date(production.expectedCompletionDate).toISOString().split('T')[0] : '',
      notes: production.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this production batch?')) {
      try {
        await deleteProduction(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting production:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      batchName: '',
      category: '',
      productName: '',
      totalQuantity: 0,
      sizeBreakdown: [
        { size: 'S', quantity: 0 },
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 0 },
        { size: 'XL', quantity: 0 }
      ],
      costPerUnit: '',
      sellingPrice: '',
      status: 'Ordered',
      expectedCompletionDate: '',
      notes: ''
    });
    setEditingProduction(null);
  };

  const handleSizeChange = (index, value) => {
    const newSizes = [...formData.sizeBreakdown];
    newSizes[index].quantity = parseInt(value) || 0;
    setFormData({ ...formData, sizeBreakdown: newSizes });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ordered': return 'bg-blue-100 text-blue-700';
      case 'In Process': return 'bg-yellow-100 text-yellow-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'Added to Stock': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getProgressPercentage = (status) => {
    switch (status) {
      case 'Ordered': return 25;
      case 'In Process': return 50;
      case 'Completed': return 75;
      case 'Added to Stock': return 100;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Production Management</h2>
          <p className="text-gray-600 mt-1">Track in-house production batches</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          New Production Batch
        </button>
      </div>

      {/* Production Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : productions.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Factory size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No production batches found</p>
          </div>
        ) : (
          productions.map((production) => (
            <div key={production._id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{production.batchName}</h3>
                  <p className="text-sm text-gray-600">{production.batchNumber}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(production.status)}`}>
                  {production.status}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Product</p>
                    <p className="font-medium text-gray-800">{production.productName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Category</p>
                    <p className="font-medium text-gray-800">{production.category?.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Total Quantity</p>
                    <p className="text-xl font-bold text-gray-900">{production.totalQuantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Cost Per Unit</p>
                    <p className="font-medium text-gray-800">Rs. {production.costPerUnit.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-2">Size Breakdown</p>
                  <div className="flex flex-wrap gap-2">
                    {production.sizeBreakdown.map((size, idx) => (
                      <span key={idx} className="px-3 py-1 bg-gray-100 text-sm rounded-lg">
                        {size.size}: {size.quantity}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{getProgressPercentage(production.status)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${getProgressPercentage(production.status)}%` }}
                    ></div>
                  </div>
                </div>

                {production.expectedCompletionDate && (
                  <div>
                    <p className="text-xs text-gray-600">Expected Completion</p>
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(production.expectedCompletionDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-100">
                {production.status === 'Completed' && !production.addedToInventory && (
                  <button
                    onClick={() => {
                      setSelectedProduction(production);
                      setShowMoveModal(true);
                    }}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={16} />
                    Move to Inventory
                  </button>
                )}
                <button
                  onClick={() => handleEdit(production)}
                  className="flex-1 btn-secondary text-sm py-2"
                >
                  <Edit2 size={16} className="inline mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(production._id)}
                  className="btn-danger text-sm py-2 px-3"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {editingProduction ? 'Edit Production Batch' : 'New Production Batch'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.batchName}
                    onChange={(e) => setFormData({ ...formData, batchName: e.target.value })}
                    className="input-field"
                    placeholder="Winter 2025 Sweatshirts"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="input-field"
                  placeholder="Premium Sweatshirt"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Size Breakdown</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.sizeBreakdown.map((size, index) => (
                    <div key={index}>
                      <label className="block text-xs text-gray-600 mb-1">Size {size.size}</label>
                      <input
                        type="number"
                        min="0"
                        value={size.quantity}
                        onChange={(e) => handleSizeChange(index, e.target.value)}
                        className="input-field"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Per Unit *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                    className="input-field"
                    placeholder="800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="input-field"
                    placeholder="1200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="Ordered">Ordered</option>
                    <option value="In Process">In Process</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={formData.expectedCompletionDate}
                    onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingProduction ? 'Update' : 'Create'} Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move to Inventory Modal */}
      {showMoveModal && selectedProduction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Move to Inventory</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Production Batch</p>
                <p className="font-bold text-gray-900">{selectedProduction.batchName}</p>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedProduction.totalQuantity} units will be added to inventory
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Brand *</label>
                <select
                  required
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="input-field"
                >
                  <option value="">Choose a brand</option>
                  {brands.map(brand => (
                    <option key={brand._id} value={brand._id}>{brand.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select which brand this production belongs to
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowMoveModal(false);
                    setSelectedProduction(null);
                    setSelectedBrand('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveToInventory}
                  className="btn-primary"
                >
                  Move to Inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Production;

