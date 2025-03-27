const functionSpecs = [
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
	}
];

export default class Advisor {
	openaiClient;
	mktPlaceDataUrl;
	
	constructor(opts) {
		this.openaiClient = opts.openai;
		this.mktPlaceDataUrl = opts.mktPlaceDataUrl;
	}
	
	async recommendProduct(query) {
		const data = await this.#run(query);
		return extractAndParseJson(data.response);
	}
	
	async #run(query, conversationHistory = []) {
		try {
			// Add the user input to the conversation history
			conversationHistory.push({ role: "user", content: query });
			
			// Define the system message
			const systemMessage = {
				role: "system",
				content: `You are an AI marketplace assistant. Given a user query and product data, recommend the most suitable products.
		For each recommendation, provide reasoning based on the user's needs.
		
		Always be helpful, concise, and provide specific product recommendations that match user criteria.
		
		Focus ONLY on products that are in stock (inStock > 0).

    Generate recommendations in JSON format with reasoning for why each product matches the user's needs.
    
		USE THIS SCHEMA FOR THE FINAL ANSWER:
		{
			"recommendations": [
				{
		      "id": "the recommended product's Id",
		      "name": "the recommended product's name",
		      "description": "the recommended product's description",
		      "reasoning": "the reason for recommending the product",
	      }
	    ]
		}
		
		If there are NO matching products that are in stock (inStock > 0) return an empty recommendations array.`
			};
			
			// Create the messages array for the API call
			const messages = [ systemMessage, ...conversationHistory ];
			
			// Step 1: Call OpenAI API with function definitions
			const response = await this.openaiClient.chat.completions.create({
				model: "gpt-4o",
				messages: messages,
				functions: functionSpecs,
				function_call: "auto",
				response_format: { type: "json_object" },
				temperature: 0.7,
			});
			
			const responseMessage = response.choices[0].message;
			
			// Step 2: Check if the model wants to call a function
			if (responseMessage.function_call) {
				const functionName = responseMessage.function_call.name;
				const functionArgs = JSON.parse(responseMessage.function_call.arguments);
				
				console.log(`\nCalling function: ${functionName} with args:`, functionArgs);
				
				// Call the function
				const functionResponse = await (this.#getAvailableFunctions()[functionName](functionArgs));
				
				// Step 3: Append function response to messages
				conversationHistory.push(responseMessage); // Add assistant's function call to history
				
				// Add the function response to chat history
				conversationHistory.push({
					role: "function",
					name: functionName,
					content: JSON.stringify(functionResponse)
				});
				
				// Step 4: Get a new response from the model with the function response
				const secondResponse = await this.openaiClient.chat.completions.create({
					model: "gpt-4o",
					messages: [ ...messages, responseMessage, {
						role: "function",
						name: functionName,
						content: JSON.stringify(functionResponse)
					} ],
					functions: functionSpecs,
					function_call: "auto",
					temperature: 0.7,
				});
				
				const secondResponseMessage = secondResponse.choices[0].message;
				
				// Handle nested function calls if needed
				if (secondResponseMessage.function_call) {
					const secondFunctionName = secondResponseMessage.function_call.name;
					const secondFunctionArgs = JSON.parse(secondResponseMessage.function_call.arguments);
					
					console.log(`\nCalling second function: ${secondFunctionName} with args:`, secondFunctionArgs);
					
					const secondFunctionResponse = await (this.#getAvailableFunctions()[secondFunctionName](secondFunctionArgs));
					
					conversationHistory.push(secondResponseMessage);
					
					conversationHistory.push({
						role: "function",
						name: secondFunctionName,
						content: JSON.stringify(secondFunctionResponse)
					});
					
					// Get final response from the model
					const finalResponse = await this.openaiClient.chat.completions.create({
						model: "gpt-4o",
						messages: [ ...messages, responseMessage, {
							role: "function",
							name: functionName,
							content: JSON.stringify(functionResponse)
						}, secondResponseMessage, {
							role: "function",
							name: secondFunctionName,
							content: JSON.stringify(secondFunctionResponse)
						} ],
						temperature: 0.7,
					});
					
					const finalResponseMessage = finalResponse.choices[0].message;
					conversationHistory.push(finalResponseMessage);
					
					return {
						response: finalResponseMessage.content,
						conversationHistory
					};
				}
				
				conversationHistory.push(secondResponseMessage);
				
				return {
					response: secondResponseMessage.content,
					conversationHistory
				};
			}
			
			// If no function call, just return the response
			conversationHistory.push(responseMessage);
			
			return {
				response: responseMessage.content,
				conversationHistory
			};
		} catch (error) {
			console.error("Error in product advisor agent:", error);
			throw error;
		}
	}
	
	#getAvailableFunctions() {
		return {
			searchProducts: async (args) => {
				const { category, priceMax, tags, condition } = args;
				
				let filteredProducts = await this.#getAllProducts();
				
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
			},
		}
	}
	
	async #getAllProducts() {
		try {
			// Fetch the product data from the marketplace data service
			const response = await fetch(`${this.mktPlaceDataUrl}/products`);
			
			if (!response.ok) {
				if (response.status === 404) {
					console.warn(`Endpoint /products not found in marketplace data service`);
					return null;
				}
				throw new Error(`Error fetching products: ${response.status} ${response.statusText}`);
			}
			
			return await response.json();
		} catch (error) {
			console.error(`Error fetching products:`, error);
			throw error;
		}
	}
}

function extractAndParseJson(input) {
	// Extract the JSON content
	const jsonMatch = input.match(/```json\n([\s\S]*?)\n```/);
	
	if (!jsonMatch) {
		throw new Error("No JSON content found between ```json``` tags");
	}
	
	const jsonString = jsonMatch[1];
	
	// Parse the JSON
	try {
		return JSON.parse(jsonString);
	} catch (error) {
		throw new Error(`Failed to parse JSON: ${error.message}`);
	}
}
