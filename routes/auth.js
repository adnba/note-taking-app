const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const Sequelize = require('sequelize')

const { User, RefreshToken } = require('../models')
const { generateAccessToken, generateRefreshToken } = require('../utils/tokens')
const checkToken = require('../middleware/checkToken')
const sequelize = require('../utils/database')

const router = express.Router()

router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body

    const userFound = await User.findOne({ where: { email } })
    if (userFound) return res.status(400).send({ error: 'user already registered' })

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)

    await User.create({
      firstName,
      lastName,
      email,
      password: hash
    })

    res.status(201).send({ error: 'user created' })
  } catch (error) {
    console.log('signup error:', error)
    res.status(400).send(error.message)
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ where: { email } })
    if (!user) return res.status(404).send({ error: 'user not found' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).send({ error: 'password incorrect' })

    const refreshToken = generateRefreshToken()

    await RefreshToken.create({
      token: refreshToken,
      UserId: user.id
    })

    res.send({
      accessToken: generateAccessToken(user.id),
      refreshToken,
      expiresIn: 24 * 60 * 60 // 1 day
    })
  } catch (error) {
    console.log('login error', error)
    res.status(500).send({ error: 'login failed' })
  }
})

router.post('/logout', checkToken, async (req, res) => {
  try {
    const { refreshToken } = req.body
    const { userId } = req

    await RefreshToken.destroy({
      where: { token: refreshToken, UserId: userId }
    })

    res.status(204).end()
  } catch (error) {
    res.status(500).send({ error: 'Logout failed' })
  }
})

router.post('/refreshToken', checkToken, async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { refreshToken: oldToken } = req.body

    jwt.verify(oldToken, process.env.JWT_REFRESH_SECRET)

    const storedToken = await RefreshToken.findOne({
      where: {
        token: oldToken,
        expiresAt: { [Sequelize.Op.gt]: new Date() }
      },
      include: [User],
      transaction
    })

    if (!storedToken) {
      await transaction.rollback()
      return res.status(401).send({ error: 'Invalid token' })
    }

    await storedToken.destroy({ transaction })

    const newRefreshToken = generateRefreshToken()

    await RefreshToken.create(
      {
        token: newRefreshToken,
        UserId: storedToken.User.id
      },
      { transaction }
    )

    await transaction.commit()

    res.send({
      accessToken: generateAccessToken(storedToken.User.id),
      refreshToken: newRefreshToken,
      expiresIn: 15 * 24 * 60 * 60 // 15 days
    })
  } catch (error) {
    console.log('token refresh error', error)
    await transaction.rollback()
    res.status(401).send({ error: 'Token refresh failed' })
  }
})

router.get('/profile', checkToken, async (req, res) => {
  const user = await User.findByPk(req.userId)
  res.send(user.toJSON())
})

module.exports = router
