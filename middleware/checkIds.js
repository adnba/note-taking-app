const checkIds = (...idArray) => {
  return async (req, res, next) => {
    try {
      idArray.forEach(idName => {
        const id = req.params[idName]
        if (!id || !Number.isInteger(Number(id)) || Number(id) < 1)
          return res.status(400).send({ error: `the path ${idName} is not a path parameter` })
      })
      next()
    } catch (error) {
      console.log('validate id error:', error)
      res.status(500).send(error.message)
    }
  }
}

module.exports = checkIds
