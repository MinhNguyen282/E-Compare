import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Search from './Search';
import ProductList from './ProductList';
import ReactMarkdown from 'react-markdown';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [comparisonQueue, setComparisonQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [language, setLanguage] = useState('en');
  const [comparisonPage, setComparisonPage] = useState(1);
  const productsPerPage = 3;
  const maxProducts = 5;
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const handleSearch = async (query) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from server');
      }
      setProducts(data);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search products. Please try again.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCompare = async (product) => {
    if (comparisonQueue.length >= maxProducts) {
      setError(`Maximum ${maxProducts} products can be compared at once`);
      return;
    }
    if (comparisonQueue.some(p => p.id === product.id)) {
      setError('Product is already in comparison queue');
      return;
    }

    try {
      // Fetch product details including specifications
      const response = await fetch(`${API_URL}/product/${product.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product details');
      }
      const productDetails = await response.json();
      
      // Combine the product data with its details
      const productWithDetails = {
        ...product,
        specifications: productDetails.specifications || []
      };
      
      setComparisonQueue([...comparisonQueue, productWithDetails]);
      setError(null);
    } catch (err) {
      console.error('Error adding product to comparison:', err);
      setError('Failed to add product to comparison. Please try again.');
    }
  };

  const handleRemoveFromCompare = (productId) => {
    setComparisonQueue(comparisonQueue.filter(p => p.id !== productId));
    setError(null);
  };

  const handleCompare = async () => {
    if (comparisonQueue.length < 2) {
      setError('Please add at least 2 products to compare');
      return;
    }

    setIsComparing(true);
    setError(null);
    try {
      const prompt = comparisonQueue.map((product, index) => {
        const specs = product.specifications
          ? product.specifications
              .map(spec => spec.attributes.map(attr => `${attr.name}: ${attr.value}`).join('\n'))
              .join('\n')
          : 'No specifications available';
        
        return `${index + 1}. ${product.name}
Price: ${product.price.toLocaleString()} VND
Brand: ${product.brand_name || 'Unknown'}
Specifications:
${specs}`;
      }).join('\n\n');

      const fullPrompt = language === 'en' 
        ? `Here are the list of products and attributes:\n\n${prompt}\n\nHelp me compare these products to find which is the best product. Consider price, specifications, and overall value for money.`
        : `Đây là các sản phẩm và thông tin của chúng:\n\n${prompt}\n\nHãy cho tôi biết ưu điểm và nhược điểm của mỗi sản phẩm và tôi nên mua sản phẩm nào nhất`;

      const response = await fetch(`${API_URL}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fullPrompt
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a few minutes.');
        } else if (response.status === 500) {
          throw new Error(errorData.detail || 'Failed to compare products. Please try again.');
        } else {
          throw new Error(`Comparison failed: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setComparisonResult(data.comparison);
    } catch (err) {
      console.error('Comparison error:', err);
      setError(err.message || 'Failed to compare products. Please try again.');
    } finally {
      setIsComparing(false);
    }
  };

  const handlePrevPage = () => {
    setComparisonPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setComparisonPage(prev => 
      Math.min(Math.ceil(comparisonQueue.length / productsPerPage), prev + 1)
    );
  };

  const startIndex = (comparisonPage - 1) * productsPerPage;
  const displayedProducts = comparisonQueue.slice(
    startIndex,
    startIndex + productsPerPage
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Product Comparison</h1>
      <Search onSearch={handleSearch} />
      
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {error && (
        <div className="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Comparison Queue ({comparisonQueue.length}/{maxProducts})
        </h2>
        
        {comparisonQueue.length === 0 ? (
          <p className="text-gray-600">No products in comparison queue.</p>
        ) : (
          <>
            <div className="comparison-container">
              <button 
                className="nav-arrow prev-arrow"
                onClick={handlePrevPage}
                disabled={comparisonPage === 1}
              >
                ←
              </button>
              
              <div className="comparison-list">
                {displayedProducts.map((product) => (
                  <div key={product.id} className="comparison-item">
                    <h3 className="text-lg font-semibold">{product.name}</h3>
                    <p className="text-blue-600 font-bold mb-4">
                      {product.price.toLocaleString()} VND
                    </p>
                    <button
                      className="remove-from-compare-button"
                      onClick={() => handleRemoveFromCompare(product.id)}
                    >
                      Remove
                    </button>
                    
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
                      <p className="text-gray-500 mt-4">No specifications available.</p>
                    )}
                  </div>
                ))}
              </div>
              
              <button 
                className="nav-arrow next-arrow"
                onClick={handleNextPage}
                disabled={comparisonPage >= Math.ceil(comparisonQueue.length / productsPerPage)}
              >
                →
              </button>
            </div>

            <div className="comparison-actions mt-6">
              <div className="language-selector mb-4">
                <label className="inline-flex items-center mr-4">
                  <input
                    type="radio"
                    value="en"
                    checked={language === 'en'}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="form-radio"
                  />
                  <span className="ml-2">English</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="vi"
                    checked={language === 'vi'}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="form-radio"
                  />
                  <span className="ml-2">Tiếng Việt</span>
                </label>
              </div>
              
              <button 
                className={`compare-button ${isComparing ? 'comparing' : ''}`}
                onClick={handleCompare}
                disabled={comparisonQueue.length < 2 || isComparing}
              >
                {isComparing ? (
                  <span className="comparing-text">
                    <span className="loading-dots">Comparing</span>
                  </span>
                ) : (
                  language === 'en' ? 'Give me comparison' : 'So sánh sản phẩm'
                )}
              </button>
            </div>

            {comparisonResult && (
              <div className="comparison-result mt-8">
                <h3 className="text-xl font-semibold mb-4">Comparison Result</h3>
                <div className="result-content bg-white rounded-lg shadow-md p-6">
                  <ReactMarkdown>{comparisonResult}</ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8">
        <ProductList products={products} onAddToCompare={handleAddToCompare} />
      </div>
    </div>
  );
};

export default Home; 