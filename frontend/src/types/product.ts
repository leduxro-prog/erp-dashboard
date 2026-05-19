export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  image?: string;
  parentId?: string;
  active: boolean;
}

export interface PriceInfo {
  currency: string;
  amount: number;
  discount?: number;
  tax?: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: PriceInfo;
  cost: number;
  stock: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: ProductCategory;
  image?: string;
  basePrice: PriceInfo;
  baseCost: number;
  variants?: ProductVariant[];
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDTO {
  code: string;
  name: string;
  description?: string;
  categoryId: string;
  basePrice: PriceInfo;
  baseCost: number;
  barcode?: string;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
  id: string;
}

export interface ProductGalleryImage {
  url: string;
  alt_text?: string;
  sort_order?: number;
  is_primary?: boolean;
}

export interface ProductResource {
  label: string;
  url: string;
  assetType?: string;
}

export function getB2BProductGallery(product: any): ProductGalleryImage[] {
  const images: ProductGalleryImage[] = [];

  if (Array.isArray(product?.images)) {
    for (const image of product.images) {
      if (typeof image === 'string' && image) {
        images.push({ url: image });
      } else if (image?.url) {
        images.push({
          url: image.url,
          alt_text: image.alt_text || image.alt,
          sort_order: image.sort_order,
          is_primary: image.is_primary,
        });
      }
    }
  }

  if (images.length === 0 && Array.isArray(product?.gallery)) {
    for (const image of product.gallery) {
      if (typeof image === 'string' && image) {
        images.push({ url: image });
      } else if (image?.url) {
        images.push({ url: image.url, alt_text: image.alt_text || image.alt });
      }
    }
  }

  if (images.length === 0 && product?.image) {
    images.push({ url: product.image, is_primary: true });
  }

  if (images.length === 0 && product?.image_url) {
    images.push({ url: product.image_url, is_primary: true });
  }

  return images;
}

export function getB2BProductResources(product: any): ProductResource[] {
  const resources: ProductResource[] = [];

  if (Array.isArray(product?.resources)) {
    for (const resource of product.resources) {
      if (resource?.url && resource?.label) {
        resources.push({
          url: resource.url,
          label: resource.label,
          assetType: resource.asset_type || resource.assetType,
        });
      }
    }
  }

  if (Array.isArray(product?.documents)) {
    for (const document of product.documents) {
      if (document?.url) {
        resources.push({
          url: document.url,
          label: document.name || document.label || 'Document',
          assetType: document.type || document.asset_type,
        });
      }
    }
  }

  const metadata = product?.metadata || {};
  if (metadata.datasheet_url) {
    resources.push({ url: metadata.datasheet_url, label: 'Datasheet', assetType: 'datasheet' });
  }
  if (metadata.installation_guide_url) {
    resources.push({
      url: metadata.installation_guide_url,
      label: 'Installation Guide',
      assetType: 'installation',
    });
  }

  return resources;
}
