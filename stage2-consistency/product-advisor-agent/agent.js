import OpenAI from "openai";
import { initAgent } from "@orra.dev/sdk";
import schema from './schema.json' assert { type: 'json' };
import Advisor from "./core.js";
import { Agent } from "agents";

export class ProductAdvisorAgent extends Agent {
	constructor(state, env) {
		super(state, env);
		// Block concurrency while initializing to ensure state consistency
		this.ctx.blockConcurrencyWhile(async () => {
			await this.initialize();
		});
	}
	async initialize() {
		console.log("Initializing Product Advisor Agent");
		
		// Initialize OpenAI client
		this.openai = new OpenAI({
			apiKey: this.env.OPENAI_API_KEY
		});
		
		// Set up orra integration
		try {
			// Initialize state structure if first time
			const currentState = this.state || {};
			currentState.agentName = 'product-advisor';
			currentState.description = 'An agent that helps users find products based on their needs and preferences.';
			await this.setState(currentState);
			await this.registerWithOrra();
		} catch (error) {
			console.error("Error during agent initialization:", error);
		}
		
		// Schedule a health check to keep the agent alive and responsive
		// This is crucial for maintaining the agent across hibernation
		await this.schedule(30, "healthCheck");
	}
	
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
				console.log('Processing product advisory task:', task.id);
				console.log('Input:', task.input);
				
				const { query } = task.input;
				
				// Use LLM to generate recommendations
				const advisor = new Advisor({ openai: this.openai, mktPlaceDataUrl: this.env.MARKETPLACE_DATA_URL });
				return await advisor.recommendProduct(query);
			});
			
			console.log('Product Advisor Agent registered successfully with Orra');
		} catch (error) {
			console.error('Failed to register Product Advisor Agent with Orra:', error);
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
		console.log("Product Advisor Agent health check completed");
		
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
