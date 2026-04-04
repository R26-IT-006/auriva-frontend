import { createContext } from 'react';

export const SidebarContext = createContext({
  isOpen: true,
  toggle: () => {},
  sidebarAnim: null,
});
