const express = require('express')
const cors = require('cors')

require('dotenv').config()

const sequelize = require('./utils/database')

const auth = require('./routes/auth')
const notes = require('./routes/notes')

const app = express()

setTimeout(() => {
  sequelize
    .sync({ alter: true })
    .then(() => console.log('Connected to Database'))
    .catch(error => console.log('Error connecting to Database', error))
}, 10000)

app.use(express.json())
app.use(cors())

app.use('/api/auth', auth)
app.use('/api/notes', notes)

app.use((err, _req, res, _next) => {
  console.error('Internal server error:', err.stack)
  res.status(500).send({ error: 'Internal server error' })
})

const port = process.env.PORT || 3000

app.listen(port, () => console.log('Server is listening on port ' + port))
