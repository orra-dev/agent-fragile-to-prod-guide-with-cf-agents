import { initService } from "@orra.dev/sdk";
import schema from './schema.json' with { type: 'json' };
import { purchaseProduct } from "./core.js";

const SECONDS = 1000;

export class PurchasingToolService {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		
		// Initialize data on first access
		this.state.blockConcurrencyWhile(async () => {
			await this.initialize();
			// Set up an alarm to keep the DO active
			await this.state.storage.setAlarm(Date.now() + 10 * SECONDS);
		});
	}
	
	async initialize() {
		console.log("Initializing Purchasing Tool Service");
		
		try {
			this.orraSvc = initService({
				name: 'purchasing-service',
				orraUrl: this.env.ORRA_URL,
				orraKey: this.env.ORRA_API_KEY,
				persistenceOpts: this.persistenceOpts(),
				WebSocketImpl: WebSocket
			});
			
			// Register the agent with Orra
			await this.orraSvc.register({
				description: `A service that makes marketplace product purchases on behalf of a user. It creates purchase orders that include shipping details, makes payments against external payment gateways and notifies users.`,
				schema
			});
			
			// Start handling tasks from Orra
			this.orraSvc.start(async (task) => {
				console.log('Processing purchase task:', task.id);
				console.log('Input:', task.input);
				
				const { userId, productId, deliveryDate } = task.input;
				
				const mktPlaceDataUrl = this.env.MARKETPLACE_DATA_URL;
				
				// Process the purchase order
				const result = purchaseProduct(mktPlaceDataUrl, userId, productId, deliveryDate);
				if (result.status !== 'success') {
				  return task.abort(result);
				}
				return result;
			});
			
			console.log('Payment Service started successfully');
			
		} catch (error) {
			console.error("Error during service initialization:", error);
		}
	}
	
	// Handle the alarm event
	persistenceOpts() {
		return {
			method: "custom",
			customSave: async (identity) => {
				// Save the Orra identity in our do state
				await this.state.storage.put('orraIdentity', identity);
			},
			customLoad: async () => {
				return await this.state.storage.get('orraIdentity');
			}
		};
	}
	
	async alarm() {
		console.log('Ping alarm triggered to keep PurchasingToolService active');
		
		// Perform a simple operation to ensure the DO remains active
		const currentTime = new Date().toISOString();
		await this.state.storage.put('lastPing', currentTime);
		
		// Reschedule the alarm to run again in 10 seconds
		await this.state.storage.setAlarm(Date.now() + 10 * SECONDS);
	}
	
	// Handle HTTP requests to the agent
	async fetch(request) {
		const url = new URL(request.url);
		
		// For root path, return a simple confirmation message
		if (url.pathname === "/") {
			return new Response("Purchasing Tool Service activated", { status: 200 });
		}
		
		// Basic health endpoint for monitoring
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({
				status: 'healthy',
				lastPing: await this.state.storage.get('lastPing')
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		// Return 404 for unknown endpoints
		return new Response("Not found", { status: 404 });
	}
}
