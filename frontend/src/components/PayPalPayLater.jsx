import React, { useEffect, useRef } from 'react';

const PayPalPayLater = ({ amount = "29.99", style = {} }) => {
  const paypalRef = useRef(null);

  useEffect(() => {
    const initializePayPal = () => {
      try {
        if (window.PayPalSDK && paypalRef.current && amount) {
          // PayPal Pay Later Message anzeigen
          const messageElement = document.createElement('div');
          messageElement.setAttribute('data-pp-message', '');
          messageElement.setAttribute('data-pp-style-layout', style.layout || 'text');
          messageElement.setAttribute('data-pp-style-logo-type', style.logoType || 'inline');
          messageElement.setAttribute('data-pp-style-text-color', style.textColor || 'black');
          messageElement.setAttribute('data-pp-amount', amount);

          // Bestehenden Inhalt leeren und neues Element hinzufügen
          if (paypalRef.current) {
            paypalRef.current.innerHTML = '';
            paypalRef.current.appendChild(messageElement);

            // PayPal Messages rendern
            if (window.PayPalSDK.Messages) {
              window.PayPalSDK.Messages().render(messageElement).catch(err => {
                console.log('PayPal Messages render info:', err);
              });
            }
          }
        }
      } catch (error) {
        console.log('PayPal initialization info:', error);
        // Fallback: Zeige manuellen Text wenn PayPal nicht verfügbar
        if (paypalRef.current) {
          paypalRef.current.innerHTML = `
            <div class="text-sm text-gray-600 italic">
              💳 PayPal Pay Later verfügbar - Zahlen Sie später ohne Zinsen
            </div>
          `;
        }
      }
    };

    if (window.PayPalSDK) {
      initializePayPal();
    } else {
      // Warten auf PayPal SDK mit Timeout
      let attempts = 0;
      const maxAttempts = 50;
      const checkPayPal = setInterval(() => {
        attempts++;
        if (window.PayPalSDK) {
          initializePayPal();
          clearInterval(checkPayPal);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkPayPal);
          // Fallback nach Timeout
          if (paypalRef.current) {
            paypalRef.current.innerHTML = `
              <div class="text-sm text-gray-600 italic">
                💳 PayPal Pay Later verfügbar - Zahlen Sie später ohne Zinsen
              </div>
            `;
          }
        }
      }, 100);

      return () => clearInterval(checkPayPal);
    }
  }, [amount, style]);

  return (
    <div ref={paypalRef} className="paypal-pay-later-container">
      {/* PayPal Messages werden hier dynamisch eingefügt */}
      <div className="text-sm text-gray-500">Lade PayPal Pay Later...</div>
    </div>
  );
};

export default PayPalPayLater;
