export const supportedStatuses = [
	'unknown-product',
	'unknown-user',
	'payment-failed',
	'order-processed'
];

export async function purchaseProduct(mktPlaceDataUrl, userId, productId, deliveryDate) {
	// Get the user and product
	const user = await getUserData(mktPlaceDataUrl, userId);
	const product = await getProductData(mktPlaceDataUrl, productId);
	
	console.log('Found user:', user);
	console.log('Found product:', product);
	
	if (!user) {
		return {
			success: false,
			status: supportedStatuses[1]
		};
	}
	
	if (!product) {
		return {
			success: false,
			status: supportedStatuses[0]
		};
	}
	
	const transactionId = processPayment(userId, productId, product.price);
	
	// Create the order
	const order = {
		id: `order-${Date.now()}`,
		userId,
		productId,
		productName: product.name,
		price: product.price,
		transactionId: transactionId,
		status: supportedStatuses[3],
		createdAt: new Date().toISOString(),
		deliveryDate: deliveryDate
	};
	
	// Add to the order database
	await addOrder(mktPlaceDataUrl, order);
	
	// Send notification
	sendNotification(userId, `Your order for ${product.name} has been confirmed! Estimated delivery: ${deliveryDate}`);
	
	return {
		success: true,
		order
	};
}

// Payment processing function
function processPayment() {
	throw new Error('PaymentGatewayDown');
}

// Simulated notification
function sendNotification(userId, message) {
	// In a real application, this would send an email or push notification
	console.log(`Notification to user ${userId}: ${message}`);
	return {
		success: true,
		timestamp: new Date().toISOString()
	};
}

async function getUserData(mktPlaceDataUrl, userId) {
	try {
		// Fetch the user data from the marketplace data service
		const response = await fetch(`${mktPlaceDataUrl}/user/${userId}`);
		
		if (!response.ok) {
			if (response.status === 404) {
				console.warn(`User with ID ${userId} not found in marketplace data service`);
				return null;
			}
			throw new Error(`Error fetching user data: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`Error fetching user data for ID ${userId}:`, error);
		throw error;
	}
}

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

async function addOrder(mktPlaceDataUrl, order) {
	try {
		// Send a POST request to add the order to the marketplace data service
		const response = await fetch(`${mktPlaceDataUrl}/orders`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(order)
		});
		
		if (!response.ok) {
			throw new Error(`Error adding order: ${response.status} ${response.statusText}`);
		}
		
		const addedOrder = await response.json();
		console.log(`Order ${addedOrder.id} added successfully`);
		return addedOrder;
	} catch (error) {
		console.error(`Error adding order:`, error);
		throw error;
	}
}
