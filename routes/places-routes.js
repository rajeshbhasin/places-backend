const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');

const placeFunctions = require('../controllers/place');
const fileUpload = require('../middleware/file-upload');

const HttpError = require('../models/http-error');

router.get('/:pid', placeFunctions.getPlaceById);
router.get('/users/:uid', placeFunctions.getPlacesByUserId);

router.use(checkAuth);

router.patch(
  '/:pid',
  [check('title').not().isEmpty(), check('description').isLength({ min: 5 })],
  placeFunctions.updatePlaceById
);
router.delete('/:pid', placeFunctions.deletePlaceById);

router.post(
  '/',
  fileUpload.single('image'),
  [
    check('title').not().isEmpty(),
    check('description').isLength({ min: 5 }),
    check('address').not().isEmpty(),
  ],
  placeFunctions.createPlace
);
module.exports = router;
