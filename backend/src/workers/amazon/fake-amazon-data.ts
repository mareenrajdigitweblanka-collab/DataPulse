/**
 * Fake Amazon product data generator for development/testing.
 * In production, this would be replaced with actual Amazon scraping logic.
 */

export type AmazonProduct = {
  asin: string;
  title: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  url: string;
  isPrime: boolean;
  inStock: boolean;
  seller: string;
  category: string;
};

const PRODUCT_TITLES = [
  "Wireless Bluetooth Headphones with Noise Cancelling",
  "Smart Watch Fitness Tracker with Heart Rate Monitor",
  "USB-C Hub Multiport Adapter for Laptop",
  "Portable Power Bank 20000mAh Fast Charging",
  "Mechanical Gaming Keyboard RGB Backlit",
  "4K Webcam with Microphone for Streaming",
  "Ergonomic Wireless Mouse for PC",
  "LED Desk Lamp with USB Charging Port",
  "Noise Machine for Sleep with White Noise",
  "Laptop Stand Adjustable Aluminum Alloy",
];

const SELLERS = [
  "TechGear Direct",
  "Amazon.com",
  "ElectroHub",
  "GadgetWorld",
  "Prime Electronics",
  "Digital Depot",
  "SmartBuy Store",
];

const CATEGORIES = [
  "Electronics",
  "Computers & Accessories",
  "Home & Kitchen",
  "Office Products",
  "Cell Phones & Accessories",
];

function generateASIN(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let asin = "B0";
  for (let i = 0; i < 8; i++) {
    asin += chars[Math.floor(Math.random() * chars.length)];
  }
  return asin;
}

function randomPrice(min: number, max: number): number {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function randomRating(): number {
  return Number((Math.random() * 2 + 3).toFixed(1)); // 3.0 to 5.0
}

function randomReviewCount(): number {
  return Math.floor(Math.random() * 5000) + 50;
}

/**
 * Generate fake Amazon product data.
 */
export function generateFakeProducts(query: string, count: number = 20): AmazonProduct[] {
  const products: AmazonProduct[] = [];

  for (let i = 0; i < count; i++) {
    const title = PRODUCT_TITLES[i % PRODUCT_TITLES.length];
    const price = randomPrice(15, 200);
    const originalPrice = Math.random() > 0.3 ? randomPrice(price + 10, price + 50) : undefined;
    const rating = randomRating();
    const reviewCount = randomReviewCount();
    const isPrime = Math.random() > 0.3;
    const inStock = Math.random() > 0.1;
    const seller = SELLERS[Math.floor(Math.random() * SELLERS.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const asin = generateASIN();

    products.push({
      asin,
      title: `${title} - ${query}`,
      price,
      originalPrice,
      rating,
      reviewCount,
      imageUrl: `https://picsum.photos/seed/${asin}/300/300`,
      url: `https://www.amazon.com/dp/${asin}`,
      isPrime,
      inStock,
      seller,
      category,
    });
  }

  return products;
}