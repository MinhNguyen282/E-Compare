import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Search from './components/Search';
import ProductList from './components/ProductList';
import ProductDetails from './components/ProductDetails';
import ReactMarkdown from 'react-markdown';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);
  const [comparisonQueue, setComparisonQueue] = useState([]);
  const [comparisonPage, setComparisonPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [language, setLanguage] = useState('en');

  const productsPerPage = 3; // Changed to show 3 products at a time
  const maxProducts = 6; // Maximum number of products allowed in queue

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const fetchWithRetry = async (url, options = {}, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  };

  const handleSearch = async (query) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithRetry(`${API_URL}/search?query=${encodeURIComponent(query)}`);
      setProducts(data);
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCompare = async (product) => {
    if (comparisonQueue.some((item) => item.id === product.id)) {
      return;
    }
    if (comparisonQueue.length >= maxProducts) {
      setError(`Comparison queue is full (maximum ${maxProducts} products). Remove a product to add another.`);
      return;
    }
    try {
      const productDetails = await fetchWithRetry(`${API_URL}/product/${product.id}`);
      setComparisonQueue([...comparisonQueue, { ...product, specifications: productDetails.specifications }]);
      setError(null);
    } catch (err) {
      setError(`Error adding product to comparison: ${err.message}`);
    }
  };

  const handleRemoveFromCompare = (productId) => {
    setComparisonQueue(comparisonQueue.filter((item) => item.id !== productId));
    setError(null); // Clear error when removing
    // Adjust page if necessary
    const totalPages = Math.ceil(comparisonQueue.length / productsPerPage);
    if (comparisonPage > totalPages && totalPages > 0) {
      setComparisonPage(totalPages);
    }
  };

  const handleComparisonPageChange = (page) => {
    setComparisonPage(page);
  };

  const handleNextPage = () => {
    if (comparisonPage < Math.ceil(comparisonQueue.length / productsPerPage)) {
      setComparisonPage(comparisonPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (comparisonPage > 1) {
      setComparisonPage(comparisonPage - 1);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(comparisonQueue.length / productsPerPage);
  const startIndex = (comparisonPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const displayedProducts = comparisonQueue.slice(startIndex, endIndex);

  const handleCompare = async () => {
    if (comparisonQueue.length < 2) {
      setError('Please add at least 2 products to compare');
      return;
    }

    setLoading(true);
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

      const result = await fetchWithRetry(`${API_URL}/compare`, {
        method: 'POST',
        body: JSON.stringify({ prompt: fullPrompt }),
      });

      setComparisonResult(result.comparison);
    } catch (err) {
      setError(`Comparison failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <h1>Product Comparison</h1>
                <Search onSearch={handleSearch} />
                {loading && <div className="loading"></div>}
                {error && <div className="error-message">{error}</div>}
                <h2>Comparison Queue ({comparisonQueue.length}/{maxProducts})</h2>
                {comparisonQueue.length === 0 ? (
                  <p>No products in comparison queue.</p>
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
                            <h3>{product.name}</h3>
                            <p style={{ margin: '0 0 10px', color: '#007bff', fontWeight: 'bold' }}>
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
                              <p>No specifications available.</p>
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
                    <div className="comparison-actions">
                      <div className="language-selector">
                        <label>
                          <input
                            type="radio"
                            value="en"
                            checked={language === 'en'}
                            onChange={(e) => setLanguage(e.target.value)}
                          />
                          English
                        </label>
                        <label>
                          <input
                            type="radio"
                            value="vi"
                            checked={language === 'vi'}
                            onChange={(e) => setLanguage(e.target.value)}
                          />
                          Tiếng Việt
                        </label>
                      </div>
                      <button 
                        className="compare-button"
                        onClick={handleCompare}
                        disabled={comparisonQueue.length < 2}
                      >
                        {language === 'en' ? 'Give me comparison' : 'So sánh sản phẩm'}
                      </button>
                    </div>
                    {comparisonResult && (
                      <div className="comparison-result">
                        <h3>Comparison Result</h3>
                        <div className="result-content">
                          <ReactMarkdown>{comparisonResult}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <ProductList products={products} onAddToCompare={handleAddToCompare} />
              </>
            }
          />
          <Route path="/product/:productId" element={<ProductDetails />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;