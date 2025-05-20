import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function ProductDetails() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      try {
        const productResponse = await fetch(`http://localhost:8000/product/${productId}`);
        if (!productResponse.ok) {
          throw new Error('Network response was not ok for product');
        }
        const productData = await productResponse.json();
        setProduct(productData);

        const reviewsResponse = await fetch(`http://localhost:8000/product/${productId}/reviews?page=${currentPage}`);
        if (!reviewsResponse.ok) {
          throw new Error('Network response was not ok for reviews');
        }
        const reviewsData = await reviewsResponse.json();
        setReviewsData(reviewsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [productId, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!product) return <p>No product found.</p>;

  // Generate pagination buttons
  const totalPages = reviewsData?.paging?.last_page || 1;
  const pageButtons = [];
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    pageButtons.push(
      <button
        key={i}
        onClick={() => handlePageChange(i)}
        className={currentPage === i ? 'pagination-button active' : 'pagination-button'}
      >
        {i}
      </button>
    );
  }

  return (
    <div className="product-details">
      <Link to="/" className="back-link">← Back to Search</Link>
      <h1>{product.name}</h1>
      <p><strong>Price:</strong> {product.price.toLocaleString()} VND</p>
      <h2>Description</h2>
      <div dangerouslySetInnerHTML={{ __html: product.description }} />
      <h2>Specifications</h2>
      {product.specifications && product.specifications.length > 0 ? (
        <table className="specifications-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {product.specifications.map((spec, specIndex) => (
              spec.attributes.map((attr, attrIndex) => (
                <tr key={`${specIndex}-${attrIndex}`}>
                  <td>{attr.name}</td>
                  <td>{attr.value}</td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      ) : (
        <p>No specifications available.</p>
      )}
      <h2>Reviews</h2>
      {reviewsData ? (
        <div className="reviews-section">
          <p><strong>Total Reviews:</strong> {reviewsData.reviews_count}</p>
          <p><strong>Average Rating:</strong> {reviewsData.rating_average.toFixed(1)} stars</p>
          <h3>Star Distribution</h3>
          <table className="star-distribution-table">
            <thead>
              <tr>
                <th>Stars</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {[5, 4, 3, 2, 1].map((star) => (
                <tr key={star}>
                  <td>{star} Star{star !== 1 ? 's' : ''}</td>
                  <td>{reviewsData.stars[star]?.count || 0}</td>
                  <td>{reviewsData.stars[star]?.percent || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Review Details</h3>
          {reviewsData.reviews && reviewsData.reviews.length > 0 ? (
            <>
              <table className="reviews-table">
                <thead>
                  <tr>
                    <th>Reviewer</th>
                    <th>Rating</th>
                    <th>Title</th>
                    <th>Content</th>
                    <th>Attributes</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewsData.reviews.slice(0, 10).map((review) => (
                    <tr key={review.id}>
                      <td>{review.created_by.name}</td>
                      <td>{review.rating} Star{review.rating !== 1 ? 's' : ''}</td>
                      <td>{review.title}</td>
                      <td>{review.content || 'No content'}</td>
                      <td>{review.vote_attributes.agree.join(', ') || 'None'}</td>
                      <td>{new Date(review.created_at * 1000).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="pagination">
                  {pageButtons}
                </div>
              )}
            </>
          ) : (
            <p>No reviews available.</p>
          )}
        </div>
      ) : (
        <p>No reviews data available.</p>
      )}
    </div>
  );
}

export default ProductDetails;