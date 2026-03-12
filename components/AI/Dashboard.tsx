
'use client';

import { useState, useEffect } from 'react';
import { PharmaAI } from '@/src/lib/ai';

export default function AIDashboard() {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      const data = await PharmaAI.generateSalesInsights('monthly');
      setInsights(data);
    } catch (error) {
      console.error('Error loading AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold gradient-text">AI-Powered Insights</h2>
          <p className="text-gray-600">Smart recommendations powered by AI</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">AI Active</span>
        </div>
      </div>

      {}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          Top Products This Month
        </h3>
        <div className="space-y-4">
          {insights?.topProducts.map((product: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3
                  ${index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-800' :
                    'bg-orange-100 text-orange-800'}`}>
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{product.product}</div>
                  <div className="text-sm text-gray-500">{product.sales.toLocaleString()} units sold</div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium
                ${product.growth > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {product.growth > 0 ? '+' : ''}{product.growth}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Recommendations
        </h3>
        <div className="space-y-3">
          {insights?.recommendations.map((rec: string, index: number) => (
            <div key={index} className="flex items-start p-3 bg-white rounded-lg border border-gray-200">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-gray-700">{rec}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}