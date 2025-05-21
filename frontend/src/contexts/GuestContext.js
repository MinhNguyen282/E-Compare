import React, { createContext, useContext, useState } from 'react';

const GuestContext = createContext();

export const useGuest = () => {
  return useContext(GuestContext);
};

export const GuestProvider = ({ children }) => {
  const [isGuest, setIsGuest] = useState(false);

  const enterGuestMode = () => {
    setIsGuest(true);
  };

  const exitGuestMode = () => {
    setIsGuest(false);
  };

  return (
    <GuestContext.Provider value={{ isGuest, enterGuestMode, exitGuestMode }}>
      {children}
    </GuestContext.Provider>
  );
}; 