const { Model, DataTypes } = require('sequelize')
const sequelize = require('../utils/database')

class Note extends Model {}

Note.init(
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
    title: DataTypes.STRING,
    content: DataTypes.TEXT
  },
  {
    sequelize,
    modelName: 'Note',
    timestamps: true,
    // Soft deletes the note instead, on delete
    paranoid: true,
    // Takes care of the optimistic version locking and auto-increment
    version: true,
    // Search full text index
    indexes: [
      {
        type: 'FULLTEXT',
        fields: ['title', 'content']
      }
    ]
  }
)

module.exports = Note
