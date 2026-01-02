import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, DollarSign, Calendar, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { ListItemShimmer } from '../components/Shimmer';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const expenseCategories = [
    'Tea & Food',
    'Labour',
    'Electricity',
    'Rent',
    'Transport',
    'Maintenance',
    'Other'
  ];

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Tea & Food',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [filterMonth, filterYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterMonth && filterMonth.trim() !== '' && filterYear) {
        const monthNum = parseInt(filterMonth);
        const yearNum = parseInt(filterYear);
        if (!isNaN(monthNum) && !isNaN(yearNum)) {
          filters.month = monthNum;
          filters.year = yearNum;
        }
      }
      const response = await getExpenses(filters);
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      showError(error.message || 'Error fetching expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';

    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (dateValue?.toDate) {
      date = dateValue.toDate();
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return 'N/A';
    }

    if (isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'Tea & Food',
      expenseDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setEditingExpense(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    const expenseDate = expense.expenseDate?.toDate ? expense.expenseDate.toDate() : new Date(expense.expenseDate);
    setFormData({
      description: expense.description || '',
      amount: expense.amount || '',
      category: expense.category || 'Tea & Food',
      expenseDate: expenseDate.toISOString().split('T')[0],
      notes: expense.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.description || !formData.amount) {
      showError('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id || editingExpense._id, formData);
        showSuccess('Expense updated successfully!');
      } else {
        await createExpense(formData);
        showSuccess('Expense added successfully!');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      showError(error.message || 'Error saving expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    setDeleting(id);
    try {
      await deleteExpense(id);
      showSuccess('Expense deleted successfully!');
      fetchData();
    } catch (error) {
      showError(error.message || 'Error deleting expense');
    } finally {
      setDeleting(null);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = !searchTerm ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Daily Expenses</h1>
          <p className="text-sm text-gray-600 mt-1">Track your shop expenses and manage daily costs</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow-md p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-100 text-sm">Total Expenses</p>
            <p className="text-3xl font-bold mt-1">Rs. {totalExpenses.toLocaleString()}</p>
            <p className="text-red-100 text-xs mt-1">
              {filterMonth ? `${months.find(m => m.value === filterMonth)?.label} ${filterYear}` : `All Time`}
            </p>
          </div>
          <DollarSign className="w-12 h-12 text-red-200" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="input-field"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="input-field"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <ListItemShimmer count={5} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-gray-500">
                        No expenses found. Add your first expense to get started.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((expense) => (
                      <tr key={expense.id || expense._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">{formatDate(expense.expenseDate)}</td>
                        <td className="py-3 px-4">{expense.description}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {expense.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-red-600">
                          Rs. {parseFloat(expense.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(expense)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Edit Expense"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(expense.id || expense._id)}
                              disabled={deleting === (expense.id || expense._id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Tea for staff, Labour payment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) *</label>
                  <input
                    type="text"
                    required
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setFormData({ ...formData, amount: value });
                      }
                    }}
                    className="input-field"
                    placeholder="0"
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
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Additional notes (optional)"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
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
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{editingExpense ? 'Updating...' : 'Adding...'}</span>
                    </>
                  ) : (
                    <span>{editingExpense ? 'Update Expense' : 'Add Expense'}</span>
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

export default Expenses;
