// worker.js

import { routeAgentRequest } from "agents";

export default {
	async fetch(request, env) {
		console.log('env', JSON.stringify(env));
		if (!env.OPENAI_API_KEY) {
			console.error(
				"OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
			);
			return new Response("OPENAI_API_KEY is not set", { status: 500 });
		}
		
		return (
			(await routeAgentRequest(request, env)) ||
			Response.json({ msg: "no agent here" }, { status: 404 })
		);
	}
};

// Export the agent class
export { MarketplaceAgent } from "./index.js";
