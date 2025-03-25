import { AgentClient } from "agents/client";
import readline from 'node:readline';
import WS from "ws"; // Add WebSocket implementation

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Connect to our Cloudflare Worker
const conn  = new AgentClient({
	agent: "marketplace-agent",
	name: "default",
	host: "ws://127.0.0.1:8787",
	WebSocket: WS // Provide WebSocket polyfill
});

conn.addEventListener("open", (event) => {
	console.log("Welcome to the Marketplace Assistant!");
	console.log("Ask about products, availability, or make a purchase.");
	console.log("-----------------------------------------------------------------");
	console.log("Example queries:");
	console.log("- I need a laptop for programming under $800");
	console.log("- Is the Dell XPS 13 in stock?");
	console.log("- I'd like to buy the Dell XPS 13");
	console.log("- When would the MacBook Air be delivered?");
	console.log("Special commands:");
	console.log("- 'status' - Show current inventory status");
	console.log("- 'exit' - Quit the application");
	console.log("-----------------------------------------------------------------");
	
	promptUser();
});

conn.addEventListener("message", (event) => {
	process.stdout.write('\r\x1b[K');
	
	const message = JSON.parse(event.data);
	switch (message.type) {
		case 'response':
			console.log(`\nAssistant: ${message.content}`);
			break;
		case 'inventory':
			console.log("\n----- CURRENT INVENTORY STATUS -----");
			message.products.forEach(product => {
				console.log(`ID[${product.id}] - ${product.name}: ${product.inStock} in stock`);
			});
			console.log("------------------------------------\n");
			break;
		case 'error':
			console.log(`\nError: ${message.message}`);
			break;
		case 'info':
			console.log(`\nInfo: ${message.message}`);
			break;
	}
	
	promptUser();
});

function promptUser() {
	rl.question("\nYou: ", (input) => {
		if (input.toLowerCase() === 'exit') {
			conn.close();
			rl.close();
			return;
		}
		
		if (input.toLowerCase() === 'status') {
			console.log(`\ninput: ${input}`);
			conn.send(JSON.stringify({ type: 'status' }));
		} else {
			conn.send(JSON.stringify({
				type: 'message',
				content: input
			}));
		}
	});
}

conn.addEventListener("close", (event) => {
	console.log("\nThank you for using the Marketplace Assistant!");
	rl.close();
});

conn.addEventListener('error', (error) => {
	console.error('WebSocket error:', error);
});
