import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Image as ImageIcon, Eye, EyeOff, ArrowUp, ArrowDown, Package, Tag, ShoppingBag } from 'lucide-react';
import { getSliders, createSlider, updateSlider, deleteSlider, reorderSliders, getInventory, getBrands, getCategories } from '../services/api';
import ImageUpload from '../components/ImageUpload';

const Slider = () => {
  const [sliders, setSliders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSlider, setEditingSlider] = useState(null);

  const [formData, setFormData] = useState({
    heading: '',
    subheading: '',
    ctaText: '',
    ctaLink: '',
    imageUrl: '',
    status: true,
    order: 0,
    // Product linking fields
    linkType: 'none', // 'none', 'product', 'products', 'category', 'brand', 'custom'
    productId: '', // Single product (for backward compatibility)
    productIds: [], // Multiple products (array)
    categoryId: '',
    brandId: '',
    filterQuery: '' // Custom search/filter query
  });

  useEffect(() => {
    fetchSliders();
    fetchProductsAndFilters();
  }, []);

  const fetchProductsAndFilters = async () => {
    try {
      const [invRes, brandsRes, catsRes] = await Promise.all([
        getInventory(),
        getBrands(),
        getCategories()
      ]);
      setInventory(invRes.data.filter(item => item.onlineStatus === true)); // Only online products
      setBrands(brandsRes.data);
      setCategories(catsRes.data);
    } catch (error) {
    }
  };

  const fetchSliders = async () => {
    try {
      setLoading(true);
      const response = await getSliders();
      setSliders(response.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSlider) {
        await updateSlider(editingSlider.id || editingSlider._id, formData);
      } else {
        // Set order to last position for new items
        const newOrder = sliders.length > 0 ? Math.max(...sliders.map(s => s.order || 0)) + 1 : 0;
        await createSlider({ ...formData, order: newOrder });
      }
      setShowModal(false);
      resetForm();
      fetchSliders();
    } catch (error) {
      alert(error.message || 'Error saving slider');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (slider) => {
    setEditingSlider(slider);
    // Determine link type from existing data
    let linkType = 'none';
    if (slider.productIds && slider.productIds.length > 0) {
      linkType = slider.productIds.length === 1 ? 'product' : 'products';
    } else if (slider.productId) {
      linkType = 'product';
    } else if (slider.categoryId) linkType = 'category';
    else if (slider.brandId) linkType = 'brand';
    else if (slider.filterQuery) linkType = 'custom';

    // Convert single productId to array if needed
    const productIds = slider.productIds || (slider.productId ? [slider.productId] : []);

    setFormData({
      heading: slider.heading || '',
      subheading: slider.subheading || '',
      ctaText: slider.ctaText || '',
      ctaLink: slider.ctaLink || '',
      imageUrl: slider.imageUrl || '',
      status: slider.status !== undefined ? slider.status : true,
      order: slider.order || 0,
      linkType: linkType,
      productId: slider.productId || '',
      productIds: productIds,
      categoryId: slider.categoryId || '',
      brandId: slider.brandId || '',
      filterQuery: slider.filterQuery || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this slider?')) {
      return;
    }
    setDeleting(id);
    try {
      await deleteSlider(id);
      fetchSliders();
    } catch (error) {
      alert(error.message || 'Error deleting slider');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleStatus = async (slider) => {
    try {
      await updateSlider(slider.id || slider._id, {
        ...slider,
        status: !slider.status
      });
      fetchSliders();
    } catch (error) {
      alert(error.message || 'Error updating status');
    }
  };

  const handleMove = async (slider, direction) => {
    const currentIndex = sliders.findIndex(s => (s.id || s._id) === (slider.id || slider._id));
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= sliders.length) return;

    const newSliders = [...sliders];
    const [moved] = newSliders.splice(currentIndex, 1);
    newSliders.splice(newIndex, 0, moved);

    // Update orders
    const updates = newSliders.map((s, index) => ({
      id: s.id || s._id,
      order: index
    }));

    try {
      await reorderSliders(updates);
      fetchSliders();
    } catch (error) {
      alert(error.message || 'Error reordering sliders');
    }
  };

  const resetForm = () => {
    setFormData({
      heading: '',
      subheading: '',
      ctaText: '',
      ctaLink: '',
      imageUrl: '',
      status: true,
      order: 0,
      linkType: 'none',
      productId: '',
      productIds: [],
      categoryId: '',
      brandId: '',
      filterQuery: ''
    });
    setEditingSlider(null);
  };

  // Sort sliders by order
  const sortedSliders = [...sliders].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Homepage Slider</h2>
          <p className="text-gray-600 mt-1">Manage your homepage banner slider</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Slider Item
        </button>
      </div>

      {/* Sliders List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : sortedSliders.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <ImageIcon size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No slider items found. Add your first slider!</p>
          </div>
        ) : (
          sortedSliders.map((slider, index) => (
            <div key={slider.id || slider._id} className="card hover:shadow-md transition-shadow">
              {/* Preview Image */}
              <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden bg-gray-200">
                {slider.imageUrl ? (
                  <img
                    src={slider.imageUrl}
                    alt={slider.heading}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={48} className="text-gray-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${slider.status
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                    }`}>
                    {slider.status ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Slider Info */}
              <div className="space-y-2 mb-4">
                <h3 className="font-semibold text-gray-800 text-lg">{slider.heading || 'No Heading'}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{slider.subheading || 'No subheading'}</p>
                {slider.ctaText && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">CTA:</span>
                    <span className="font-medium text-primary-600">{slider.ctaText}</span>
                    {slider.ctaLink && (
                      <span className="text-gray-400">→ {slider.ctaLink}</span>
                    )}
                  </div>
                )}
                {/* Product Link Info */}
                {(() => {
                  // Check for multiple products first
                  if (slider.productIds && slider.productIds.length > 0) {
                    const linkedProducts = inventory.filter(p =>
                      slider.productIds.includes(p.id || p._id)
                    );
                    return (
                      <div className="flex items-center gap-2 text-xs text-blue-600 mt-2">
                        <Package size={14} />
                        <span>
                          Links to {linkedProducts.length} product{linkedProducts.length !== 1 ? 's' : ''}:
                          {linkedProducts.slice(0, 3).map(p => p.productName).join(', ')}
                          {linkedProducts.length > 3 && ` +${linkedProducts.length - 3} more`}
                        </span>
                      </div>
                    );
                  } else if (slider.productId) {
                    const product = inventory.find(p => (p.id || p._id) === slider.productId);
                    return (
                      <div className="flex items-center gap-2 text-xs text-blue-600 mt-2">
                        <Package size={14} />
                        <span>Links to: {product?.productName || 'Product'}</span>
                      </div>
                    );
                  } else if (slider.categoryId) {
                    const category = categories.find(c => (c.id || c._id) === slider.categoryId);
                    return (
                      <div className="flex items-center gap-2 text-xs text-blue-600 mt-2">
                        <Tag size={14} />
                        <span>Links to Category: {category?.name || 'Category'}</span>
                      </div>
                    );
                  } else if (slider.brandId) {
                    const brand = brands.find(b => (b.id || b._id) === slider.brandId);
                    return (
                      <div className="flex items-center gap-2 text-xs text-blue-600 mt-2">
                        <ShoppingBag size={14} />
                        <span>Links to Brand: {brand?.name || 'Brand'}</span>
                      </div>
                    );
                  } else if (slider.filterQuery) {
                    return (
                      <div className="flex items-center gap-2 text-xs text-blue-600 mt-2">
                        <span>🔍 Custom Filter: {slider.filterQuery}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="text-xs text-gray-500">
                  Order: {slider.order || 0}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleMove(slider, 'up')}
                  disabled={index === 0}
                  className="btn-secondary text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Move Up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => handleMove(slider, 'down')}
                  disabled={index === sortedSliders.length - 1}
                  className="btn-secondary text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Move Down"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  onClick={() => handleToggleStatus(slider)}
                  className={`btn-secondary text-sm py-2 px-3 flex-1 ${slider.status ? 'text-orange-600' : 'text-green-600'
                    }`}
                  title={slider.status ? 'Deactivate' : 'Activate'}
                >
                  {slider.status ? <EyeOff size={16} className="inline mr-1" /> : <Eye size={16} className="inline mr-1" />}
                  {slider.status ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => handleEdit(slider)}
                  className="btn-secondary text-sm py-2 px-3"
                  disabled={deleting === (slider.id || slider._id)}
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(slider.id || slider._id)}
                  className="btn-danger text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleting === (slider.id || slider._id)}
                  title="Delete"
                >
                  {deleting === (slider.id || slider._id) ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Trash2 size={16} />
                  )}
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
                {editingSlider ? 'Edit Slider Item' : 'Add New Slider Item'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Background Image */}
              <ImageUpload
                imageUrl={formData.imageUrl}
                onImageChange={(url) => setFormData({ ...formData, imageUrl: url })}
                label="Background Image *"
                folder="upload pics/slider"
                disabled={saving}
              />

              {/* Heading */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heading *</label>
                <input
                  type="text"
                  required
                  value={formData.heading}
                  onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                  className="input-field"
                  placeholder="e.g., New Collection 2025"
                />
                <p className="text-xs text-gray-500 mt-1">Main heading text for the slider</p>
              </div>

              {/* Subheading */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subheading</label>
                <textarea
                  value={formData.subheading}
                  onChange={(e) => setFormData({ ...formData, subheading: e.target.value })}
                  className="input-field"
                  rows="2"
                  placeholder="e.g., Discover our latest fashion trends"
                />
                <p className="text-xs text-gray-500 mt-1">Supporting text below the heading</p>
              </div>

              {/* CTA Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Shop Now"
                  />
                  <p className="text-xs text-gray-500 mt-1">Button text (optional)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Link</label>
                  <input
                    type="text"
                    value={formData.ctaLink}
                    onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                    className="input-field"
                    placeholder="e.g., /products or https://example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Link URL (optional)</p>
                </div>
              </div>

              {/* Product Linking Section */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Package size={20} />
                  <span>Product Linking</span>
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Link this slider to products. When users click/tap the slider, they'll see related products on your website.
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Link Type</label>
                  <select
                    value={formData.linkType}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        linkType: e.target.value,
                        productId: '',
                        productIds: [],
                        categoryId: '',
                        brandId: '',
                        filterQuery: ''
                      });
                    }}
                    className="input-field"
                  >
                    <option value="none">No Link (Use CTA Link only)</option>
                    <option value="product">Link to Single Product</option>
                    <option value="products">Link to Multiple Products</option>
                    <option value="category">Link to Category</option>
                    <option value="brand">Link to Brand</option>
                    <option value="custom">Custom Filter/Search</option>
                  </select>
                </div>

                {/* Single Product Selection */}
                {formData.linkType === 'product' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
                    <select
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value, productIds: e.target.value ? [e.target.value] : [] })}
                      className="input-field"
                    >
                      <option value="">Select a product...</option>
                      {inventory.map(product => (
                        <option key={product.id || product._id} value={product.id || product._id}>
                          {product.productName} {product.sku ? `(${product.sku})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Only products with "Show on website" enabled are listed
                    </p>
                  </div>
                )}

                {/* Multiple Products Selection */}
                {formData.linkType === 'products' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Products ({formData.productIds.length} selected)
                    </label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto bg-gray-50">
                      {inventory.length === 0 ? (
                        <p className="text-sm text-gray-500">No products available</p>
                      ) : (
                        <div className="space-y-2">
                          {inventory.map(product => {
                            const isSelected = formData.productIds.includes(product.id || product._id);
                            return (
                              <label
                                key={product.id || product._id}
                                className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const productId = product.id || product._id;
                                    if (e.target.checked) {
                                      setFormData({
                                        ...formData,
                                        productIds: [...formData.productIds, productId]
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        productIds: formData.productIds.filter(id => id !== productId)
                                      });
                                    }
                                  }}
                                  className="w-4 h-4 text-primary-600 rounded"
                                />
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-700">
                                    {product.productName}
                                  </span>
                                  {product.sku && (
                                    <span className="text-xs text-gray-500 ml-2">({product.sku})</span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Select multiple products. When slider is clicked, all selected products will be displayed.
                    </p>
                    {formData.productIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.productIds.map(productId => {
                          const product = inventory.find(p => (p.id || p._id) === productId);
                          return product ? (
                            <span
                              key={productId}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                            >
                              {product.productName}
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    productIds: formData.productIds.filter(id => id !== productId)
                                  });
                                }}
                                className="hover:text-blue-900"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Category Selection */}
                {formData.linkType === 'category' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Category</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Select a category...</option>
                      {categories.map(category => (
                        <option key={category.id || category._id} value={category.id || category._id}>
                          {category.name} {category.brandId && `(${brands.find(b => (b.id || b._id) === category.brandId)?.name || ''})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Brand Selection */}
                {formData.linkType === 'brand' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Brand</label>
                    <select
                      value={formData.brandId}
                      onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Select a brand...</option>
                      {brands.map(brand => (
                        <option key={brand.id || brand._id} value={brand.id || brand._id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom Filter */}
                {formData.linkType === 'custom' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Filter Query</label>
                    <input
                      type="text"
                      value={formData.filterQuery}
                      onChange={(e) => setFormData({ ...formData, filterQuery: e.target.value })}
                      className="input-field"
                      placeholder="e.g., new arrivals, sale items, price<5000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter a search term or filter criteria. Your website will use this to filter products.
                    </p>
                  </div>
                )}

                {formData.linkType !== 'none' && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700">
                      💡 <strong>Website Implementation:</strong> When this slider is clicked, your website should:
                      {formData.linkType === 'product' && ' Navigate to the product detail page'}
                      {formData.linkType === 'products' && ` Display all ${formData.productIds.length} selected products`}
                      {formData.linkType === 'category' && ' Show all products in this category'}
                      {formData.linkType === 'brand' && ' Show all products from this brand'}
                      {formData.linkType === 'custom' && ' Filter products using the custom query'}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="status"
                  checked={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="status" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                  Active (Show on homepage)
                </label>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${formData.status
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
                  }`}>
                  {formData.status ? 'Active' : 'Inactive'}
                </span>
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
                      <span>{editingSlider ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <span>{editingSlider ? 'Update' : 'Create'} Slider</span>
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

export default Slider;
