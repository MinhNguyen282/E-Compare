import React from 'react';
import { Link } from 'react-router-dom';

function ProductList({ products, onAddToCompare }) {
  return (
    <div style={{ width: '100%', padding: '20px' }}>
      <h2>Products</h2>
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          width: '100%'
        }}>
          {products.map((product) => (
            <div key={product.id} style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Link to={`/product/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3>{product.name}</h3>
              </Link>
              <p><strong>ID:</strong> {product.id}</p>
              <p><strong>Brand:</strong> {product.brand_name || 'Unknown'}</p>
              <p><strong>Price:</strong> {product.price.toLocaleString()} VND</p>
              <p><strong>Original Price:</strong> {product.original_price.toLocaleString()} VND</p>
              <p><strong>Reviews:</strong> {product.review_count}</p>
              <p><strong>Link:</strong> <a href={product.url_path} target="_blank" rel="noopener noreferrer">View on Tiki</a></p>
              <button
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => onAddToCompare(product)}
              >
                Add to Comparison Queue
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductList;