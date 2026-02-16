import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMatch = event.key.toLowerCase() === key.toLowerCase();
      const ctrlMatch = options.ctrlKey !== undefined ? event.ctrlKey === options.ctrlKey : true;
      const shiftMatch =
        options.shiftKey !== undefined ? event.shiftKey === options.shiftKey : true;
      const altMatch = options.altKey !== undefined ? event.altKey === options.altKey : true;
      const metaMatch = options.metaKey !== undefined ? event.metaKey === options.metaKey : true;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options]);
}

export default useKeyboardShortcut;
