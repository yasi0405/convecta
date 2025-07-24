// theme/ThemeProvider.tsx
import React, { ReactNode, createContext, useContext } from 'react';
import Colors from '../constants/Colors';

const ThemeContext = createContext(Colors);

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeContext.Provider value={Colors}>
      {children}
    </ThemeContext.Provider>
  );
};