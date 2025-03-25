// index.js - Main Agent file
import { Agent } from "agents";
import OpenAI from "openai";
import * as tools from "./tools.js";
import data from './data.json' assert { type: 'json' };

export class MarketplaceAgent extends Agent {
	constructor(state, env) {
		super(state, env);
		// blockConcurrencyWhile will ensure that initialized will always be true
		this.ctx.blockConcurrencyWhile(async () => {
			await this.initialize()
		});
	}

	// Initialize the agent when it's created
	async initialize() {
		// Initialize OpenAI client
		this.openai = new OpenAI({
			apiKey: this.env.OPENAI_API_KEY
		});
		
		if (this.state?.dataLoaded) {
			await this.schedule(60, "healthCheck");
			return
		}
		
		try {
			// Initialize state with data from the imported JSON
			const currentState = this.state || {};
			currentState.products = data.products;
			currentState.users = data.users;
			currentState.orders = data.orders;
			currentState.dataLoaded = true;
			
			// Set the state with loaded data
			await this.setState(currentState);
			console.log(`Loaded ${currentState.products.length} products and ${currentState.users.length} users from bundled data`);
		} catch (error) {
			console.error("Error initializing data:", error);
			throw new Error("Failed to initialize essential data. Agent cannot start.");
		}
		
		await this.schedule(60, "healthCheck");
	}
	
	async onConnect(connection, ctx) {
		// Store connection with unique ID
		this.connections.set(connection.id, connection);
		
		// Send welcome message
		connection.send(JSON.stringify({
			type: 'info',
			message: "Connected to Marketplace Agent"
		}));
	}
	
	async onMessage(connection, rawMessage) {
		try {
			const message = JSON.parse(rawMessage);
			
			switch (message.type) {
				case 'message':
					const response = await this.processMessage(message.content);
					connection.send(JSON.stringify({
						type: 'response',
						content: response?.response
					}));
					
					break;
				
				case 'status':
					this.sendInventory(connection);
					break;
				
				default:
					throw new Error(`Unknown message type: ${message.type}`);
			}
		} catch (error) {
			connection.send(JSON.stringify({
				type: 'error',
				message: error.message
			}));
		}
	}

// Process messages using OpenAI
	async processMessage(userInput, conversationHistory = []) {
		try {
			// Add the user input to the conversation history
			conversationHistory.push({ role: "user", content: userInput });
			
			// Define the system message
			const systemMessage = {
				role: "system",
				content: `You are an AI marketplace assistant helping users find, purchase, and arrange delivery for products.
      
      Always be helpful, concise, and provide specific product recommendations that match user criteria.
      
      The current user is John Doe (user-1). When processing purchases or checking delivery estimates,
      always use this user ID unless otherwise specified.
      
      If the user expresses a clear intent to purchase, use the processPurchase function directly.
      If the user wants to know about delivery times, use the getDeliveryEstimate function.`
			};
			
			// Create the messages array for the API call
			const messages = [ systemMessage, ...conversationHistory ];
			
			// Track if inventory was changed
			let inventoryChanged = false;
			
			// Step 1: Call OpenAI API with function definitions
			const response = await this.openai.chat.completions.create({
				model: "gpt-4o",
				messages: messages,
				functions: tools.functionSpecs,
				function_call: "auto",
				temperature: 0.7,
			});
			
			const responseMessage = response.choices[0].message;
			
			// Step 2: Check if the model wants to call a function
			if (responseMessage.function_call) {
				const functionName = responseMessage.function_call.name;
				const functionArgs = JSON.parse(responseMessage.function_call.arguments);
				console.log(`\nCalling function: ${functionName} with args:`, functionArgs);
				
				// Call the function with the current state
				const functionResponse = tools[functionName](this.state, functionArgs);
				
				// Check if this function modifies inventory
				if (functionName === "processPurchase" && functionResponse.success) {
					inventoryChanged = true;
					// Save state after modification
					await this.setState(this.state);
				}
				
				// Step 3: Append function response to messages
				conversationHistory.push(responseMessage); // Add assistant's function call to history
				
				// Add the function response to chat history
				conversationHistory.push({
					role: "function",
					name: functionName,
					content: JSON.stringify(functionResponse)
				});
				
				// Step 4: Get a new response from the model with the function response
				const secondResponse = await this.openai.chat.completions.create({
					model: "gpt-4o",
					messages: [ ...messages, responseMessage, {
						role: "function",
						name: functionName,
						content: JSON.stringify(functionResponse)
					} ],
					functions: tools.functionSpecs,
					function_call: "auto",
					temperature: 0.7,
				});
				
				const secondResponseMessage = secondResponse.choices[0].message;
				
				// Handle nested function calls if needed
				if (secondResponseMessage.function_call) {
					const secondFunctionName = secondResponseMessage.function_call.name;
					const secondFunctionArgs = JSON.parse(secondResponseMessage.function_call.arguments);
					console.log(`\nCalling second function: ${secondFunctionName} with args:`, secondFunctionArgs);
					
					const secondFunctionResponse = tools[secondFunctionName](this.state, secondFunctionArgs);
					
					// Check if this function modifies inventory
					if (secondFunctionName === "processPurchase" && secondFunctionResponse.success) {
						inventoryChanged = true;
						// Save state after modification
						await this.setState(this.state);
					}
					
					conversationHistory.push(secondResponseMessage);
					conversationHistory.push({
						role: "function",
						name: secondFunctionName,
						content: JSON.stringify(secondFunctionResponse)
					});
					
					// Get final response from the model
					const finalResponse = await this.openai.chat.completions.create({
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
						conversationHistory,
						inventoryChanged
					};
				}
				
				conversationHistory.push(secondResponseMessage);
				return {
					response: secondResponseMessage.content,
					conversationHistory,
					inventoryChanged
				};
			}
			
			// If no function call, just return the response
			conversationHistory.push(responseMessage);
			return {
				response: responseMessage.content,
				conversationHistory,
				inventoryChanged
			};
		} catch (error) {
			console.error("Error in marketplace assistant:", error);
			return {
				response: "I'm sorry, I encountered an error while processing your request. Please try again.",
				conversationHistory,
				inventoryChanged: false
			};
		}
	}
	
	sendInventory(connection) {
		const products = this.state.products.map(p => ({
			id: p.id,
			name: p.name,
			inStock: p.inStock
		}));
		
		console.log(`Received ${products.length} products for ${connection}`);
		
		connection.send(JSON.stringify({
			type: 'inventory',
			products: products
		}));
	}
	
	async onError(connection, error) {
		if(!error) { return }
		console.error(`WS error: ${error}`);
	}
	
	async onClose(connection, code, reason, wasClean) {
		console.log(`WS closed: ${code} - ${reason} - wasClean: ${wasClean}`);
		connection.close();
	}

// Regular health check
	async healthCheck() {
		console.log("Agent health check completed");
	}
}
