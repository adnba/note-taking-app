const { Model, DataTypes } = require('sequelize')
const sequelize = require('../utils/database')

class RefreshToken extends Model {}

RefreshToken.init(
  {
    token: {
      type: DataTypes.STRING(512),
      allowNull: false,
      primaryKey: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
    }
  },
  {
    sequelize,
    modelName: 'RefreshToken',
    timestamps: true,
    paranoid: true // Enable soft deletion
  }
)

module.exports = RefreshToken
