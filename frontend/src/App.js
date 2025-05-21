import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Search from './components/Search';
import ProductList from './components/ProductList';
import ProductDetails from './components/ProductDetails';
import ReactMarkdown from 'react-markdown';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import Navbar from './components/Navbar';
import { GuestProvider, useGuest } from './contexts/GuestContext';
import GuestMode from './components/GuestMode';
import Home from './components/Home';
import Compare from './components/Compare';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { isGuest } = useGuest();
  const token = localStorage.getItem('token');

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!token && !isGuest) {
    return <Navigate to="/" />;
  }

  return children;
};

// Root Route component to handle redirection
const RootRoute = () => {
  const { user, loading } = useAuth();
  const token = localStorage.getItem('token');

  if (loading) {
    return <div>Loading...</div>;
  }

  if (token) {
    return <Navigate to="/home" />;
  }

  return <GuestMode />;
};

function App() {
  const [products, setProducts] = useState([]);
  const [comparisonQueue, setComparisonQueue] = useState([]);
  const [comparisonPage, setComparisonPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [language, setLanguage] = useState('en');
  const [isComparing, setIsComparing] = useState(false);

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

    setIsComparing(true);
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
      setIsComparing(false);
    }
  };

  return (
    <AuthProvider>
      <GuestProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compare"
                element={
                  <ProtectedRoute>
                    <Compare />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Router>
      </GuestProvider>
    </AuthProvider>
  );
}

export default App;