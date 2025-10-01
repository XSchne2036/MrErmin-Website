import React, { useEffect, useRef } from 'react';

const PayPalPayLater = ({ amount = "29.99", style = {} }) => {
  const paypalRef = useRef(null);

  useEffect(() => {
    const initializePayPal = () => {
      if (window.PayPalSDK && paypalRef.current && amount) {
        // PayPal Pay Later Message anzeigen
        const messageElement = document.createElement('div');
        messageElement.setAttribute('data-pp-message', '');
        messageElement.setAttribute('data-pp-style-layout', style.layout || 'text');
        messageElement.setAttribute('data-pp-style-logo-type', style.logoType || 'inline');
        messageElement.setAttribute('data-pp-style-text-color', style.textColor || 'black');
        messageElement.setAttribute('data-pp-amount', amount);

        // Bestehenden Inhalt leeren und neues Element hinzufügen
        paypalRef.current.innerHTML = '';
        paypalRef.current.appendChild(messageElement);

        // PayPal Messages rendern
        if (window.PayPalSDK.Messages) {
          window.PayPalSDK.Messages().render(messageElement);
        }
      }
    };

    if (window.PayPalSDK) {
      initializePayPal();
    } else {
      // Warten auf PayPal SDK
      const checkPayPal = setInterval(() => {
        if (window.PayPalSDK) {
          initializePayPal();
          clearInterval(checkPayPal);
        }
      }, 100);

      return () => clearInterval(checkPayPal);
    }
  }, [amount, style]);

  return (
    <div ref={paypalRef} className="paypal-pay-later-container">
      {/* PayPal Messages werden hier dynamisch eingefügt */}
    </div>
  );
};

export default PayPalPayLater;
