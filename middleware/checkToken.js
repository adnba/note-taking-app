const jwt = require('jsonwebtoken')
const { User } = require('../models')

const checkToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization')
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) return res.status(401).send({ error: 'token is missing' })

    const decryptedToken = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    const userId = decryptedToken.id

    const user = await User.findByPk(userId)
    if (!user) return res.status(404).send({ error: 'user not found' })

    req.userId = userId

    next()
  } catch (error) {
    console.log('check token error:', error)
    res.status(500).send(error.message)
  }
}

module.exports = checkToken
