# Marketplace Assistant - Initial Monolithic Application

This is the updated implementation of our [AI-powered Marketplace Assistant](https://github.com/orra-dev/agent-fragile-to-prod-guide/tree/main/monolithic-app#marketplace-assistant---initial-monolithic-application), now powered by [Cloudflare Agents](https://developers.cloudflare.com/agents/). It's a monolithic application that handles all aspects of the shopping experience, from product recommendations to delivery estimation, purchase processing, and notifications.

## Architecture

This implementation leverages Cloudflare Agents. The assistant uses OpenAI for tool calling and interacts with users to find products and execute tasks through a terminal-based interface.

There's a minor twist where we also call another Agent using a tool call (simulated for delivery estimates).

- Understanding user requests
- Product recommendations
- Inventory management
- Purchase processing
- Delivery estimation
- Customer notifications

_We can break this into a crew of agents, but we’d still be dealing with similar limitations for production!_

![](images/MonolithArchitecture.png)

## Design Limitations

This initial implementation has several limitations:

1. **High Latency**: The monolithic agent must process all aspects of a user request sequentially.
2. **Token Inefficiency**: The whole context is passed to the LLM for every operation, even for deterministic tasks.
3. **Reliability Issues**: A failure in any component impacts the entire application.
4. **Debugging Complexity**: Difficult to isolate issues within the monolith.
5. **Scalability Challenges**: The entire application needs to scale together - however cloudflare durable objects do simplify this.
6. **Managing State Across failures is hard**: Even with a durable object's internal trackable state, this is still an issue as a failure might occur post transaction completion.

### Critical Bug: Inventory Inconsistency

The application has a critical issue that demonstrates the need for proper transaction handling:

1. When a user attempts to purchase a product, the inventory is reduced BEFORE payment processing
2. If the payment fails (simulated 50% of the time) because the Payment Gateway is down, the inventory remains reduced
3. This creates a data inconsistency where products appear out of stock but were never actually purchased
4. In a production system, this would require manual intervention to fix

This bug was deliberately included to demonstrate why compensation handling is necessary in distributed systems, which we'll address in Stage 2 of the guide.

**NOTE**: We've kept the failure quite simple here. Payments can also be rejected quite a bit later in the future - in that case more complicated recovery is required.

## Running the Application

1. Install dependencies:
```shell
npm install
```

2. Setup the application's env vars:
```shell
cp .dev.vars.example .dev.vars
# Update the OPENAI_API_KEY with your own value.
```

3. Setup the application's data:
```shell
cp src/data.json-example src/data.json
```

4. Start the application:
```shell
npm start
```

5. Open another terminal and start the terminal interface:
```shell
npm run terminal
```

6. Interact with the assistant via the terminal interface, [using this interaction script](../README.md#example-user-interaction).

## Next Steps

In the next stage, we'll refactor this monolithic application into a multi-agent architecture using [orra](https://github.com/orra-dev/orra) to orchestrate different specialised components.
