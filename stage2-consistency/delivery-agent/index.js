// Export the agent to make it available to the worker
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		
		// Only handle root and health check paths
		if (url.pathname !== "/" && url.pathname !== "/health") {
			return new Response("Not found", { status: 404 });
		}
		
		try {
			// Create and activate the agent Durable Object (always using the same ID)
			const id = env.DeliveryAgent.idFromName("default");
			const agent = env.DeliveryAgent.get(id);
			
			// Create a new request with the necessary headers
			const newRequest = new Request(request.url, {
				method: request.method,
				headers: {
					...Object.fromEntries(request.headers),
					'x-partykit-namespace': 'default',
					'x-partykit-room': 'default'
				},
				body: request.body,
				redirect: request.redirect,
				signal: request.signal
			});
			
			// This initializes the agent if it's the first access
			const response = await agent.fetch(newRequest);
			
			// For root path, return a simple confirmation message
			if (url.pathname === "/") {
				return new Response("DeliveryAgent activated", { status: 200 });
			}
			
			// For health checks, pass through the agent's response
			return response;
			
		} catch (error) {
			return new Response(`Activation error: ${error.message}`, { status: 500 });
		}
	}
};

export { DeliveryAgent } from "./agent.js";
