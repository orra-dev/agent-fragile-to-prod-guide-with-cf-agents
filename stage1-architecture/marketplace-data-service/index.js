import initialData from './init-data.json' assert { type: 'json' };

// MarketplaceDataStore implementation as a Durable Object
export class MarketplaceDataStore {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		
		// Initialize data on first access
		this.state.blockConcurrencyWhile(async () => {
			if (!await this.state.storage.get('initialized')) {
				await this.initializeData();
			}
		});
	}
	
	// Initialize the datastore with our hardcoded data
	async initializeData() {
		try {
			// Store the data in Durable Object storage
			await this.state.storage.put('products', initialData.products);
			await this.state.storage.put('users', initialData.users);
			await this.state.storage.put('orders', initialData.orders);
			await this.state.storage.put('initialized', true);
			
			console.log('MarketplaceDataStore initialized successfully');
		} catch (error) {
			console.error('Error initializing MarketplaceDataStore:', error);
		}
	}
	
	// Handle requests to the datastore
	async fetch(request) {
		const url = new URL(request.url);
		const path = url.pathname;
		
		// GET requests for retrieving data
		if (request.method === 'GET') {
			// Get all products
			if (path === '/products') {
				const products = await this.state.storage.get('products');
				return new Response(JSON.stringify(products), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			// Get all users
			else if (path === '/users') {
				const users = await this.state.storage.get('users');
				return new Response(JSON.stringify(users), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			// Get a specific product by ID
			else if (path.startsWith('/product/')) {
				const productId = path.split('/product/')[1];
				const products = await this.state.storage.get('products');
				const product = products.find(p => p.id === productId);
				
				if (product) {
					return new Response(JSON.stringify(product), {
						headers: { 'Content-Type': 'application/json' }
					});
				}
				return new Response('Product not found', { status: 404 });
			}
			// Get a specific user by ID
			else if (path.startsWith('/user/')) {
				const userId = path.split('/user/')[1];
				const users = await this.state.storage.get('users');
				const user = users.find(u => u.id === userId);
				
				if (user) {
					return new Response(JSON.stringify(user), {
						headers: { 'Content-Type': 'application/json' }
					});
				}
				return new Response('User not found', { status: 404 });
			}
		}
		// PUT requests for updating data
		else if (request.method === 'PUT') {
			// Update a product
			if (path.startsWith('/product/')) {
				const productId = path.split('/product/')[1];
				const products = await this.state.storage.get('products');
				const updateData = await request.json();
				
				const productIndex = products.findIndex(p => p.id === productId);
				
				if (productIndex === -1) {
					return new Response('Product not found', { status: 404 });
				}
				
				// Update the product with new data
				products[productIndex] = {
					...products[productIndex],
					...updateData
				};
				
				// Save back to storage
				await this.state.storage.put('products', products);
				
				return new Response(JSON.stringify(products[productIndex]), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
		
		// If no matching route, return 404
		return new Response('Not found', { status: 404 });
	}
}

// Main worker entry point
export default {
	async fetch(request, env, ctx) {
		// Get the datastore Durable Object
		const id = env.MARKETPLACE_DATA.idFromName('shared-data');
		const dataStore = env.MARKETPLACE_DATA.get(id);
		
		// Forward the request to the datastore object
		return dataStore.fetch(request);
	}
};
