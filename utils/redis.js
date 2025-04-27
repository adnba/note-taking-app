const redis = require('redis')

// Create basic client
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

// Handle connection events
client.on('connect', () => console.log('Redis connected'))
client.on('error', err => console.error('Redis error:', err))
client.on('ready', () => console.log('Redis ready'))
client.on('end', () => console.log('Redis disconnected'))

// Connect immediately
client.connect().catch(err => console.error('Connection failed:', err))

// Create helper methods
const get = async key => {
  const data = await client.get(key)
  return data ? JSON.parse(data) : null
}
const set = async (key, value, ttl = 60 * 60) => client.set(key, JSON.stringify(value), { EX: ttl })
const del = async key => client.del(key)

exports.getNotes = async userId => get(`user:${userId}:notes`)
exports.setNotes = async (userId, notes) => set(`user:${userId}:notes`, notes, 5 * 60)
exports.delNotes = async userId => del(`user:${userId}:notes`)

exports.getNote = async noteId => get(`note:${noteId}`)
exports.setNote = async (noteId, note) => set(`note:${noteId}`, note, 5 * 60)
exports.delNote = async noteId => del(`note:${noteId}`)
