import { createServer } from '@graphql-yoga/node'
import { schema } from './schema'
import { createContext } from './context'

async function main() {
  const server = createServer({ schema, context: createContext })
  await server.start()
}

main()
