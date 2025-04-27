const { promises: fs, createReadStream } = require('fs')
const path = require('path')

const express = require('express')
const Sequelize = require('sequelize')

const sequelize = require('../utils/database')
const { Note, NoteVersion, Attachment } = require('../models')

const checkToken = require('../middleware/checkToken')
const checkId = require('../middleware/checkId')
const redisClient = require('../utils/redis')
const upload = require('../middleware/upload')
const checkIds = require('../middleware/checkIds')
const router = express.Router()

router.post('/', checkToken, async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { title, content } = req.body
    const userId = req.userId

    const note = await Note.create({ title, content, UserId: userId, version: 1 }, { transaction })

    await NoteVersion.create({ NoteId: note.id, title, content, version: 1 }, { transaction })

    await transaction.commit()

    await redisClient.delNotes(userId)

    res.status(201).send(note)
  } catch (error) {
    console.log(error)
    await transaction.rollback()
    res.status(400).send({ error: 'Failed to create note' })
  }
})

router.get('/', checkToken, async (req, res) => {
  try {
    const userId = req.userId

    const cachedNotes = await redisClient.getNotes(userId)
    if (cachedNotes) return res.send(cachedNotes)

    const notes = await Note.findAll({
      where: { UserId: userId },
      order: [['createdAt', 'DESC']],

      include: [
        {
          model: NoteVersion,
          order: [['version', 'DESC']],
          separate: true // Fetch in a separate query, to avoid order conflict
        },
        Attachment
      ]
    })

    await redisClient.setNotes(userId, notes)

    res.send(notes)
  } catch (error) {
    console.log('fetch notes error:', error)
    res.status(500).send({ error: 'Failed to fetch notes' })
  }
})

router.post('/search', checkToken, async (req, res) => {
  try {
    const { keywords } = req.body

    if (!keywords) {
      return res.status(400).send({ error: 'missing keywords query parameter' })
    }

    const searchTerms = keywords.slice(0, 100).replace(/[<>*~]/g, '')

    const notes = await Note.findAll({
      where: Sequelize.literal(`MATCH(title, content) AGAINST(:searchTerms)`),

      order: [[Sequelize.literal('MATCH(title, content) AGAINST(:searchTerms)'), 'DESC']],
      replacements: { searchTerms },

      include: [
        {
          model: NoteVersion,
          order: [['version', 'DESC']],
          separate: true
        },
        Attachment
      ]
    })

    res.send(notes)
  } catch (error) {
    console.log('search error:', error)
    res.status(500).send({ error: 'Search failed' })
  }
})

router.get('/:id', checkToken, checkId, async (req, res) => {
  try {
    const noteId = req.params.id

    const cachedNote = await redisClient.getNote(noteId)
    if (cachedNote) return res.send(cachedNote)

    const note = await Note.findOne({
      where: { id: noteId },
      order: [['createdAt', 'DESC']],

      include: [
        {
          model: NoteVersion,
          order: [['version', 'DESC']],
          separate: true
        },
        Attachment
      ]
    })

    if (!note) {
      return res.status(404).send({ error: 'Note not found' })
    }

    await redisClient.setNote(noteId, note)

    res.send(note)
  } catch (error) {
    console.log(error)
    res.status(500).send({ error: 'Failed to fetch notes' })
  }
})

router.put('/:id', checkToken, checkId, async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { id } = req.params
    const userId = req.userId
    const { title, content, version, attachmentsToDelete } = req.body

    if (attachmentsToDelete) {
      await Attachment.destroy({ where: { id: attachmentsToDelete }, transaction })
    }

    const note = await Note.findOne({
      where: { id },
      order: [['createdAt', 'DESC']],
      transaction,

      lock: transaction.LOCK.UPDATE, // Lock the row to prevent concurrent changes
      include: [
        {
          model: NoteVersion,
          order: [['version', 'DESC']],
          separate: true
        },
        Attachment
      ]
    })

    if (!note) {
      await transaction.rollback()
      return res.status(404).send({ error: 'Note not found' })
    }
    if (note.version !== version) {
      await transaction.rollback()
      return res.status(409).send({ error: 'Conflict: Note was modified' })
    }

    await NoteVersion.create(
      { title: title || note.title, content: content || note.content, NoteId: id, version: version + 1 },
      { transaction }
    )

    const updatedNote = await Note.findOne({
      where: { id },
      order: [['createdAt', 'DESC']],
      transaction,

      include: [
        {
          model: NoteVersion,
          order: [['version', 'DESC']],
          separate: true
        },
        Attachment
      ]
    })

    await transaction.commit()

    await redisClient.delNotes(userId)
    await redisClient.delNote(id)

    res.send(updatedNote)
  } catch (error) {
    await transaction.rollback()
    if (error instanceof Sequelize.OptimisticLockError) {
      res.status(409).send({ error: 'Note has been modified by another user' })
    } else {
      console.error('Update note error:', error)
      res.status(500).send({ error: 'Failed to update note' })
    }
  }
})

router.put('/:id/revert', checkToken, checkId, async (req, res) => {
  const { id } = req.params
  const { targetVersion, currentVersion } = req.body
  const userId = req.userId

  const transaction = await sequelize.transaction()
  try {
    // 1. Fetch the target version
    const targetNoteVersion = await NoteVersion.findOne({
      where: { NoteId: id, version: targetVersion },
      transaction
    })

    if (!targetNoteVersion) {
      await transaction.rollback()
      return res.status(404).send({ error: 'Target version not found' })
    }

    // 2. Fetch the current note
    const note = await Note.findOne({
      where: { id, UserId: userId },
      transaction,
      lock: transaction.LOCK.UPDATE // Lock the row to prevent concurrent changes
    })

    if (!note) {
      await transaction.rollback()
      return res.status(404).send({ error: 'Note not found' })
    }

    // 3. Check optimistic lock (currentVersion must match)
    if (note.version !== currentVersion) {
      await transaction.rollback()
      return res.status(409).send({ error: 'Note has been modified by another user' })
    }

    // 4. Update note to target version content
    await note.update({ title: targetNoteVersion.title, content: targetNoteVersion.content }, { transaction })

    // 5. Create a new version entry for the revert
    await NoteVersion.create(
      {
        NoteId: id,
        title: targetNoteVersion.title,
        content: targetNoteVersion.content,
        version: note.version
      },
      { transaction }
    )

    await transaction.commit()

    await redisClient.delNotes(userId)
    await redisClient.delNote(id)

    res.send(note)
  } catch (error) {
    await transaction.rollback()
    if (error instanceof Sequelize.OptimisticLockError) {
      res.status(409).send({ error: 'Note has been modified by another user' })
    } else {
      console.error('Revert error:', error)
      res.status(500).send({ error: 'Failed to revert note' })
    }
  }
})

router.delete('/:id', checkToken, checkId, async (req, res) => {
  try {
    const { userId } = req
    const { id } = req.params
    const note = await Note.findByPk(id, { paranoid: false })

    if (!note || note.deletedAt) {
      return res.status(404).send({ error: 'Note not found' })
    }

    // Soft delete (paranoid is enabled)
    await note.destroy()

    await redisClient.delNotes(userId)
    await redisClient.delNote(id)

    res.sendStatus(204)
  } catch (error) {
    res.status(500).send({ error: 'Failed to delete note' })
  }
})

router.post('/:id/attachments', checkToken, upload.array('attachments'), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { id } = req.params
    const userId = req.userId

    const note = await Note.findOne({
      where: { id },
      order: [['createdAt', 'DESC']],
      transaction,

      lock: transaction.LOCK.UPDATE,
      include: [
        {
          model: NoteVersion,
          order: [['version', 'DESC']],
          separate: true
        },
        Attachment
      ]
    })

    if (!note) {
      await transaction.rollback()
      return res.status(404).send({ error: 'Note not found' })
    }

    if (req.files) {
      const attachments = req.files.map(file => ({
        filename: file.filename,
        path: file.path,
        type: file.mimetype,
        size: file.size,
        NoteId: id,
        UserId: userId
      }))
      await Attachment.bulkCreate(attachments, { transaction })
    }

    const updatedNote = await Note.findOne({
      where: { id },
      order: [['createdAt', 'DESC']],
      transaction,

      include: [
        {
          model: NoteVersion,
          order: [['version', 'DESC']],
          separate: true
        },
        Attachment
      ]
    })

    await transaction.commit()

    await redisClient.delNotes(userId)
    await redisClient.delNote(id)

    res.status(201).send(updatedNote)
  } catch (error) {
    console.log('add attachment error:', error)
    await transaction.rollback()
    if (error instanceof Sequelize.OptimisticLockError) {
      res.status(409).send({ error: 'Note has been modified by another user' })
    } else {
      res.status(400).send({ error: 'Failed to create note' })
    }
  }
})

router.get('/:noteId/attachments/:attachmentId', checkIds('noteId', 'attachmentId'), async (req, res) => {
  try {
    const { noteId, attachmentId } = req.params

    const attachment = await Attachment.findOne({
      where: { id: attachmentId, NoteId: noteId }
    })

    if (!attachment) {
      return res.status(404).send({ error: 'File not found' })
    }

    const filePath = path.join(__dirname, '..', 'uploads', attachment.filename)

    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).send({ error: 'File not found' })
    }

    res.set({
      'Content-Type': attachment.type,
      'Content-Disposition': `inline; filename="${attachment.filename}"`,
      'X-Content-Type-Options': 'nosniff'
    })

    const fileStream = createReadStream(filePath)

    fileStream.pipe(res)

    req.on('close', () => {
      if (!res.writableEnded) {
        fileStream.destroy()
        res.end()
      }
    })
  } catch (error) {
    console.error('Error serving attachment:', error)
    res.status(500).send({ error: 'Error retrieving file' })
  }
})

router.delete('/:noteId/attachments/:attachmentId', checkIds('noteId', 'attachmentId'), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { noteId, attachmentId } = req.params
    const userId = req.userId

    const attachment = await Attachment.findOne({
      where: { id: attachmentId, NoteId: noteId, UserId: userId },
      transaction
    })

    if (!attachment) {
      await transaction.rollback()
      return res.status(404).send({ error: 'Attachment not found' })
    }

    await fs.unlink(path.resolve(__dirname, '..', 'uploads', attachment.toJSON().filename))

    await attachment.destroy({ transaction })

    await transaction.commit()

    await redisClient.delNotes(userId)
    await redisClient.delNote(noteId)

    res.sendStatus(204)
  } catch (error) {
    console.log('delete attachment error:', error)
    await transaction.rollback()
    res.status(500).send({ error: 'Failed to delete attachment' })
  }
})

module.exports = router
