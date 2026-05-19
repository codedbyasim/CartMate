import json
import random

categories = {
    "Electronics": ["Smartphone", "Laptop", "Headphones", "Smartwatch"],
    "Clothing": ["T-Shirt", "Jeans", "Jacket", "Sneakers"],
    "Home & Garden": ["Sofa", "Lamp", "Plant Pot", "Coffee Table"],
    "Sports": ["Tennis Racket", "Yoga Mat", "Dumbbells", "Running Shoes"],
    "Beauty": ["Moisturizer", "Lipstick", "Perfume", "Shampoo"]
}

adjectives = ["Premium", "Eco-friendly", "Classic", "Modern", "Durable", "Sleek", "Compact", "Luxury"]
colors = ["Black", "White", "Red", "Blue", "Green", "Silver", "Gold", "Wood"]
materials = ["Leather", "Plastic", "Metal", "Cotton", "Glass", "Ceramic", "Rubber"]

products = []
product_id_counter = 1

for cat, subcats in categories.items():
    for _ in range(20): # 20 products per category = 100 total
        subcat = random.choice(subcats)
        adj = random.choice(adjectives)
        color = random.choice(colors)
        material = random.choice(materials)
        name = f"{adj} {color} {subcat}"
        price = round(random.uniform(15.0, 999.0), 2)
        
        products.append({
            "id": f"PROD-{product_id_counter:04d}",
            "name": name,
            "category": cat,
            "subcategory": subcat,
            "price": price,
            "currency": "USD",
            "description": f"A high-quality {name.lower()} made from {material.lower()}. Perfect for your daily needs.",
            "tags": [cat.lower(), subcat.lower(), color.lower(), material.lower(), adj.lower()],
            "image_url": f"https://placehold.co/400x400/png?text={name.replace(' ', '+')}",
            "stock_status": random.choice(["In Stock", "In Stock", "Out of Stock"]),
            "visual_attributes": {
                "color": color,
                "material": material,
                "category": subcat
            }
        })
        product_id_counter += 1

with open("catalogue.json", "w") as f:
    json.dump(products, f, indent=4)

print("Generated catalogue.json with 100 products.")
