const express = require('express');
const { check } = require('express-validator');
const router = express.Router();

const userFunctions = require('../controllers/users');
const fileUpload = require('../middleware/file-upload');

const HttpError = require('../models/http-error');

router.get('/', userFunctions.getUsers);
router.post(
  '/signup',
  fileUpload.single('image'), 
  [
    check('name').not().isEmpty(),
    check('email').isEmail(),
    check('password').isLength({ min: 6 }),
  ],
  userFunctions.userSignUp
);
router.post('/login', userFunctions.userLogin);

module.exports = router;
