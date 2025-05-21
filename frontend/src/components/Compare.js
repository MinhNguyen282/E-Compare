import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const Compare = () => {
  const location = useLocation();
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchComparisonData = async () => {
      try {
        const response = await fetch('/api/comparison', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch comparison data');
        }

        const data = await response.json();
        setComparisonData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-600">No comparison data available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Detailed Comparison</h1>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {comparisonData.products.map((product, index) => (
            <div key={product.id} className="comparison-card">
              <div className="aspect-w-1 aspect-h-1 mb-4">
                <img
                  src={product.image}
                  alt={product.name}
                  className="object-cover rounded-lg"
                />
              </div>
              
              <h2 className="text-xl font-semibold mb-2">{product.name}</h2>
              <p className="text-blue-600 font-bold mb-4">
                {product.price.toLocaleString()} VND
              </p>
              
              <div className="specifications">
                <h3 className="text-lg font-medium mb-3">Specifications</h3>
                <table className="w-full">
                  <tbody>
                    {product.specifications.map((spec, specIndex) => (
                      spec.attributes.map((attr, attrIndex) => (
                        <tr key={`${specIndex}-${attrIndex}`} className="border-b">
                          <td className="py-2 font-medium">{attr.name}</td>
                          <td className="py-2 text-gray-600">{attr.value}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-3">Highlights</h3>
                <ul className="list-disc list-inside text-gray-600">
                  {product.highlights.map((highlight, index) => (
                    <li key={index} className="mb-2">{highlight}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-6 bg-gray-50 border-t">
          <h2 className="text-2xl font-semibold mb-4">Comparison Summary</h2>
          <div className="prose max-w-none">
            {comparisonData.summary}
          </div>
          
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-3">Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comparisonData.recommendations.map((rec, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow">
                  <h4 className="font-medium mb-2">{rec.title}</h4>
                  <p className="text-gray-600">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compare; 