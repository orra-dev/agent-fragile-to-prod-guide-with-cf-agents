import { Agent } from "agents";
import OpenAI from "openai";
import { initAgent } from "@orra.dev/sdk";
import schema from './schema.json' assert { type: 'json' };
import { generateDeliveryEstimates } from "./core.js";

export class DeliveryAgent extends Agent {
	constructor(state, env) {
		super(state, env);
		// Block concurrency while initializing to ensure state consistency
		this.ctx.blockConcurrencyWhile(async () => {
			await this.initialize();
		});
	}
	
	// Initialize the agent - set up OpenAI, load data, and schedule health checks
	async initialize() {
		console.log("Initializing Delivery Agent");
		
		// Initialize OpenAI client
		this.openai = new OpenAI({
			apiKey: this.env.OPENAI_API_KEY
		});
		
		// Set up orra integration
		try {
			// Initialize state structure if first time
			const currentState = this.state || {};
			currentState.agentName = 'delivery-agent';
			currentState.description = 'An agent that provides intelligent delivery estimates based on product, location, and current conditions.';
			await this.setState(currentState);
			await this.registerWithOrra();
		} catch (error) {
			console.error("Error during agent initialization:", error);
		}
		
		// Schedule a health check to keep the agent alive and responsive
		// This is crucial for maintaining the agent across hibernation
		await this.schedule(30, "healthCheck");
	}
	
	// Register the agent with Orra system
	async registerWithOrra() {
		try {
			this.orraAgent = initAgent({
				name: this.state.agentName,
				orraUrl: this.env.ORRA_URL,
				orraKey: this.env.ORRA_API_KEY,
				persistenceOpts: this.persistenceOpts(),
				WebSocketImpl: WebSocket
			});
			
			// Register the agent with Orra
			await this.orraAgent.register({
				description: this.state.description,
				schema
			});
			
			// Start handling tasks from Orra
			this.orraAgent.start(async (task) => {
				console.log('Processing delivery estimation task:', task.id);
				console.log('Input:', task.input);
				
				const { userId, productId, inStock } = task.input;
				
				// Use our internal method to generate delivery estimates
				const mktPlaceDataUrl = this.env.MARKETPLACE_DATA_URL;
				return await generateDeliveryEstimates(this.openai, mktPlaceDataUrl, userId, productId, inStock);
			});
			
			console.log('Delivery Agent registered successfully with Orra');
		} catch (error) {
			console.error('Failed to register Delivery Agent with Orra:', error);
			throw error;
		}
	}
	
	persistenceOpts() {
		return {
			method: "custom",
			customSave: async (identity) => {
				// Save the Orra identity in our agent state
				await this.setState({
					...this.state,
					orraIdentity: identity
				});
				return true;
			},
			customLoad: async () => {
				return this.state.orraIdentity;
			}
		};
	}
	
	// Health check to keep the agent alive
	async healthCheck() {
		console.log("Delivery Agent health check completed");
		
		// Re-schedule the health check to ensure continuity
		await this.schedule(30, "healthCheck");
	}
	
	// Handle HTTP requests to the agent
	async onRequest(request) {
		const url = new URL(request.url);
		
		// Basic health endpoint for monitoring
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({ status: 'healthy' }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		// Return 404 for unknown endpoints
		return new Response("Not found", { status: 404 });
	}
}
