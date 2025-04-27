const jwt = require('jsonwebtoken')

const generateToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn })
}

exports.generateAccessToken = userId => generateToken({ id: userId }, process.env.JWT_ACCESS_SECRET, '1d')

exports.generateRefreshToken = () => generateToken({}, process.env.JWT_REFRESH_SECRET, '15d')
