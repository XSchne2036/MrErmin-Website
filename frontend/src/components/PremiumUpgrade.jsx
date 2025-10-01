import React, { useState, useEffect } from 'react';
import PayPalPayLater from './PayPalPayLater';

const PremiumFeatures = ({ isOpen, onClose, currentUser }) => {
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  
  const plans = {
    monthly: {
      price: '29.99',
      period: 'Monat',
      features: [
        'Unbegrenzte Chats',
        'Premium AI-Modelle',
        'Chat-Export & Backup',
        'Prioritärer Support',
        'Erweiterte Personalisierung'
      ]
    },
    yearly: {
      price: '299.99',
      period: 'Jahr',
      savings: '60€ sparen',
      features: [
        'Alle monatlichen Features',
        'Erweiterte Analytics',
        'API-Zugang',
        'White-Label Optionen',
        'Dedizierter Account Manager'
      ]
    }
  };

  const currentPlan = plans[selectedPlan];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Mr Ermin Premium</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
          <p className="text-gray-600 mt-2">Erweitern Sie Ihr Chat-Erlebnis mit Premium-Features</p>
        </div>

        {/* Plan Selector */}
        <div className="p-6">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                selectedPlan === 'monthly'
                  ? 'border-orange-500 bg-orange-50 text-orange-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-lg font-semibold">Monatlich</div>
              <div className="text-2xl font-bold">€29.99<span className="text-sm font-normal">/Monat</span></div>
            </button>
            
            <button
              onClick={() => setSelectedPlan('yearly')}
              className={`flex-1 p-4 rounded-lg border-2 transition-colors relative ${
                selectedPlan === 'yearly'
                  ? 'border-orange-500 bg-orange-50 text-orange-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                60€ sparen
              </div>
              <div className="text-lg font-semibold">Jährlich</div>
              <div className="text-2xl font-bold">€299.99<span className="text-sm font-normal">/Jahr</span></div>
              <div className="text-sm text-gray-500">€24.99/Monat</div>
            </button>
          </div>

          {/* Features List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Was Sie erhalten:</h3>
            <ul className="space-y-3">
              {currentPlan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* PayPal Pay Later Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-3">Flexible Zahlung mit PayPal</h4>
            <PayPalPayLater 
              amount={currentPlan.price}
              style={{
                layout: 'text',
                logoType: 'inline',
                textColor: 'black'
              }}
            />
            <p className="text-sm text-gray-600 mt-2">
              Zahlen Sie später mit PayPal Pay Later - keine Zinsen bei pünktlicher Zahlung.
            </p>
          </div>

          {/* Upgrade Button */}
          <div className="space-y-4">
            <button className="w-full bg-orange-500 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-orange-600 transition-colors">
              Premium für €{currentPlan.price}/{currentPlan.period} aktivieren
            </button>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">
                30 Tage Geld-zurück-Garantie • Jederzeit kündbar
              </p>
            </div>
          </div>

          {/* Current User Info */}
          {currentUser && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Aktiver Account:</strong> {currentUser.email}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Das Upgrade wird sofort für diesen Account aktiviert.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumFeatures;
