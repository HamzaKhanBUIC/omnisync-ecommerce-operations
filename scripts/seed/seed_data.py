#!/usr/bin/env python3
"""
Seed Data Generator for Ecommerce Operations Platform
Generates realistic 100-SKU multi-channel catalog fixtures with variants,
UPC/EAN barcodes, multi-store channel mappings, and initial inventory allocations.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any

def generate_100_sku_catalog() -> Dict[str, Any]:
    categories_data = [
        {
            "category": "Footwear",
            "family": "Apex Performance Running Shoes",
            "prefix": "SHOE-APX",
            "brand": "Apex Athletics",
            "base_price": 159.99,
            "cost": 64.00,
            "weight": 820,
            "variants": [
                ("BLK-08", "Stealth Black", "US 8", 25),
                ("BLK-09", "Stealth Black", "US 9", 40),
                ("BLK-10", "Stealth Black", "US 10", 50),
                ("BLK-11", "Stealth Black", "US 11", 35),
                ("BLK-12", "Stealth Black", "US 12", 15),
                ("WHT-08", "Alpine White", "US 8", 20),
                ("WHT-09", "Alpine White", "US 9", 35),
                ("WHT-10", "Alpine White", "US 10", 45),
                ("NEO-09", "Neon Lime (Flash Limited)", "US 9", 8),
                ("NEO-10", "Neon Lime (Flash Limited)", "US 10", 5),
            ]
        },
        {
            "category": "Cycling & Helmets",
            "family": "AeroLite Carbon Road Helmet",
            "prefix": "HLMT-AERO",
            "brand": "AeroDynamics Pro",
            "base_price": 229.99,
            "cost": 92.50,
            "weight": 240,
            "variants": [
                ("BLK-S", "Matte Carbon Black", "Small (51-55cm)", 18),
                ("BLK-M", "Matte Carbon Black", "Medium (55-59cm)", 32),
                ("BLK-L", "Matte Carbon Black", "Large (59-63cm)", 24),
                ("WHT-S", "Gloss Pearl White", "Small (51-55cm)", 15),
                ("WHT-M", "Gloss Pearl White", "Medium (55-59cm)", 28),
                ("WHT-L", "Gloss Pearl White", "Large (59-63cm)", 20),
                ("YEL-S", "Hi-Vis Race Yellow", "Small (51-55cm)", 10),
                ("YEL-M", "Hi-Vis Race Yellow", "Medium (55-59cm)", 18),
                ("CRM-M", "Crimson Carbon Edition", "Medium (55-59cm)", 6),
                ("CRM-L", "Crimson Carbon Edition", "Large (59-63cm)", 4),
            ]
        },
        {
            "category": "Apparel",
            "family": "Merino Wool 260 Thermal Layer",
            "prefix": "APRL-MRN",
            "brand": "Nordic Peak Gear",
            "base_price": 98.00,
            "cost": 38.00,
            "weight": 310,
            "variants": [
                ("CHR-XS", "Charcoal Heather", "XS", 15),
                ("CHR-S", "Charcoal Heather", "S", 45),
                ("CHR-M", "Charcoal Heather", "M", 60),
                ("CHR-L", "Charcoal Heather", "L", 55),
                ("CHR-XL", "Charcoal Heather", "XL", 30),
                ("NVY-S", "Midnight Navy", "S", 35),
                ("NVY-M", "Midnight Navy", "M", 50),
                ("NVY-L", "Midnight Navy", "L", 40),
                ("NVY-XL", "Midnight Navy", "XL", 25),
                ("NVY-XXL", "Midnight Navy", "XXL", 12),
            ]
        },
        {
            "category": "Outerwear",
            "family": "HydroShield 3-Layer Shell Jacket",
            "prefix": "OUTR-HYD",
            "brand": "Nordic Peak Gear",
            "base_price": 349.00,
            "cost": 140.00,
            "weight": 520,
            "variants": [
                ("OLV-S", "Ranger Olive", "Small", 14),
                ("OLV-M", "Ranger Olive", "Medium", 28),
                ("OLV-L", "Ranger Olive", "Large", 25),
                ("OLV-XL", "Ranger Olive", "XL", 16),
                ("SLT-S", "Slate Grey", "Small", 12),
                ("SLT-M", "Slate Grey", "Medium", 30),
                ("SLT-L", "Slate Grey", "Large", 26),
                ("SLT-XL", "Slate Grey", "XL", 15),
                ("BLK-M", "Onyx Black", "Medium", 40),
                ("BLK-L", "Onyx Black", "Large", 35),
            ]
        },
        {
            "category": "Horology & Watches",
            "family": "Quantum Mechanix Chronograph",
            "prefix": "WTCH-QTM",
            "brand": "Quantum Timepieces",
            "base_price": 495.00,
            "cost": 185.00,
            "weight": 160,
            "variants": [
                ("TTN-LTH", "Grade 5 Titanium", "Horween Calf Leather", 10),
                ("TTN-STL", "Grade 5 Titanium", "Titanium Link Bracelet", 8),
                ("RSG-LTH", "18k Rose Gold PVD", "Alligator Grain Leather", 5),
                ("RSG-STL", "18k Rose Gold PVD", "Milanese Mesh Strap", 5),
                ("ONYX-STL", "DLC Midnight Onyx", "Black PVD Steel Strap", 12),
                ("ONYX-RBR", "DLC Midnight Onyx", "FKM Fluoroelastomer Rubber", 15),
                ("SLV-LTH", "Classic Silver Steel", "Cognac Saddle Leather", 20),
                ("SLV-STL", "Classic Silver Steel", "Oyster 3-Link Steel", 22),
                ("LTD-MRN", "Deep Marine (Flash Sale Limited)", "Navy Sailcloth", 3),
                ("LTD-GLD", "Centennial Gold (Founders Edition)", "Burgundy Leather", 2),
            ]
        },
        {
            "category": "Electronics & Peripherals",
            "family": "ErgoPro Wireless Mechanical Keyboard",
            "prefix": "KB-ERGO",
            "brand": "Syntax Hardware",
            "base_price": 189.99,
            "cost": 72.00,
            "weight": 950,
            "variants": [
                ("RED-ANSI", "Linear Red Switches", "ANSI 75% Layout", 45),
                ("BRN-ANSI", "Tactile Brown Switches", "ANSI 75% Layout", 60),
                ("BLU-ANSI", "Clicky Blue Switches", "ANSI 75% Layout", 25),
                ("SLT-ANSI", "Silent Black Switches", "ANSI 75% Layout", 30),
                ("RED-ISO", "Linear Red Switches", "ISO-UK Layout", 20),
                ("BRN-ISO", "Tactile Brown Switches", "ISO-UK Layout", 25),
                ("BLU-ISO", "Clicky Blue Switches", "ISO-UK Layout", 10),
                ("SLT-ISO", "Silent Black Switches", "ISO-UK Layout", 15),
                ("LTD-RET", "Retro 1984 Edition (Brown)", "ANSI 75% Layout", 7),
                ("LTD-CYB", "Cyberpunk Neon (Linear Red)", "ANSI 75% Layout", 5),
            ]
        },
        {
            "category": "Audio & Acoustics",
            "family": "StudioGrade ANC Wireless Headphones",
            "prefix": "AUD-SG",
            "brand": "Acoustic Alchemy",
            "base_price": 279.99,
            "cost": 110.00,
            "weight": 285,
            "variants": [
                ("GRY-STD", "Space Gray", "Standard Edition", 40),
                ("SLV-STD", "Pearl Silver", "Standard Edition", 35),
                ("BLK-STD", "Matte Carbon Black", "Standard Edition", 55),
                ("NVY-STD", "Midnight Blue", "Standard Edition", 25),
                ("BRZ-STD", "Brushed Bronze", "Standard Edition", 18),
                ("GRY-PRO", "Space Gray", "Audiophile Pro DAC Bundle", 15),
                ("SLV-PRO", "Pearl Silver", "Audiophile Pro DAC Bundle", 12),
                ("BLK-PRO", "Matte Carbon Black", "Audiophile Pro DAC Bundle", 20),
                ("LTD-WHT", "Ceramic Pure White (Limited)", "Standard Edition", 6),
                ("LTD-GLD", "Imperial Gold Edition", "Pro Edition", 4),
            ]
        },
        {
            "category": "Everyday Carry",
            "family": "Titanium EDC Precision Pocket Knife",
            "prefix": "EDC-KNF",
            "brand": "Vanguard Blades",
            "base_price": 165.00,
            "cost": 55.00,
            "weight": 115,
            "variants": [
                ("STN-CF", "Stonewash CPM-S35VN", "Carbon Fiber Inlay", 30),
                ("STN-MIC", "Stonewash CPM-S35VN", "Canvas Micarta Inlay", 25),
                ("DLC-CF", "DLC Blackout Blade", "Carbon Fiber Inlay", 28),
                ("DLC-MIC", "DLC Blackout Blade", "Canvas Micarta Inlay", 22),
                ("SAT-TTN", "Satin Hand-Ground", "Full Titanium Scales", 18),
                ("DLC-TTN", "DLC Blackout Blade", "Full Titanium Scales", 15),
                ("DAM-CF", "Damasteel Patterned", "Carbon Fiber Inlay", 8),
                ("DAM-TTN", "Damasteel Patterned", "Titanium Blue Anodized", 5),
                ("LTD-COP", "Antiqued Copper Scale", "CPM-20CV Blade", 4),
                ("LTD-BRS", "Solid Brass Scale", "CPM-20CV Blade", 3),
            ]
        },
        {
            "category": "Luggage & Packs",
            "family": "Voyager 40L Modular Travel Backpack",
            "prefix": "BAG-VOY",
            "brand": "Nomad Transit Lab",
            "base_price": 249.00,
            "cost": 88.00,
            "weight": 1450,
            "variants": [
                ("CRD-BLK", "Cordura 500D Ballistic", "Matte Stealth Black", 50),
                ("CRD-NVY", "Cordura 500D Ballistic", "Deep Ocean Navy", 30),
                ("CRD-COY", "Cordura 500D Ballistic", "Coyote Desert Tan", 25),
                ("CRD-RNG", "Cordura 500D Ballistic", "Ranger Moss Green", 22),
                ("XPAC-BLK", "Dimension-Polyant X-Pac VX21", "Onyx Black", 35),
                ("XPAC-WHT", "Dimension-Polyant X-Pac VX21", "Alpine White", 15),
                ("XPAC-SLT", "Dimension-Polyant X-Pac VX21", "Storm Slate", 20),
                ("XPAC-CAM", "Dimension-Polyant X-Pac VX21", "Multicam Black", 12),
                ("LTD-ULTR", "Ultra-PE 200 Dyneema Edition", "Translucent Smoke", 5),
                ("LTD-LETH", "Foundry Edition Waxed Canvas & Leather", "Cognac Brown", 4),
            ]
        },
        {
            "category": "Home & Kitchen",
            "family": "SmartBrew Precision Pour-Over Kettle",
            "prefix": "KTLE-SBT",
            "brand": "Artisan Craft Labs",
            "base_price": 175.00,
            "cost": 68.00,
            "weight": 1250,
            "variants": [
                ("BLK-US", "Matte Black Gooseneck", "120V US Plug / BLE", 40),
                ("BLK-EU", "Matte Black Gooseneck", "230V EU Plug / BLE", 30),
                ("BLK-UK", "Matte Black Gooseneck", "240V UK Plug / BLE", 20),
                ("STS-US", "Brushed Stainless Steel", "120V US Plug / BLE", 35),
                ("STS-EU", "Brushed Stainless Steel", "230V EU Plug / BLE", 25),
                ("BRS-US", "Brushed Antique Brass", "120V US Plug / BLE", 18),
                ("BRS-EU", "Brushed Antique Brass", "230V EU Plug / BLE", 14),
                ("CPR-US", "Smoked Copper Finish", "120V US Plug / BLE", 12),
                ("LTD-WOD", "Black Walnut Accent Handle (Limited)", "120V US Plug / BLE", 6),
                ("LTD-OAK", "Scandi White & Blond Oak (Limited)", "230V EU Plug / BLE", 5),
            ]
        }
    ]

    stores = [
        {"id": "store_shopify_us", "name": "Shopify US Flagship", "platform": "SHOPIFY", "currency": "USD", "rate": 1.0},
        {"id": "store_shopify_uk", "name": "Shopify UK Storefront", "platform": "SHOPIFY", "currency": "GBP", "rate": 0.79},
        {"id": "store_woo_eu", "name": "WooCommerce EU Boutique", "platform": "WOOCOMMERCE", "currency": "EUR", "rate": 0.92},
        {"id": "store_woo_asia", "name": "WooCommerce Asia Hub", "platform": "WOOCOMMERCE", "currency": "JPY", "rate": 152.5}
    ]

    products: List[Dict[str, Any]] = []
    channel_mappings: List[Dict[str, Any]] = []
    barcode_base = 840123000000

    sku_counter = 0

    for cat_idx, cat in enumerate(categories_data):
        for var_idx, (suffix, opt1, opt2, stock) in enumerate(cat["variants"]):
            sku_counter += 1
            master_sku = f"{cat['prefix']}-{suffix}"
            barcode_val = str(barcode_base + sku_counter)
            
            product_id = f"prod_{cat['prefix'].lower().replace('-', '_')}_{suffix.lower().replace('-', '_')}"
            title = f"{cat['family']} - {opt1} ({opt2})"
            price = round(cat["base_price"], 2)
            cost = round(cat["cost"], 2)

            product = {
                "id": product_id,
                "masterSku": master_sku,
                "title": title,
                "category": cat["category"],
                "brand": cat["brand"],
                "barcode": barcode_val,
                "price": price,
                "costPrice": cost,
                "currentStock": stock,
                "initialStock": stock,
                "version": 1,
                "reorderThreshold": max(5, int(stock * 0.2)),
                "reorderQuantity": max(20, stock * 2),
                "weightGrams": cat["weight"],
                "options": {
                    "variant": opt1,
                    "specification": opt2
                }
            }
            products.append(product)

            # Generate channel mappings for each store
            for store in stores:
                ext_price = round(price * store["rate"], 2) if store["currency"] != "JPY" else round(price * store["rate"])
                ext_item_id = f"{store['platform'].lower()[:3]}_{product_id}"
                ext_sku = f"{master_sku}-{store['platform'][:3]}"

                mapping = {
                    "storeId": store["id"],
                    "platform": store["platform"],
                    "masterSku": master_sku,
                    "externalItemId": ext_item_id,
                    "externalSku": ext_sku,
                    "externalPrice": ext_price,
                    "currency": store["currency"],
                    "syncEnabled": True
                }
                channel_mappings.append(mapping)

    fixture_payload = {
        "metadata": {
            "version": "1.0.0",
            "totalProducts": len(products),
            "totalChannelMappings": len(channel_mappings),
            "totalStores": len(stores),
            "generatedAt": "2026-08-24T03:15:00Z"
        },
        "stores": stores,
        "products": products,
        "channelMappings": channel_mappings
    }

    return fixture_payload

def main():
    print("=================================================================")
    print("  ECOMMERCE OPERATIONS: 100-SKU CATALOG FIXTURE GENERATOR")
    print("=================================================================")
    
    catalog = generate_100_sku_catalog()
    
    # Save to tests/fixtures/catalog_100_skus.json
    fixtures_dir = Path(__file__).resolve().parent.parent.parent / "tests" / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = fixtures_dir / "catalog_100_skus.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    print(f"[+] Successfully generated {len(catalog['products'])} Master SKUs across 10 categories.")
    print(f"[+] Generated {len(catalog['channelMappings'])} Multi-Channel Store Mappings.")
    print(f"[+] Fixture persisted to: {output_path}")
    print("=================================================================")

if __name__ == '__main__':
    main()

