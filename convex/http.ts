import { httpRouter } from 'convex/server'
import { auth } from './auth'

const http = httpRouter()

// Mounts the Convex Auth HTTP routes (token exchange, OAuth callbacks, etc.).
auth.addHttpRoutes(http)

export default http
