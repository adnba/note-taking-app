const { Model, DataTypes } = require('sequelize')
const sequelize = require('../utils/database')

class NoteVersion extends Model {}

NoteVersion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'NoteVersion',
    timestamps: true,
    paranoid: true
  }
)

module.exports = NoteVersion
