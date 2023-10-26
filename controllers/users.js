const HttpError = require('../models/http-error');
const { validationResult } = require('express-validator');
const User = require('../models/users');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, '-password');
  } catch (error) {
    return next(new HttpError('Users not found', 500));
  }

  return res
    .status(200)
    .json({ users: users.map((p) => p.toObject({ getters: true })) });
};

const userSignUp = async (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError('Invalid Inputs Passed', 422));
  }
  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (error) {
    next(new HttpError('Error connecting with DB', 500));
  }

  if (existingUser) {
    return res
      .status(422)
      .json({ message: 'User with given email already exists!' });
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (error) {
    console.log(error);
    const err = new HttpError('Could not create user please try again', 500);
    return next(err);
  }

  const createdUser = new User({
    name,
    email,
    password: hashedPassword,
    image: req.file.path,
    places: [],
  });

  try {
    await createdUser.save();
  } catch (error) {
    const er = new HttpError('Method failed.Try again', 500);
    return next(er);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (error) {
    const err = new HttpError(
      'Signing up failed, please try again later.' + JSON.stringify(error),
      500
    );
    return next(err);
  }

  return res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const userLogin = async (req, res, next) => {
  const { email, password } = req.body;
  let identifiedUser;
  try {
    identifiedUser = await User.findOne({ email: email });
  } catch (error) {
    next(new HttpError('Error connecting with DB', 500));
  }

  //Password on the server is still plain text
  if (!identifiedUser) {
    return res.status(403).json({ message: 'Invalid Credentials' });
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, identifiedUser.password);
  } catch (error) {
    const err = new HttpError('Passwords comparison failed', 500);
    return next(err);
  }

  if (!isValidPassword) {
    return res.status(403).json({ message: 'Invalid Credentials' });
  }

  let token;
  try {
    token = jwt.sign(
      { userId: identifiedUser.id, email: identifiedUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (error) {
    const err = new HttpError(
      'Logging in failed, please try again later.',
      500
    );
    return next(err);
  }
  return res.status(200).json({
    userId: identifiedUser.id,
    email: identifiedUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.userSignUp = userSignUp;
exports.userLogin = userLogin;
