// Main worker entry point
export default {
	async fetch(request, env) {
		// Get the datastore Durable Object
		const id = env.PURCHASING_TOOL_SERVICE.idFromName('default');
		const stub = env.PURCHASING_TOOL_SERVICE.get(id);
		
		// Forward the request to the datastore object
		return stub.fetch(request);
	}
};

export { PurchasingToolService } from "./do.js";
