"""Supplier Scraper module"""
from .mcp_agent import (
    SupplierScraperAgent,
    SupplierConfig,
    ScrapedProduct,
    create_supplier_scraper,
    EXAMPLE_SUPPLIERS,
)

__all__ = [
    "SupplierScraperAgent",
    "SupplierConfig",
    "ScrapedProduct",
    "create_supplier_scraper",
    "EXAMPLE_SUPPLIERS",
]
