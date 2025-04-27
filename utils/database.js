const Sequelize = require('sequelize')
require('dotenv').config()

const sequelize = new Sequelize(
  process.env.DB_NAME, // Database name
  process.env.DB_USER, // MySQL username
  process.env.DB_PASSWORD, // MySQL password
  {
    host: process.env.DB_HOST, // Docker service name for MySQL
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    pool: {
      max: 5, // Maximum number of connections
      min: 0, // Minimum number of connections
      acquire: 30000, // Max time (ms) to acquire connection
      idle: 10000 // Max time (ms) connection can be idle
    },
    retry: {
      match: [/ECONNREFUSED/, /ECONNRESET/, /ETIMEDOUT/, /EHOSTUNREACH/, /ESOCKETTIMEDOUT/, /EPIPE/, /EAI_AGAIN/],
      max: 5, // Maximum retry attempts
      backoffBase: 1000, // Initial delay in ms
      backoffExponent: 1.5 // Exponential backoff
    },
    define: {
      timestamps: true, // Add createdAt and updatedAt fields
      underscored: true // Use snake_case for auto-generated fields
    },
    logging: false // Disable SQL query logging in console
  }
)

module.exports = sequelize
