import React, { createContext, useEffect, useState } from 'react';

export const AccessibilityContext = createContext({
  largeText: false,
  highContrast: false,
  toggleLargeText: () => {},
  toggleHighContrast: () => {},
});

export function AccessibilityProvider({ children }) {
  const [largeText, setLargeText] = useState(() => {
    try { return JSON.parse(localStorage.getItem('largeText')) || false; } catch { return false; }
  });
  const [highContrast, setHighContrast] = useState(() => {
    try { return JSON.parse(localStorage.getItem('highContrast')) || false; } catch { return false; }
  });

  useEffect(() => { localStorage.setItem('largeText', JSON.stringify(largeText)); }, [largeText]);
  useEffect(() => { localStorage.setItem('highContrast', JSON.stringify(highContrast)); }, [highContrast]);

  useEffect(() => {
    // Add class to body for global CSS hooks
    if (largeText) document.body.classList.add('large-text-mode'); else document.body.classList.remove('large-text-mode');
    if (highContrast) document.body.classList.add('high-contrast'); else document.body.classList.remove('high-contrast');
  }, [largeText, highContrast]);

  const value = {
    largeText,
    highContrast,
    toggleLargeText: () => setLargeText(v => !v),
    toggleHighContrast: () => setHighContrast(v => !v),
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}
