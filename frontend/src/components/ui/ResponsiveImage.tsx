import React from 'react';
import { buildResponsiveImageSources } from '../../utils/responsive-image';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className,
  style,
  sizes,
  loading = 'lazy',
  fetchPriority = 'auto',
  width,
  height,
}) => {
  const responsiveSources = buildResponsiveImageSources(src);

  if (!responsiveSources) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        width={width}
        height={height}
      />
    );
  }

  return (
    <picture>
      <source type="image/avif" srcSet={responsiveSources.avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={responsiveSources.webpSrcSet} sizes={sizes} />
      <img
        src={responsiveSources.fallbackSrc}
        srcSet={responsiveSources.fallbackSrcSet}
        sizes={sizes}
        alt={alt}
        className={className}
        style={style}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        width={width}
        height={height}
      />
    </picture>
  );
};
