const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/') // Save files to "./uploads"
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  }
})

const fileFilter = (_req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only images (JPEG/PNG) and videos (MP4) are allowed.'))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max file size
})

module.exports = upload
