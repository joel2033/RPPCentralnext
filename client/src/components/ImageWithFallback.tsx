import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function ImageWithFallback({ 
  src, 
  alt, 
  className = '', 
  fallbackClassName = '',
  onLoad,
  onError 
}: ImageWithFallbackProps) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');

  const handleLoad = () => {
    setImageState('loaded');
    onLoad?.();
  };

  const handleError = () => {
    setImageState('error');
    onError?.();
  };

  if (imageState === 'error') {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${fallbackClassName || className}`}
        data-testid="image-fallback"
      >
        <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-600" />
      </div>
    );
  }

  return (
    <>
      {imageState === 'loading' && (
        <div 
          className={`absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
          data-testid="image-loading"
        >
          <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${imageState === 'loading' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        data-testid="image-element"
      />
    </>
  );
}
