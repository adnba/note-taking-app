const checkId = async (req, res, next) => {
  try {
    const id = req.params.id

    if (!id || !Number.isInteger(Number(id)) || Number(id) < 1)
      return res.status(400).send({ error: 'the id is not a valid path parameter' })

    next()
  } catch (error) {
    console.log('check id error', error)
    res.status(500).send(error.message)
  }
}

module.exports = checkId
