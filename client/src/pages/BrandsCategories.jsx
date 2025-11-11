import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, Package } from 'lucide-react';
import { getBrands, getCategories, createBrand, createCategory, updateBrand, updateCategory, deleteBrand, deleteCategory } from '../services/api';

const BrandsCategories = () => {
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('brands');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalType, setModalType] = useState('brand');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brandId: '',
    parentCategoryId: ''
  });
  const [parentCategories, setParentCategories] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-fetch parent categories when brand is selected in category modal
  useEffect(() => {
    if (showModal && modalType === 'category' && formData.brandId) {
      fetchParentCategories(formData.brandId);
    }
  }, [formData.brandId, showModal, modalType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [brandsRes, catsRes] = await Promise.all([
        getBrands(),
        getCategories()
      ]);
      setBrands(brandsRes.data);
      setCategories(catsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParentCategories = async (brandId) => {
    if (!brandId) {
      setParentCategories([]);
      return;
    }
    try {
      console.log('Fetching parent categories for brandId:', brandId);
      const res = await getCategories({ brandId, mainCategoriesOnly: true });
      console.log('Parent categories received:', res.data);
      setParentCategories(res.data);
    } catch (error) {
      console.error('Error fetching parent categories:', error);
      setParentCategories([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    try {
      if (modalType === 'brand') {
        if (editingItem) {
          await updateBrand(editingItem.id || editingItem._id, formData);
        } else {
          await createBrand(formData);
        }
      } else {
        const categoryData = {
          name: formData.name,
          description: formData.description,
          brandId: formData.brandId || null,
          parentCategoryId: formData.parentCategoryId || null
        };

        const isMainCategory = !formData.parentCategoryId;
        const brandId = formData.brandId;

        if (editingItem) {
          await updateCategory(editingItem.id || editingItem._id, categoryData);
        } else {
          await createCategory(categoryData);
        }

        // Refresh parent categories if a main category was created/updated
        if (isMainCategory && brandId) {
          await fetchParentCategories(brandId);
        }
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      alert(error.message || error.response?.data?.error || 'Error saving item');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item, type) => {
    setEditingItem(item);
    setModalType(type);
    setFormData({
      name: item.name,
      description: item.description || '',
      brandId: item.brandId || '',
      parentCategoryId: item.parentCategoryId || ''
    });

    // Fetch parent categories if editing a category
    if (type === 'category' && item.brandId) {
      fetchParentCategories(item.brandId);
    }

    setShowModal(true);
  };

  const handleDelete = async (id, type) => {
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      try {
        if (type === 'brand') {
          await deleteBrand(id);
        } else {
          await deleteCategory(id);
        }
        fetchData();
      } catch (error) {
        console.error('Error deleting:', error);
        alert(error.message || error.response?.data?.error || 'Error deleting item');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      brandId: '',
      parentCategoryId: ''
    });
    setEditingItem(null);
    setParentCategories([]);
  };

  const openAddModal = (type) => {
    resetForm();
    setModalType(type);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Brands & Categories</h2>
        <p className="text-gray-600 mt-1">Organize your inventory with brands and categories</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('brands')}
          className={`px-6 py-3 font-medium transition-colors ${activeTab === 'brands'
            ? 'text-primary-600 border-b-2 border-primary-600'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          <div className="flex items-center gap-2">
            <Tag size={20} />
            Brands ({brands.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-6 py-3 font-medium transition-colors ${activeTab === 'categories'
            ? 'text-primary-600 border-b-2 border-primary-600'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          <div className="flex items-center gap-2">
            <Package size={20} />
            Categories ({categories.length})
          </div>
        </button>
      </div>

      {/* Brands Tab */}
      {activeTab === 'brands' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openAddModal('brand')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              Add Brand
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : brands.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Tag size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No brands found. Add your first brand!</p>
              </div>
            ) : (
              brands.map((brand) => (
                <div key={brand.id || brand._id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        {brand.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">{brand.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${brand.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                          {brand.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {brand.description && (
                    <p className="text-sm text-gray-600 mb-4">{brand.description}</p>
                  )}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(brand, 'brand')}
                      className="flex-1 btn-secondary text-sm py-2"
                    >
                      <Edit2 size={16} className="inline mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id || brand._id, 'brand')}
                      className="flex-1 btn-danger text-sm py-2"
                    >
                      <Trash2 size={16} className="inline mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openAddModal('category')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              Add Category
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : categories.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Package size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No categories found. Add your first category!</p>
              </div>
            ) : (
              categories.map((category) => {
                const brand = brands.find(b => (b.id || b._id) === category.brandId);
                const parentCategory = category.parentCategoryId
                  ? categories.find(c => (c.id || c._id) === category.parentCategoryId)
                  : null;

                return (
                  <div key={category.id || category._id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          {category.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800 text-lg">{category.name}</h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {brand && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                {brand.name}
                              </span>
                            )}
                            {parentCategory && (
                              <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                                Sub: {parentCategory.name}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full ${category.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                              {category.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {category.description && (
                      <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                    )}
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleEdit(category, 'category')}
                        className="flex-1 btn-secondary text-sm py-2"
                      >
                        <Edit2 size={16} className="inline mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category.id || category._id, 'category')}
                        className="flex-1 btn-danger text-sm py-2"
                      >
                        <Trash2 size={16} className="inline mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {editingItem ? 'Edit' : 'Add New'} {modalType === 'brand' ? 'Brand' : 'Category'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Brand Selection - Only for Categories */}
              {modalType === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <select
                    required
                    value={formData.brandId}
                    onChange={async (e) => {
                      const brandId = e.target.value;
                      setFormData({ ...formData, brandId, parentCategoryId: '' });
                      await fetchParentCategories(brandId);
                    }}
                    className="input-field"
                    disabled={saving}
                  >
                    <option value="">Select Brand</option>
                    {brands.map(brand => (
                      <option key={brand.id || brand._id} value={brand.id || brand._id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select the brand this category belongs to</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder={`e.g., ${modalType === 'brand' ? 'Icon' : 'Hoodies'}`}
                  disabled={saving}
                />
              </div>

              {/* Parent Category - Optional, makes it a subcategory if selected */}
              {modalType === 'category' && formData.brandId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Category <span className="text-gray-400">(Optional)</span>
                  </label>
                  <select
                    value={formData.parentCategoryId}
                    onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
                    className="input-field"
                    disabled={saving || !formData.brandId}
                  >
                    <option value="">None (Main Category)</option>
                    {parentCategories.length === 0 ? (
                      <option value="" disabled>No main categories available. Create a main category first.</option>
                    ) : (
                      parentCategories.map(cat => (
                        <option key={cat.id || cat._id} value={cat.id || cat._id}>
                          {cat.name}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.parentCategoryId
                      ? "This will be created as a subcategory"
                      : parentCategories.length === 0
                        ? "⚠️ No main categories found for this brand. Leave empty to create a main category."
                        : "Leave empty to create a main category, or select a parent to create a subcategory"}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Optional description..."
                  disabled={saving}
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
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{editingItem ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Update' : 'Create'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandsCategories;

