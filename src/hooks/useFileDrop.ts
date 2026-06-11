import { useState, useCallback, useRef } from 'react';

export interface FileDropHandlers {
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export interface UseFileDropOptions {
  onFiles: (files: File[]) => void;
  onImages?: (images: string[]) => void;
}

export interface UseFileDropResult {
  isDragging: boolean;
  handlers: FileDropHandlers;
}

export function useFileDrop({ onFiles, onImages }: UseFileDropOptions): UseFileDropResult {
  const [isDragging, setIsDragging] = useState(false);
  const counter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      counter.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files || []);
      if (files.length === 0) return;

      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      const docFiles = files.filter((f) => !f.type.startsWith('image/'));

      if (docFiles.length > 0) onFiles(docFiles);
      if (imageFiles.length > 0 && onImages) {
        Promise.all(imageFiles.map(readFileAsDataURL)).then(onImages);
      }
    },
    [onFiles, onImages],
  );

  return {
    isDragging,
    handlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}