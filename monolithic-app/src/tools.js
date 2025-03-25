// tools.js - Contains all the marketplace tools
export function searchProducts(state, args) {
	const { category, priceMax, tags, condition } = args;
	let filteredProducts = [...state.products];
	
	if (category) {
		filteredProducts = filteredProducts.filter(p => p.category === category);
	}
	
	if (priceMax) {
		filteredProducts = filteredProducts.filter(p => p.price <= priceMax);
	}
	
	if (tags && tags.length > 0) {
		filteredProducts = filteredProducts.filter(p =>
			tags.some(tag => p.tags.includes(tag))
		);
	}
	
	if (condition) {
		filteredProducts = filteredProducts.filter(p => p.condition === condition);
	}
	
	return filteredProducts;
}

export function checkProductAvailability(state, args) {
	const { productId } = args;
	const product = state.products.find(p => p.id === productId);
	
	if (!product) {
		return {
			available: false,
			message: "Product not found"
		};
	}
	
	return {
		available: product.inStock > 0,
		inStock: product.inStock,
		product: product
	};
}

export function estimateDelivery(warehouseAddress, userAddress) {
	console.log(`estimating delivery from warehouse [${warehouseAddress}] to user address [${userAddress}]`);
	
	const baseDeliveryDays = 3;
	const randomAddition = Math.floor(Math.random() * 4); // 0-3 additional days
	const estimatedDays = baseDeliveryDays + randomAddition;
	
	const today = new Date();
	const deliveryDate = new Date(today);
	deliveryDate.setDate(today.getDate() + estimatedDays);
	
	return {
		estimatedDays,
		deliveryDate: deliveryDate.toISOString().split('T')[0]
	};
}

export function processPayment(userId, productId, amount) {
	console.log(`Processing payment of ${amount} for product ${productId} by user ${userId}`);
	
	const failureChance = Math.random();
	if (failureChance < 0.5) {
		console.log("Payment failed!");
		return {
			success: false,
			message: "Payment processing failed. Please try again."
		};
	}
	
	return {
		success: true,
		transactionId: `trans-${Date.now()}`,
		timestamp: new Date().toISOString()
	};
}

export function sendNotification(userId, message) {
	console.log(`Notification to user ${userId}: ${message}`);
	return {
		success: true,
		timestamp: new Date().toISOString()
	};
}

export function getDeliveryEstimate(state, args) {
	const { productId, userId } = args;
	const product = state.products.find(p => p.id === productId);
	const user = state.users.find(u => u.id === userId);
	
	if (!product || !user) {
		return {
			success: false,
			message: "Product or user not found"
		};
	}
	
	return {
		success: true,
		estimate: estimateDelivery(productId, user.address)
	};
}

export function processPurchase(state, args) {
	const { productId, userId } = args;
	
	// Get the product and user
	const product = state.products.find(p => p.id === productId);
	const user = state.users.find(u => u.id === userId);
	
	if (!product || !user) {
		return {
			success: false,
			message: "Product or user not found"
		};
	}
	
	if (product.inStock <= 0) {
		return {
			success: false,
			message: "Product is out of stock"
		};
	}
	
	// IMPROVED: Use a transaction pattern to ensure consistency
	// In a real implementation, this would be a proper transaction
	try {
		// 1. Reserve the product temporarily
		console.log(`Temporarily reserving product ${product.name}`);
		
		// 2. Process the payment
		const paymentResult = processPayment(userId, productId, product.price);
		if (!paymentResult.success) {
			throw new Error(paymentResult.message);
		}
		
		// 3. Only now update inventory (after successful payment)
		console.log(`Reducing inventory for ${product.name} from ${product.inStock} to ${product.inStock - 1}`);
		product.inStock -= 1;
		
		// 4. Estimate delivery
		const deliveryEstimate = estimateDelivery(productId, user.address);
		
		// 5. Create the order
		const order = {
			id: `order-${Date.now()}`,
			userId,
			productId,
			productName: product.name,
			price: product.price,
			transactionId: paymentResult.transactionId,
			createdAt: new Date().toISOString(),
			deliveryEstimate
		};
		
		// 6. Add to orders
		if (!state.orders) state.orders = [];
		state.orders.push(order);
		
		// 7. Send notification
		sendNotification(userId, `Your order for ${product.name} has been confirmed! Estimated delivery: ${deliveryEstimate.deliveryDate}`);
		
		return {
			success: true,
			order
		};
	} catch (error) {
		console.log(`Purchase failed: ${error.message}`);
		return {
			success: false,
			message: error.message
		};
	}
}

// Function specs for OpenAI
export const functionSpecs = [
	{
		name: "searchProducts",
		description: "Search for products based on criteria",
		parameters: {
			type: "object",
			properties: {
				category: {
					type: "string",
					description: "Product category (e.g., 'laptops')"
				},
				priceMax: {
					type: "number",
					description: "Maximum price"
				},
				tags: {
					type: "array",
					items: {
						type: "string"
					},
					description: "Tags to filter by (e.g., ['programming', 'college'])"
				},
				condition: {
					type: "string",
					description: "Product condition ('excellent', 'good', 'fair')"
				}
			}
		}
	},
	{
		name: "checkProductAvailability",
		description: "Check if a product is available",
		parameters: {
			type: "object",
			properties: {
				productId: {
					type: "string",
					description: "ID of the product to check"
				}
			},
			required: ["productId"]
		}
	},
	{
		name: "processPurchase",
		description: "Process a purchase for a product",
		parameters: {
			type: "object",
			properties: {
				productId: {
					type: "string",
					description: "ID of the product to purchase"
				},
				userId: {
					type: "string",
					description: "ID of the user making the purchase"
				}
			},
			required: ["productId", "userId"]
		}
	},
	{
		name: "getDeliveryEstimate",
		description: "Get delivery estimate for a product",
		parameters: {
			type: "object",
			properties: {
				productId: {
					type: "string",
					description: "ID of the product"
				},
				userId: {
					type: "string",
					description: "ID of the user for delivery address"
				}
			},
			required: ["productId", "userId"]
		}
	}
];
