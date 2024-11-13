# 1. Install The Graph CLI globally
npm install -g @graphprotocol/graph-cli

# 2. Create a new directory for your subgraph
mkdir my-subgraph
cd my-subgraph

# 3. Initialize a new subgraph project
# For an existing contract:
graph init \
  --from-contract <CONTRACT_ADDRESS> \
  --network mainnet \
  --contract-name <CONTRACT_NAME> \
  YourGithubName/subgraph-name

# 4. Navigate to the created directory
cd subgraph-name

# 5. Install dependencies
yarn install

# 6. Generate types from schema
yarn codegen

# 7. Build the subgraph
yarn build

# 8. Authenticate with Graph deployment (choose ONE of these methods)
# For hosted service:
graph auth --node https://api.thegraph.com/deploy/ <YOUR_ACCESS_TOKEN>
# For studio:
graph auth --node https://api.studio.thegraph.com/deploy/ <YOUR_ACCESS_TOKEN>

# 9. Deploy the subgraph (choose ONE of these methods)
# For hosted service:
graph deploy --node https://api.thegraph.com/deploy/ YourGithubName/subgraph-name
# For studio:
graph deploy --node https://api.studio.thegraph.com/deploy/ subgraph-name



# Clean up existing files
rm -rf generated
rm -rf build

# Remove existing ABI files
rm abis/UniswapV2Pair.json

# Install graph-cli if not already installed
yarn add @graphprotocol/graph-cli

# Fetch ABIs and generate types
yarn codegen

# Build
yarn build


# Clean existing generated files
rm -rf generated
rm -rf build

# Regenerate types and build
yarn codegen
yarn build









# 1. Install CLI
npm install -g @graphprotocol/graph-cli

# 2. Create directory
mkdir landwolf-subgraph
cd landwolf-subgraph

# 3. Initialize
graph init \
  --from-contract 0x9c7D4Fb43919DEf524C1a9D92FE836169eAF0615 \
  --network mainnet \
  --contract-name LandWolf \
  FabioGunderson/landwolf

# 4. Navigate
cd landwolf

# 5. Install dependencies
yarn install

# 6. Generate types
yarn codegen

# 7. Build
yarn build

# 8. Authenticate (using your key)
graph auth --node https://api.thegraph.com/deploy/ 9a41a39d565c45ce47e2a9666983a302

# 9. Deploy
graph deploy --node https://api.thegraph.com/deploy/ FabioGunderson/landwolf
# When prompted for version, enter: v0.0.1

graph auth 9a41a39d565c45ce47e2a9666983a302

graph deploy fabiogunderson/landwolf



{
  accounts(
    first: 100, 
    orderBy: balance, 
    orderDirection: desc, 
    where: { balance_gt: "0" }
  ) {
    id  # This is the wallet address
    balance
    isBot  # Shows if they're blacklisted
    isBotGuarded
    lastTransactionTimestamp
    # Convert balance to human-readable format
    # The balance will be in wei (18 decimals), so you might want to divide by 10^18
  }
}


{
  accounts(
    first: 100,
    orderBy: balance,
    orderDirection: desc,
    where: { balance_gt: "0" }
  ) {
    id
    balance
    isBot
    isBotGuarded
    lastTransactionTimestamp
    transfersTo(first: 1, orderBy: timestamp, orderDirection: desc) {
      value
      timestamp
      isBuy
    }
    transfersFrom(first: 1, orderBy: timestamp, orderDirection: desc) {
      value
      timestamp
      isSell
    }
  }
}


What to Keep in Subgraph:


Raw event data
Basic entity relationships
Simple aggregations
Essential flags/markers


What to Move to Application Layer:


Complex P&L calculations
Price analysis
User metrics
Trading statistics
Portfolio analysis




graph auth 9a41a39d565c45ce47e2a9666983a302
graph auth [deploy-key]

graph deploy --node https://api.studio.thegraph.com/deploy/94090 practice


graph deploy --node https://api.studio.thegraph.com/deploy/ practice

but fucking deploy a new version genius lmfao
cat ~/.bashrc | clip.exe
