const { Model, DataTypes } = require('sequelize')
const sequelize = require('../utils/database')

class Attachment extends Model {}

Attachment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true
    },
    filename: DataTypes.STRING,
    path: DataTypes.STRING,
    type: DataTypes.STRING,
    size: DataTypes.INTEGER
  },
  {
    sequelize,
    modelName: 'Attachment',
    timestamps: true,
    paranoid: true
  }
)

module.exports = Attachment
