import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, XCircle, Trash2, Filter, Search, Clock, User, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { getReviews, updateReviewStatus, deleteReview } from '../services/api';

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchReviews();
  }, [filterStatus]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await getReviews(filterStatus ? { status: filterStatus } : {});
      setReviews(response.data);
    } catch (error) {
      alert('Error fetching reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reviewId) => {
    if (!window.confirm('Are you sure you want to approve this review?')) {
      return;
    }

    setUpdating(reviewId);
    try {
      await updateReviewStatus(reviewId, 'approved');
      fetchReviews();
    } catch (error) {
      alert('Error approving review');
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async (reviewId) => {
    if (!window.confirm('Are you sure you want to reject this review?')) {
      return;
    }

    setUpdating(reviewId);
    try {
      await updateReviewStatus(reviewId, 'rejected');
      fetchReviews();
    } catch (error) {
      alert('Error rejecting review');
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    setDeleting(reviewId);
    try {
      await deleteReview(reviewId);
      fetchReviews();
    } catch (error) {
      alert('Error deleting review');
    } finally {
      setDeleting(null);
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch =
      review.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.reviewTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.reviewText?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredReviews.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReviews = filteredReviews.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={20}
        className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
      />
    ));
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Product Reviews</h2>
          <p className="text-gray-600 mt-1">Manage and approve customer reviews</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search reviews by customer, product, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field pl-10"
            >
              <option value="">All Reviews</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="card text-center py-12">
          <Star size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg">No reviews found</p>
          <p className="text-gray-400 text-sm mt-2">
            {filterStatus ? `No ${filterStatus} reviews` : 'No reviews in the system'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedReviews.map((review) => (
            <div key={review.id || review._id} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Review Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                          {review.customerName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{review.customerName || 'Anonymous'}</h3>
                          <p className="text-xs text-gray-500">{review.customerEmail}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(review.status)}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                    <Package size={16} className="text-gray-400" />
                    <span className="font-medium">{review.productName}</span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-3">
                    {renderStars(review.rating || 0)}
                    <span className="text-sm text-gray-600 ml-2">({review.rating}/5)</span>
                  </div>

                  {/* Review Title */}
                  {review.reviewTitle && (
                    <h4 className="font-semibold text-gray-800 mb-2">{review.reviewTitle}</h4>
                  )}

                  {/* Review Text */}
                  <p className="text-gray-700 mb-3 whitespace-pre-wrap">{review.reviewText}</p>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={14} />
                    <span>
                      {review.createdAt
                        ? new Date(review.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                        : 'Date not available'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 md:w-48">
                  {review.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(review.id || review._id)}
                        disabled={updating === (review.id || review._id)}
                        className="btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === (review.id || review._id) ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            <span>Approve</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(review.id || review._id)}
                        disabled={updating === (review.id || review._id)}
                        className="btn-secondary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === (review.id || review._id) ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={16} />
                            <span>Reject</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                  {(review.status === 'approved' || review.status === 'rejected') && (
                    <button
                      onClick={() => handleDelete(review.id || review._id)}
                      disabled={deleting === (review.id || review._id)}
                      className="btn-danger text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting === (review.id || review._id) ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredReviews.length > itemsPerPage && (
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">{Math.min(endIndex, filteredReviews.length)}</span> of{' '}
            <span className="font-medium">{filteredReviews.length}</span> reviews
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg ${currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;
