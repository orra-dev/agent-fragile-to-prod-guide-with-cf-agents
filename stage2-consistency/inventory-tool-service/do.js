import { initService } from "@orra.dev/sdk";
import schema from './schema.json' with { type: 'json' };
import { execInventory, releaseProduct } from "./core.js";

const SECONDS = 1000;

export class InventoryToolService {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		this.mktPlaceDataUrl = this.env.MARKETPLACE_DATA_URL;
		
		// Initialize data on first access
		this.state.blockConcurrencyWhile(async () => {
			await this.initialize();
			// Set up an alarm to keep the DO active
			await this.state.storage.setAlarm(Date.now() + 10 * SECONDS);
		});
	}
	
	async initialize() {
		console.log("Initializing Inventory Tool Service");
		
		try {
			this.orraSvc = initService({
				name: 'inventory-service',
				orraUrl: this.env.ORRA_URL,
				orraKey: this.env.ORRA_API_KEY,
				persistenceOpts: this.persistenceOpts(),
				WebSocketImpl: WebSocket
			});
			
			// Register the agent with Orra
			await this.orraSvc.register({
				description: `A service that manages product inventory, checks availability and reserves products.
Supported actions: checkAvailability (gets product status), reserveProduct (reduces inventory), and releaseProduct (returns inventory).`,
				schema,
				revertible: true // Enable compensations
			});
			
			// Register compensation handler
			this.orraSvc.onRevert(async (task, result, context) => {
				// Only process compensations for reserveProduct actions
				if (task.input.action === 'reserveProduct' && result.success) {
					console.log('Reverting inventory product for task:', task.id);
					console.log('Reverting inventory product hold for product:', result.productId);
					
					// Compensation logic: release the product that was reserved
					const releaseResult = await releaseProduct(this.mktPlaceDataUrl, result.productId, 1);
					console.log('Inventory compensation completed:', JSON.stringify(releaseResult));
				}
			});
			
			// Start handling tasks from Orra
			this.orraSvc.start(async (task) => {
				console.log('Processing inventory task:', task.id);
				console.log('Input:', task.input);
				
				const { action, productId } = task.input;
				const result = await execInventory(this.mktPlaceDataUrl, action, productId);
				if (result.status !== 'success') {
				  return task.abort(result);
				}
				return result;
			});
			
			console.log('Inventory Tool Service started successfully');
			
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
		console.log('Ping alarm triggered to keep InventoryToolService active');
		
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
			return new Response("Inventory Tool Service activated", { status: 200 });
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
