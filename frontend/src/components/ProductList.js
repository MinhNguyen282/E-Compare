import React from 'react';

const ProductList = ({ products, onAddToCompare }) => {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No products found. Try searching for something else.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <div
          key={product.id}
          className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
        >
          <div className="aspect-w-1 aspect-h-1">
            <img
              src={product.thumbnail_url}
              alt={product.name}
              className="object-cover w-full h-48"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/300x300?text=No+Image';
              }}
            />
          </div>
          
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {product.name}
            </h3>
            
            <p className="text-blue-600 font-bold mb-4">
              {product.price.toLocaleString()} VND
            </p>
            
            {product.specifications && product.specifications.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Key Specifications:
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {product.specifications.slice(0, 3).map((spec, specIndex) => (
                    spec.attributes.slice(0, 2).map((attr, attrIndex) => (
                      <li key={`${specIndex}-${attrIndex}`}>
                        {attr.name}: {attr.value}
                      </li>
                    ))
                  ))}
                </ul>
              </div>
            )}
            
            <button
              onClick={() => onAddToCompare(product)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
            >
              Add to Compare
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductList;