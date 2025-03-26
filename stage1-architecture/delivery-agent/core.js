
// Supported status codes
export const supportedStatuses = [
	'unknown-product',
	'unknown-user',
	'delivery-estimated',
];

// Generate delivery estimates using LLM
export async function generateDeliveryEstimates(oAIClient, mktPlaceDataUrl, userId, productId, inStock = 0) {
	if (inStock && inStock < 1) {
		throw new Error('CannotEstimateDeliveryForOutOfStockProduct');
	}
	
	const userData = await getUserData(mktPlaceDataUrl, userId);
	const productData = await getProductData(mktPlaceDataUrl, productId);
	
	if (!userData) {
		return {
			success: false,
			status: supportedStatuses[1] // unknown-user
		};
	}
	
	if (!productData) {
		return {
			success: false,
			status: supportedStatuses[0] // unknown-product
		};
	}
	
	// Traffic conditions data (similar to the original implementation)
	const trafficConditions = getTrafficConditions();
	
	// Use LLM to generate intelligent delivery estimates
	const systemPrompt = `You are a delivery logistics expert with 20 years of experience.
Your task is to provide realistic delivery estimates for products being shipped from a warehouse to a customer.
Consider all relevant factors including traffic conditions, weather, distance, and product characteristics.
Always provide both best-case and worst-case scenarios with confidence levels.`;
	
	const userPrompt = `Create delivery estimates for the following:
 
WAREHOUSE ADDRESS: ${productData.warehouseAddress}
CUSTOMER ADDRESS: ${userData.address}

Current traffic and logistics data:
${JSON.stringify(trafficConditions, null, 2)}

Your response should include:
1. A best-case delivery estimate (duration in hours and delivery date)
2. A worst-case delivery estimate (duration in hours and delivery date)
3. Confidence levels for each estimate (low/moderate/high)
4. A brief explanation of your reasoning

Respond in JSON format with these components.

USE THIS SCHEMA FOR THE FINAL ANSWER:
{
  "bestCase": {
    "estimatedDurationHours": "expected duration as decimal value, e.g. 7.5",
    "estimatedDeliveryDate": "estimated delivery date in the future as a timestamp, e.g. 2024-10-02T21:15:00Z",
    "confidenceLevel": "how confident you are. one of: low, moderate or high"
  },
  "worstCase": {
    "estimatedDurationHours": "expected duration as decimal value, e.g. 7.5",
    "estimatedDeliveryDate": "estimated delivery date in the future as a timestamp, e.g. 2024-10-02T21:15:00Z",
    "confidenceLevel": "how confident you are. one of: low, moderate or high"
  },
  "explanation": "Delivery estimate based on current traffic and weather conditions. Factors include road conditions, distance, and typical shipping times."
}`;
	
	try {
		const response = await oAIClient.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt }
			],
			response_format: { type: "json_object" }
		});
		
		const content = JSON.parse(response.choices[0].message.content);
		console.log("Generated delivery estimates:", content);
		
		const fallbackDeliveryEstimatedHours = 72;
		const fallbackDeliveryDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0];
		const fallbackExplanation = "Delivery estimate based on current traffic and weather conditions.";
		
		return {
			status: supportedStatuses[2], // delivery-estimated
			success: true,
			estimatedDays: hoursToDays(content?.worstCase?.estimatedDurationHours || fallbackDeliveryEstimatedHours),
			deliveryDate: content?.worstCase?.estimatedDeliveryDate?.split('T')[0] || fallbackDeliveryDate,
			explanation: content?.explanation || fallbackExplanation,
		};
	} catch (error) {
		console.error("Error generating delivery estimates:", error);
		throw error;
	}
}

// Helper function to convert hours to days
function hoursToDays(hours) {
	if (typeof hours !== "number" || isNaN(hours)) {
		throw new Error("Please provide a valid number of hours.");
	}
	return hours / 24;
}

// Updated getUserData method for the DeliveryAgent class
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
		
		const userData = await response.json();
		return userData;
	} catch (error) {
		console.error(`Error fetching user data for ID ${userId}:`, error);
		throw error;
	}
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
		
		const productData = await response.json();
		return productData;
	} catch (error) {
		console.error(`Error fetching product data for ID ${productId}:`, error);
		throw error;
	}
}

// Get traffic and logistics data
function getTrafficConditions() {
	// Simulated traffic data (same as the original implementation)
	return {
		"route_segments": [
			{
				"segment_id": "A90-ABD-DND",
				"name": "A90 Aberdeen to Dundee",
				"length_km": 108,
				"current_average_speed_kph": 95,
				"normal_average_speed_kph": 100,
				"congestion_level": "light",
				"incidents": []
			},
			{
				"segment_id": "M90-PER-EDI",
				"name": "M90 Perth to Edinburgh",
				"length_km": 45,
				"current_average_speed_kph": 110,
				"normal_average_speed_kph": 110,
				"congestion_level": "none",
				"incidents": [
					{
						"type": "roadworks",
						"location": "Junction 3",
						"description": "Lane closure for resurfacing",
						"delay_minutes": 10
					}
				]
			},
			{
				"segment_id": "A1-NCL-YRK",
				"name": "A1 Newcastle to York",
				"length_km": 140,
				"current_average_speed_kph": 100,
				"normal_average_speed_kph": 110,
				"congestion_level": "moderate",
				"incidents": [
					{
						"type": "accident",
						"location": "Near Darlington",
						"description": "Multi-vehicle collision",
						"delay_minutes": 25
					}
				]
			}
		],
		"weather_conditions": [
			{
				"location": "Northeast",
				"condition": "light_rain",
				"temperature_celsius": 12
			},
			{
				"location": "Midwest",
				"condition": "cloudy",
				"temperature_celsius": 14
			},
			{
				"location": "West Coast",
				"condition": "clear",
				"temperature_celsius": 20
			},
			{
				"location": "Southeast",
				"condition": "partly_cloudy",
				"temperature_celsius": 22
			}
		],
		"vehicles": [
			{
				"type": "van",
				"capacity_cubic_meters": 15,
				"max_range_km": 500,
				"average_speed_kph": 90,
				"availability": "high"
			},
			{
				"type": "truck",
				"capacity_cubic_meters": 40,
				"max_range_km": 800,
				"average_speed_kph": 80,
				"availability": "medium"
			}
		]
	};
}
