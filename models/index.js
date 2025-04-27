const User = require('./User')
const Note = require('./Note')
const NoteVersion = require('./NoteVersion')
const Attachment = require('./Attachment')
const RefreshToken = require('./RefreshToken')

// Set Associations
User.hasMany(Note, { onDelete: 'CASCADE', foreignKey: { allowNull: false } })
Note.belongsTo(User, { onDelete: 'CASCADE', foreignKey: { allowNull: false } })

Note.hasMany(NoteVersion, { onDelete: 'CASCADE', foreignKey: { allowNull: false } })
NoteVersion.belongsTo(Note, { onDelete: 'CASCADE', foreignKey: { allowNull: false } })

Note.hasMany(Attachment, { onDelete: 'CASCADE' })
Attachment.belongsTo(Note, { onDelete: 'CASCADE' })

User.hasMany(Attachment, { onDelete: 'CASCADE', foreignKey: { allowNull: false } })
Attachment.belongsTo(User, { onDelete: 'CASCADE', foreignKey: { allowNull: false } })

User.hasMany(RefreshToken, { onDelete: 'CASCADE' })
RefreshToken.belongsTo(User, { onDelete: 'CASCADE' })

// Update Note title and content when a new version is created
NoteVersion.afterCreate(async (noteVersion, options) => {
  const { transaction } = options

  const note = await Note.findByPk(noteVersion.NoteId, { transaction })
  if (note) {
    await note.update(
      {
        title: noteVersion.title,
        content: noteVersion.content
      },
      { transaction }
    )
  }
})

module.exports = { User, Note, NoteVersion, Attachment, RefreshToken }
