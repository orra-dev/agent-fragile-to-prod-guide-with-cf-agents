export const supportedStatuses = [
	'unknown-product',
	'product-available',
	'product-out-of-stock',
	'product-reserved',
	'product-released'
]

export async function execInventory(mktPlaceDataUrl, action, productId) {
	console.log('executing inventory action: ', action, ' for product: ', productId);
	switch (action) {
		case 'checkAvailability':
			return await checkAvailability(mktPlaceDataUrl, productId);
		case 'reserveProduct':
			return await reserveProduct(mktPlaceDataUrl, productId);
		case 'releaseProduct':
			return await releaseProduct(mktPlaceDataUrl, productId);
		default:
			throw new Error(`Unknown action: ${action}`);
	}
}

// Service functions
async function checkAvailability(mktPlaceDataUrl, productId) {
	const product = await getProductData(mktPlaceDataUrl, productId);
	
	if (!product) {
		return {
			action: "checkAvailability",
			productId,
			status: supportedStatuses[0],
			success: false,
			inStock: 0,
			message: "Product not found"
		};
	}
	
	return {
		action: "checkAvailability",
		productId,
		status: product.inStock > 0 ? supportedStatuses[1] : supportedStatuses[2],
		success: true,
		inStock: product.inStock,
		message: "Product in stock"
	};
}

async function reserveProduct(mktPlaceDataUrl, productId, quantity = 1) {
	const product = await getProductData(mktPlaceDataUrl, productId);
	
	if (!product) {
		return {
			action: "reserveProduct",
			productId,
			status: supportedStatuses[0],
			success: false,
			inStock: 0,
			message: "Product not found"
		};
	}
	
	if (product.inStock < quantity) {
		return {
			action: "reserveProduct",
			productId,
			status: supportedStatuses[2],
			success: false,
			inStock: product.inStock,
			message: `Insufficient stock. Requested: ${quantity}, Available: ${product.inStock}`
		};
	}
	
	// Reserve the product
	product.inStock -= quantity;
	await updateProductData(mktPlaceDataUrl, product);
	
	return {
		action: "reserveProduct",
		productId,
		status: supportedStatuses[3],
		success: true,
		inStock: product.inStock,
		message: `Successfully reserved ${quantity} units of ${product.name}`
	};
}

async function releaseProduct(mktPlaceDataUrl, productId, quantity = 1) {
	const product = await getProductData(mktPlaceDataUrl, productId);
	
	if (!product) {
		return {
			action: "releaseProduct",
			productId,
			status: supportedStatuses[0],
			success: false,
			inStock: 0,
			message: "Product not found"
		};
	}
	
	// Release the reservation
	product.inStock += quantity;
	await updateProductData(mktPlaceDataUrl, product);
	
	console.log(`Released ${quantity} units of ${product.name}. New stock: ${product.inStock}`);
	
	return {
		action: "releaseProduct",
		productId,
		status: supportedStatuses[4],
		success: true,
		inStock: product.inStock,
		message: `Successfully released ${quantity} units of ${product.name}`
	};
}

// Updated getProductData method for the DeliveryAgent class
async function getProductData(mktPlaceDataUrl, productId) {
	try {
		// Fetch the product data from the marketplace data service
		const response = await fetch(`${mktPlaceDataUrl}/product/${productId}`);
		
		if (!response.ok) {
			if (response.status === 404) {
				console.warn(`Product with ID ${productId} not found in marketplace data service`);
				return null;
			}
			throw new Error(`Error fetching product data: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`Error fetching product data for ID ${productId}:`, error);
		throw error;
	}
}

async function updateProductData(mktPlaceDataUrl, product) {
	try {
		// Update the product data in the marketplace data service
		const response = await fetch(`${mktPlaceDataUrl}/product/${product.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(product)
		});
		
		if (!response.ok) {
			if (response.status === 404) {
				console.warn(`Product with ID ${product.id} not found in marketplace data service`);
				return null;
			}
			throw new Error(`Error updating product data: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`Error updating product data for ID ${product.id}:`, error);
		throw error;
	}
}
